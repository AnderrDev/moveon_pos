# Plan de accion — Remediacion de auditoria integral

Fecha: 2026-05-30  
Fuente: `docs/audits/2026-05-30-auditoria-arquitectura-patrones-calidad.md`

---

## Objetivo

Convertir la auditoria integral en un backlog ejecutable, priorizado y verificable. Este plan no mezcla remediaciones de codigo con la auditoria: define el orden de trabajo, criterios de cierre, riesgos y pruebas esperadas para cada PLAN.

## Principios de ejecucion

- Atacar primero riesgos de seguridad y reglas de negocio que pueden afectar go-live.
- Crear pruebas de regresion antes de refactors grandes.
- Mantener cambios pequenos, auditables y reversibles.
- No romper el flujo PV/Bodega ya validado.
- Conservar migraciones historicas; nuevas reglas DB van en migraciones nuevas.
- Todo PLAN termina con `corepack pnpm typecheck`, `corepack pnpm lint` y `corepack pnpm test`.
- Los PLANs con DB terminan con tests SQL/pgTAP o evidencia SQL directa en staging.
- Los PLANs UI terminan con validacion navegador en `http://localhost:4200`.

---

## Ruta recomendada

1. **PLAN-27** — Seguridad RLS/RPC admin-only.
2. **PLAN-28** — Descuentos por rol en servidor.
3. **PLAN-29** — E2E Playwright minimo de regresion.
4. **PLAN-30** — Dividir `pos.page.ts`.
5. **PLAN-31** — Alinear repositorios Angular con `Result`.
6. **PLAN-32** — Dividir importador Siigo.
7. **PLAN-33** — Dividir reportes/caja/cierre.
8. **PLAN-34** — Estandarizar formularios con factory/mapper/presenter.
9. **PLAN-35** — Errores tipados por modulo.
10. **PLAN-36** — Limpieza documental legacy/runtime config.
11. **PLAN-37** — Limpieza de placeholders, TODOs y fixtures.

**Gate de go-live recomendado:** PLAN-27, PLAN-28 y PLAN-29 cerrados.  
**Gate de mantenibilidad MVP:** PLAN-30, PLAN-31 y PLAN-32 cerrados.  
**Gate de calidad arquitectonica:** PLAN-33..37 cerrados.

---

## PLAN-27 — Seguridad RLS/RPC para operaciones admin-only

**Prioridad:** P0  
**Esfuerzo:** L  
**Origen:** C1 de la auditoria.

### Problema

Productos, categorias y movimientos de inventario admin-only estan protegidos principalmente por rutas/menu/dialogos Angular. La RLS vigente aisla por tienda, pero no distingue rol para mutaciones.

### Alcance

- Endurecer DB para mutaciones admin-only:
  - `productos`: create/update/deactivate.
  - `categorias`: create/update/deactivate.
  - `inventory_movements`: `entry` y `adjustment`.
- Mantener lectura tenant-safe para usuarios de la tienda.
- Mantener `transfer_stock_atomic` como RPC admin-only.
- Agregar defensa en servicios Angular sensibles con `SessionService.getRole()`.

### Implementacion sugerida

1. Crear migracion `supabase/migrations/<ts>_admin_only_mutations.sql`.
2. Separar politicas RLS por operacion:
   - `select` para miembros activos de la tienda.
   - `insert/update/delete` solo para `rol = 'admin'`.
   - `with check` en inserts/updates.
3. Para inventario, permitir `sale_exit`, `void_return`, `transfer_out`, `transfer_in` solo via RPCs existentes; para UI directa permitir unicamente admin en `entry`/`adjustment`.
4. Agregar tests SQL para usuario cajero vs admin.
5. En Angular, cortar mutaciones sensibles si `auth.rol !== 'admin'`.

### Criterios de cierre

- Cajero no puede crear/editar/desactivar productos via API directa.
- Cajero no puede insertar `inventory_movements` `entry`/`adjustment` via API directa.
- Admin si puede operar productos e inventario desde UI.
- Transferencias siguen pasando solo como admin.
- Tests SQL/pgTAP pasan.
- QA navegador: cajero redirigido de rutas admin; admin conserva flujo inventario/productos.

### Pruebas

- `corepack pnpm typecheck`
- `corepack pnpm lint`
- `corepack pnpm test`
- SQL/pgTAP para politicas por rol.
- QA navegador con usuario admin y cajero.

---

## PLAN-28 — Descuentos por rol en flujo POS real

**Prioridad:** P0  
**Esfuerzo:** M/L  
**Origen:** C2 de la auditoria.

### Problema

El use-case puro valida umbral de descuento por rol, pero el POS Angular llama `PosSaleService -> create_sale_atomic` directo. La regla RN-S09 no esta aplicada en servidor.

### Alcance

- Bloquear descuentos no autorizados en el flujo real.
- Registrar la decision de arquitectura: validacion simple por rol o aprobacion admin con token.
- No cambiar semantica de descuentos ya implementada.

### Decision recomendada para MVP

Para MVP, validar en `create_sale_atomic` consultando `user_tiendas`:

- `admin`: puede cualquier descuento valido.
- `cajero`: maximo definido por RN-S09.
- Si el descuento excede umbral, el RPC rechaza con mensaje especifico.

La aprobacion admin por token queda post-MVP si se necesita.

### Implementacion sugerida

1. Crear migracion que agregue validacion al RPC `create_sale_atomic`.
2. Calcular subtotal/descuento real desde `p_items` y/o validar `p_discount_total`.
3. Consultar rol efectivo de `auth.uid()` en `user_tiendas` para `p_tienda_id`.
4. Rechazar si `auth.uid() <> p_cashier_id`.
5. Mapear error en `sale-error-mapper.ts`.
6. Remover o reemplazar TODO de `pos.page.ts`.

### Criterios de cierre

- Cajero no puede crear venta con descuento mayor al umbral.
- Admin si puede crearla.
- Error UI claro: "Descuentos mayores al X% requieren admin".
- Tests unitarios cubren mapper/error.
- Tests SQL cubren RPC con rol admin/cajero.

### Pruebas

- `corepack pnpm typecheck`
- `corepack pnpm lint`
- `corepack pnpm test`
- SQL/pgTAP para `create_sale_atomic`.
- QA navegador: venta con cajero y descuento limite/sobre limite.

---

## PLAN-29 — E2E Playwright minimo de regresion MVP

**Prioridad:** P1, gate recomendado de go-live  
**Esfuerzo:** M/L  
**Origen:** H3 de la auditoria.

### Problema

`corepack pnpm test:e2e` falla porque no hay specs. La regresion critica depende de QA manual.

### Alcance minimo

- Login admin.
- Apertura de caja si no existe.
- Crear producto QA controlado.
- Entrada a bodega.
- Confirmar que POS no vende con PV 0.
- Traslado Bodega -> PV.
- Venta.
- Anulacion.
- Reporte stock PV/Bodega/Total.

### Implementacion sugerida

1. Crear `tests/e2e/mvp-inventory-pos.spec.ts`.
2. Usar datos QA con timestamp y limpiar cuando sea seguro.
3. Agregar helpers de login, apertura de caja y busqueda por SKU.
4. Evitar depender de orden visual fragil: usar labels/textos estables.
5. Documentar prerequisitos de credenciales en `.env.local`.

### Criterios de cierre

- `corepack pnpm test:e2e` ejecuta al menos un flujo completo.
- Falla si PV/Bodega/Total no cuadran.
- Falla si venta descuenta bodega en vez de PV.
- Falla si anulacion no repone PV.

### Pruebas

- `corepack pnpm test:e2e`
- Browser manual de respaldo si falla por entorno.

---

## PLAN-30 — Dividir `pos.page.ts`

**Prioridad:** P1  
**Esfuerzo:** L  
**Origen:** H1 de la auditoria.

### Problema

`pos.page.ts` tiene 859 lineas y mezcla template, catalogo, carrito, checkout, pagos, descuentos, side effects e impresion.

### Corte propuesto

- `pos-catalog.component.ts`: busqueda, categorias, productos.
- `pos-cart-panel.component.ts`: cliente, items, cantidades, descuento por item, total.
- `pos-checkout.dialog.ts`: pagos, referencia, monto exacto, descuento global.
- `pos-page.presenter.ts` o `pos-checkout.presenter.ts`: estado de checkout y helpers.
- `pos.page.ts`: orquestador delgado.

### Criterios de cierre

- Ningun archivo nuevo supera 300 lineas.
- `pos.page.ts` queda por debajo de 300 lineas.
- Flujo venta/anulacion/impresion no cambia.
- No se introduce Supabase directo en componentes.

### Pruebas

- Unitarios actuales.
- `corepack pnpm test:e2e` si PLAN-29 ya existe.
- QA navegador de venta completa.

---

## PLAN-31 — Repositorios Angular alineados con `Result`

**Prioridad:** P1  
**Esfuerzo:** L  
**Origen:** H2 de la auditoria.

### Problema

Las interfaces de dominio devuelven `Result`, pero varios repositorios Angular devuelven entidades directas y lanzan `throw new Error`.

### Alcance

Migrar incrementalmente:

1. `InventoryRepository`.
2. `ProductsRepository`.
3. `CashRegisterRepository`.
4. `SalesRepository`.
5. `CustomersRepository`.

### Implementacion sugerida

- Crear errores de aplicacion por feature si hace falta.
- Convertir Supabase errors a `err(...)`.
- Mantener throws solo para errores tecnicos inesperados.
- Ajustar callers con manejo `if (!result.ok)`.
- No mezclar con refactors visuales.

### Criterios de cierre

- Repositories sensibles implementan interfaces compatibles con dominio o adapters claros.
- No se exponen rows Supabase a presenters/pages.
- Tests unitarios cubren error paths principales.

---

## PLAN-32 — Dividir importador Siigo

**Prioridad:** P1  
**Esfuerzo:** M  
**Origen:** H4 de la auditoria.

### Corte propuesto

- `csv-parser.ts`
- `siigo-header.ts`
- `siigo-row.parser.ts`
- `siigo-duplicates.validator.ts`
- `siigo-import.mapper.ts`
- `siigo-csv.ts` como facade publico.

### Criterios de cierre

- Ningun archivo manual del importador supera 300 lineas.
- API publica actual se mantiene o se migra con cambios minimos en `scripts/import-siigo-csv.mjs`.
- Tests existentes de Siigo siguen pasando.

---

## PLAN-33 — Dividir reportes, caja y cierre

**Prioridad:** P2  
**Esfuerzo:** L  
**Origen:** H5 de la auditoria.

### Alcance

- `reportes.page.ts`:
  - `daily-report-panel.component.ts`
  - `stock-report-table.component.ts`
  - `cash-closures-table.component.ts`
- `caja.page.ts`:
  - `open-cash-session-form.component.ts`
  - `cash-summary-panel.component.ts`
  - `cash-movements-list.component.ts`
- `close-session.dialog.ts`:
  - presenter/helper para rows de diferencias.

### Criterios de cierre

- Archivos bajo 300 lineas.
- No se cambia comportamiento funcional.
- Componentes hijos son standalone + OnPush.

---

## PLAN-34 — Formularios factory/mapper/presenter

**Prioridad:** P2  
**Esfuerzo:** M/L  
**Origen:** M1 de la auditoria.

### Alcance

Migrar formularios inline a patron de 3 archivos:

- `register-entry`
- `adjust-stock`
- `transfer-stock`
- `add-movement`
- `close-session`

### Criterios de cierre

- Schemas/defaults en `src/modules/<feature>/forms`.
- Mappers TS puro.
- Presenters Angular `@Injectable`.
- Dialogos quedan delgados.
- Tests unitarios de schemas/mappers.

---

## PLAN-35 — Errores tipados por modulo

**Prioridad:** P2  
**Esfuerzo:** M  
**Origen:** M2 de la auditoria.

### Alcance

- `SaleError`
- `InventoryError`
- `CashRegisterError`
- `ProductError`

### Criterios de cierre

- Use-cases no retornan `Result<T>` con `Error` generico para errores de negocio.
- UI puede mapear errores por `kind`.
- Tests cubren al menos ventas e inventario.

---

## PLAN-36 — Limpieza documental legacy y runtime config

**Prioridad:** P2  
**Esfuerzo:** M  
**Origen:** M4/M5 de la auditoria.

### Alcance

- `README.md`
- `docs/standards/solid-principles.md`
- `docs/04-roadmap.md`
- `docs/05-glossary.md`
- `docs/02-architecture.md`
- Marcas "superseded by ADR 0006" en ADRs historicos cuando aplique.

### Criterios de cierre

- Docs fuente no presentan Next/Vercel/shadcn como stack activo.
- Runtime config queda documentado como patron oficial o se decide volver a `environments`.
- Docs historicas se conservan como historicas, no se reescriben resultados pasados.

---

## PLAN-37 — Limpieza de placeholders, TODOs y fixtures

**Prioridad:** P3  
**Esfuerzo:** S/M  
**Origen:** M3/B1/B2 de la auditoria.

### Alcance

- Eliminar carpetas vacias no necesarias o documentarlas.
- Convertir TODOs activos en tickets/PLANs.
- Extraer fixtures del test Siigo si sigue creciendo.

### Criterios de cierre

- `find src/modules apps/pos-angular/src/app -type d -empty` no muestra ruido injustificado.
- `rg "TODO|FIXME"` solo muestra deuda registrada.
- Tests siguen pasando.

---

## Matriz de dependencias

| PLAN | Depende de | Desbloquea |
|---|---|---|
| PLAN-27 | Ninguno | Go-live seguro, PLAN-29 con roles reales |
| PLAN-28 | Ninguno, ideal despues de PLAN-27 | Cierre RN-S09 |
| PLAN-29 | PLAN-27/28 recomendados | Refactors PLAN-30..34 |
| PLAN-30 | PLAN-29 recomendado | Mantenibilidad POS |
| PLAN-31 | PLAN-29 recomendado | Arquitectura consistente |
| PLAN-32 | Ninguno | Importador mantenible |
| PLAN-33 | PLAN-29 recomendado | UI mantenible |
| PLAN-34 | PLAN-31 recomendado | Formularios consistentes |
| PLAN-35 | PLAN-31 recomendado | Error handling limpio |
| PLAN-36 | Ninguno | Docs fuente coherentes |
| PLAN-37 | PLAN-36 recomendado | Menos ruido para agentes |

---

## Checklist de salida por PLAN

Cada PLAN debe dejar:

- Cambios pequenos y localizados.
- Tests automaticos relevantes.
- Evidencia de navegador si toca UI.
- Migracion nueva si toca DB.
- Actualizacion de docs del modulo afectado.
- Actualizacion del spec de sesion.
- Resultado de:
  - `corepack pnpm typecheck`
  - `corepack pnpm lint`
  - `corepack pnpm test`

