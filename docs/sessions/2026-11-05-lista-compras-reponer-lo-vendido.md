# Spec de Sesión — 2026-11-05 — Lista de compras: modo "Reponer lo vendido"

> Copia este archivo como `YYYY-MM-DD-<tema-kebab-case>.md` al inicio de cada sesión de trabajo.
> Llénalo durante y al final de la sesión. Es el registro de lo que pasó.

---

## Metadatos

| Campo | Valor |
|---|---|
| Fecha | 2026-11-05 |
| Sprint | Post-MVP (mejoras) |
| Agente | Claude Code |
| HUs trabajadas | Pedido del dueño: "se vendió una Vitanas, para reponer se debería comprar una" (PLAN-114) |
| Estado | En progreso |

---

## 1. Objetivo de la sesión

La lista de compras pronostica por consumo diario y días de cobertura. El dueño quiere además el modo simple: lo que se vendió desde la última compra se repone 1 a 1. Agregar ese modo a `/finanzas/compras` sin tocar la base.

---

## 2. Lo que se implementó

### 2.1 Archivos creados
- `docs/sessions/2026-11-05-lista-compras-reponer-lo-vendido.md` — este spec.

### 2.2 Archivos modificados
- `features/inventory/domain/services/purchase-suggestions.ts` — `buildReplenishmentPlan`, `ReplenishWindow`, campos opcionales `vendido`/`comprado`/`desde` en `PurchaseLine`.
- `tests/unit/features/inventory/purchase-suggestions.test.ts` — 3 pruebas del modo (desde la última compra, ventana de días, presupuesto).
- `features/expenses/presentation/pages/compras.page.ts` — pestañas Reponer lo vendido / Pronóstico, selector de ventana, columnas por modo, guarda los movimientos cargados.
- `features/expenses/presentation/services/purchase-list-export.ts` — `PurchaseListMode`; columnas Vendido / Comprado / Por reponer en ese modo.
- `docs/plan-de-trabajo.md` (PLAN-114), `docs/modules/expenses.md`.

### 2.3 Archivos eliminados
- (si aplica)

---

## 3. Decisiones tomadas

_Decisiones que no quedaron en ADR pero son relevantes para el contexto._

| Decisión | Alternativa descartada | Razón |
|---|---|---|
| Modo nuevo dentro de la misma lista, por defecto | Página aparte | Comparte presupuesto, filtro de proveedor, estados y Excel; el dueño ya conoce la pantalla |
| Ventana por defecto "desde la última compra de cada producto" | Últimos 7 días | Es la cuenta literal del dueño: lo vendido después de la última compra es lo que falta reponer |
| Tarros abiertos para fraccionar cuentan como vendidos | Solo ventas | Un tarro abierto para sachets también hay que reponerlo (PLAN-113) |
| Sin cambios en la base | RPC de resumen | Los movimientos de 56 días ya se cargan para el pronóstico |

---

## 4. ADRs creados o actualizados

- `docs/adr/XXXX-titulo.md` — resumen de una línea

---

## 5. Tests

- [ ] `pnpm typecheck` — pasó / falló
- [ ] `pnpm lint` — pasó / falló
- [ ] `pnpm test` — X tests pasaron, Y fallaron

Detalle de fallos (si los hay):

---

## 6. Bloqueos y preguntas pendientes

_Lo que impidió avanzar o quedó sin resolver._

- [ ] Pregunta: ...
- [ ] Bloqueado por: ...

---

## 7. Próximos pasos

_Qué debe hacer el próximo agente o sesión para continuar._

1. Continuar con HU-XX criterio CA-Y
2. Resolver el bloqueo de [...]
3. Crear test de integración para [...]

---

## 8. Notas adicionales

_Contexto que no encaja en las secciones anteriores pero que el próximo agente debe saber._
