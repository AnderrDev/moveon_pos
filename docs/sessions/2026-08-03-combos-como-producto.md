# Spec de Sesión — 2026-08-03 — Combos y promociones como producto (PLAN-73)

---

## Metadatos

| Campo | Valor |
|---|---|
| Fecha | 2026-08-03 |
| Sprint | Post-Sprint 3 (backlog operativo) |
| Agente | Claude Code |
| HUs trabajadas | PLAN-73 (ADR 0018) |
| Estado | Completada — verificada en local, **pendiente aplicar al remoto** |

---

## 1. Objetivo de la sesión

El dueño pidió poder armar promociones combinando productos ("proteína + otro producto") y
ponerles un precio especial. Antes de programar se levantó el ambiente local para no tocar
producción en ninguna prueba.

Decisiones de producto acordadas antes de diseñar:

- El combo es **un producto más**, con precio fijo propio y **una sola línea en el ticket**.
- Los productos incluidos descuentan stock automáticamente.
- **Sin vigencia**: solo `is_active`.
- **Solo POS**: el catálogo público no cambia.

---

## 2. Lo que se implementó

### 2.1 Archivos creados

- `supabase/migrations/20260803200000_product_type_combo.sql` — agrega `'combo'` al enum
  `product_type`. Va solo en su archivo: Postgres no permite usar un valor de enum en la misma
  transacción que lo agrega.
- `supabase/migrations/20260803200100_combo_support.sql` — recrea `create_sale_atomic`,
  `tg_consume_sale_components`, `void_sale_atomic`, `create_product_with_initial_stock` y la
  vista `storefront_productos_publicos`.
- `src/shared/lib/product-type.ts` — `tracksOwnStock(tipo)`, espejo en TS del guarda SQL.
- `apps/pos-angular/src/app/features/products/domain/services/combo-pricing.ts` + `.test.ts` —
  suma normal, costo sugerido y ahorro (10 tests).
- `apps/pos-angular/src/app/features/pos/presentation/services/combo-stock.ts` —
  `deriveComboStock`.
- `tests/unit/app/features/pos/combo-stock.test.ts` — 8 tests.
- `docs/adr/0018-combos-como-producto-con-componentes.md`.

### 2.2 Archivos modificados

- `src/shared/types/index.ts` y `src/shared/validations/common.ts` — `'combo'` en el tipo y en
  el schema Zod.
- `features/inventory/domain/services/low-stock.ts` — usa `tracksOwnStock`: los combos nunca
  están bajos ni agotados.
- `features/products/presentation/services/product-component.helpers.ts` — nuevo
  `filterComboItemCandidates` (productos con stock propio, sin anidamiento);
  `filterOptionComponentCandidates` pasa a `tracksOwnStock` para excluir también combos.
- `features/products/presentation/dialogs/product-form.dialog.ts` — tipo "Combo"; el bloque de
  componentes se comparte entre preparados y combos con copy distinto; **las opciones de venta
  quedan en su propio `@if`, exclusivas de `prepared`**; resumen de ahorro en vivo.
- `features/pos/presentation/services/{pos.types.ts,pos-data.service.ts}` — `PosProductComponent`
  gana `componenteId` (el `select` ahora lo trae) y `resolveStock` deriva la disponibilidad del
  combo.
- `features/products/data/import/siigo-csv.ts` — rechaza `tipo = combo` con mensaje explícito.
- Etiquetas "Combo" en `productos.page.ts`, `inventario.page.ts`, `product-export.ts`.
- Tests: `low-stock.test.ts` (+2), `product-components.test.ts` (+4), `siigo-csv.test.ts`
  (el caso que usaba `combo` como tipo inválido se reescribió).
- Docs: `plan-de-trabajo.md` (PLAN-73), `01-mvp-scope.md`, `modules/products.md` (RN-P09),
  `modules/inventory.md` (RN-I09), `modules/sales.md` (RN-S07).
- `apps/pos-angular/tsconfig.json` — **restaurado**: estaba íntegramente comentado en el working
  tree (sin commitear), lo que dejaba un JSON vacío y rompía el build.

---

## 3. Decisiones tomadas

| Decisión | Alternativa descartada | Razón |
|---|---|---|
| Valor nuevo `'combo'` en `product_type` | Reutilizar `'prepared'` | Cero SQL, pero la UI diría "Preparado", los reportes de batidos se contaminarían y el seed de opciones (`where tipo='prepared'`) los alcanzaría. El costo del valor nuevo resultó ser 6 puntos en SQL y ~8 en TS, todos mecánicos |
| Reutilizar `product_components` | Tabla `promotions` + `promotion_items` | Un combo ya *es* "un producto que consume otros"; una tabla nueva duplicaría el modelo existente |
| Precio fijo en `precio_venta` | Guardar un % o monto de descuento | El servidor cobra `precio_venta` sin lógica extra; el descuento se muestra como ayuda de captura, no se persiste |
| Filtro propio para los productos incluidos | Reusar `filterComponentCandidates` | **No estaba en el plan**: ese filtro solo admite `ingredient`, así que un combo no habría podido incluir una proteína |
| Incluir el fix de `void_sale_atomic` | Dejarlo como deuda | Con batidos el faltante al anular era un vaso; con un combo es una proteína de $180.000 |
| Tope de stock del combo solo en el cliente | Validar componentes en `create_sale_atomic` | Mantiene la política "advertir, no bloquear" de ADR 0017 y evita validar N componentes bajo advisory lock en el camino del dinero. Con 1 sola caja el riesgo de carrera es despreciable |
| El importador CSV rechaza combos | Aceptarlos como cualquier tipo | Un combo importado no tendría componentes: se vendería sin descontar nada. El CSV de Siigo no puede expresar qué lleva dentro |

---

## 4. ADRs creados o actualizados

- `docs/adr/0018-combos-como-producto-con-componentes.md` — combos como producto sin stock propio
  que consume `product_components`; incluye el cierre de la deuda de anulación de ADR 0017.

---

## 5. Tests

- [x] `pnpm typecheck` — pasó
- [x] `pnpm lint` — pasó (incluye las fronteras de ESLint de ADR 0015)
- [x] `pnpm test` — 660 tests pasaron, 0 fallaron (73 archivos)

Verificación end-to-end en **Supabase local** (nunca en prod):

1. SQL directo: crear combo, venderlo, anularlo → una línea de $250.000, dos `sale_exit` por los
   componentes, ninguno del combo, y `void_return` que devuelve el stock exacto.
2. SQL directo: no-regresión de ADR 0017 — batido con Bipro a $13.000, sale 1 sachet, y al
   anular el sachet vuelve (antes no volvía).
3. Navegador contra local: se creó "COMBO PROTEINA + CREATINA" ($250.000, proteína + creatina)
   desde el formulario; el selector ofreció solo productos con stock propio; el resumen mostró
   "Suma normal $275.000 · Precio $250.000 · Ahorro $25.000 (9.1%)"; el POS lo mostró con
   "10 disponibles" (derivado del más escaso) y la venta V-000012 quedó en una línea con las dos
   salidas de inventario correctas.
4. Anulación de esa venta real (mismo RPC que invoca el diálogo de historial): V-000012 pasó a
   `voided` y el stock volvió exactamente a 10 y 14. Es la prueba sobre datos comprometidos, no
   dentro de una transacción revertida.

---

## 6. Bloqueos y preguntas pendientes

- [ ] **Aplicar las dos migraciones al remoto.** No se hizo: requiere decisión del dueño. Usar
      `db query --linked`, **no** `db push` (el historial remoto está desalineado).
- [ ] La extensión de Chrome se desconectó al confirmar la venta y la sesión del navegador
      expiró después; la venta y la anulación se verificaron contra la base invocando los mismos
      RPC que usa la UI. No quedó nada sin comprobar.
- [ ] Decidir si los combos deben aparecer algún día en el catálogo público (hoy excluidos a
      propósito de `storefront_productos_publicos`).

---

## 7. Próximos pasos

1. Aplicar `20260803200000` y `20260803200100` al remoto cuando el dueño lo autorice, y
   verificar allí una venta y una anulación de prueba.
2. Sugerirle al dueño crear una categoría comercial **"Combos"** para que los reportes por
   categoría los agrupen.
3. Armar los combos reales del negocio desde `/productos`.
4. Retomar PLAN-72 (corregir movimientos del turno de caja, RN-C16), que quedó abierto.

---

## 8. Notas adicionales

- El ambiente local estaba **seis migraciones atrasado**. Se puso al día con
  `supabase migration up --local`, que es no destructivo: preservó el usuario de prueba, la
  tienda demo, los productos y la caja abierta. Un `db reset` habría obligado a resembrar todo.
- El seed de opciones de proteína (`20260802144500`) inserta 0 filas en local: busca
  `BATIDO EN AGUA`/`BATIDO EN LECHE` (nombres de producción) y el batido local se llama
  `BATIDO PROTEICO QA`. No es un bug — es idempotente a propósito —, pero hay que sembrar las
  opciones a mano antes de probar cualquier cosa de ADR 0017.
- Quedó en local el combo de prueba "COMBO PROTEINA + CREATINA" (activo) y la venta V-000012 ya
  anulada, con el stock de proteína y creatina de vuelta en 10 y 14.
