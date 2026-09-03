# Spec de Sesión — 2026-09-03 — Clientes: documento obligatorio + auditoría

> Copia este archivo como `YYYY-MM-DD-<tema-kebab-case>.md` al inicio de cada sesión de trabajo.
> Llénalo durante y al final de la sesión. Es el registro de lo que pasó.

---

## Metadatos

| Campo | Valor |
|---|---|
| Fecha | 2026-09-03 |
| Sprint | N/A (mantenimiento) |
| Agente | Claude Code |
| HUs trabajadas | N/A — ajuste de reglas de negocio en módulo `customers` |
| Estado | Completada |

---

## 1. Objetivo de la sesión

1. En el formulario de clientes (`clientes.page` / `cliente-form.dialog`), dejar **nombre y
   documento (tipo + número) obligatorios**; el resto de campos (email, celular, autorizaciones)
   siguen opcionales.
2. Investigar y corregir por qué las acciones del módulo de clientes (crear/editar/eliminar) no
   aparecían en la página de Auditoría.

---

## 2. Lo que se implementó

### 2.2 Archivos modificados

- `apps/pos-angular/src/app/features/customers/domain/dtos/cliente.dto.ts` — `tipoDocumento` y
  `numeroDocumento` pasan de `.optional()` a `.trim().min(1, ...)` en `clienteInputSchema` (RN-CL03).
- `apps/pos-angular/src/app/features/customers/presentation/forms/cliente-form.factory.ts` —
  mismo cambio en `clienteFormSchema` (capa de formulario).
- `apps/pos-angular/src/app/features/customers/presentation/dialogs/cliente-form.dialog.ts` —
  UI: tipo y número de documento marcados `[required]="true"`, se quitó el placeholder
  "(opcional)" del select y se enlazaron sus `[error]` al presenter.
- `apps/pos-angular/src/app/features/customers/presentation/forms/cliente-form.mapper.ts` —
  `toPayload` ya no convierte tipo/número de documento vacíos en `undefined` (ahora siempre
  obligatorios, se envían tal cual — la validación de vacío la hace el schema antes).
- `docs/modules/customers.md` — RN-CL03 actualizada: nombre y documento obligatorios al
  crear/editar cliente desde el directorio.
- `apps/pos-angular/src/app/features/audit/domain/entities/audit-log.entity.ts` — se agregó
  `'cliente'` a `AuditEntityType`.
- `apps/pos-angular/src/app/features/audit/presentation/pages/auditoria.page.ts` — se agregó
  `cliente: 'Cliente'` a `MODULE_LABELS` y la opción "Clientes" al filtro de módulo.
- `apps/pos-angular/src/app/features/customers/data/repositories/customers.repository.ts` —
  **causa raíz del bug de auditoría**: este repositorio nunca inyectaba `AuditLogRepository` ni
  llamaba `.log(...)` en `create`/`update`/`delete` (a diferencia de `products.repository.ts`,
  `inventory.repository.ts`, etc., cableados en PLAN-67). Se agregó `inject(AuditLogRepository)`
  y las tres llamadas `void this.audit.log(...)` siguiendo el mismo patrón fire-and-forget que
  usan las demás features.
- `tests/unit/features/customers/cliente-form.test.ts` — casos nuevos/ajustados para exigir
  documento; el caso "mínimo con solo nombre" ahora incluye documento.
- `tests/unit/features/customers/customer-use-cases.test.ts` — casos nuevos que verifican que
  `createCustomer`/`updateCustomer` rechazan payloads sin documento sin llamar al repositorio.

---

## 3. Decisiones tomadas

| Decisión | Alternativa descartada | Razón |
|---|---|---|
| El documento se exige a nivel de aplicación (Zod en DTO y en form), no se agregó `NOT NULL` en la columna `clientes.numero_documento` en la BD | Migración `ALTER TABLE ... SET NOT NULL` | Clientes ya existentes en producción pueden tener el documento en `null`; un `NOT NULL` los rompería. La regla de negocio nueva aplica hacia adelante (crear/editar desde el formulario), y el índice único parcial existente (`ux_clientes_documento`, sólo cuando no es null) sigue funcionando igual. |
| No se tocó `RN-CL07` (registro rápido desde POS sin documento, planeado v1.3) | Exigir documento también ahí | Ese flujo (`QuickCreateCustomerUseCase`) todavía no está implementado; la regla planeada explícitamente dice que el alta rápida no debe pedir campos fiscales para no interrumpir la venta. No se creó conflicto. |

---

## 4. ADRs creados o actualizados

- Ninguno — cambio de regla de negocio dentro del patrón ya establecido (ADR 0015), sin nueva
  decisión arquitectónica.

---

## 5. Tests

- [x] `pnpm typecheck` — pasó
- [x] `pnpm lint` — pasó
- [x] `pnpm test` — 713 tests pasaron, 0 fallaron

---

## 6. Bloqueos y preguntas pendientes

- Ninguno.

---

## 7. Próximos pasos

1. Verificar manualmente en el navegador (crear/editar/eliminar un cliente) que el registro
   aparece en `/auditoria` filtrando por "Clientes" — no se hizo prueba en navegador esta sesión.
2. Si en el futuro se implementa `QuickCreateCustomerUseCase` (RN-CL07), recordar que ese flujo
   NO debe exigir documento (nombre + celular + autorizaciones únicamente).

---

## 8. Notas adicionales

Causa raíz del bug de auditoría: `customers.repository.ts` fue el único repositorio "cableado"
(está en la lista `CABLED_FEATURES` de `eslint.config.js`) que nunca llegó a inyectar
`AuditLogRepository` — quedó fuera del trabajo de PLAN-67 que sí tocó products, cash-register,
sales, pos e inventory.
