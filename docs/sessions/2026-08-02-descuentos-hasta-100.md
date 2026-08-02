# Spec de Sesión — 2026-08-02 — Descuentos de hasta el 100% + opciones de proteína del batido

---

## Metadatos

| Campo | Valor |
|---|---|
| Fecha | 2026-08-02 |
| Sprint | Sprint 4 |
| Agente | Claude Code |
| HUs trabajadas | RN-S09 (regla de negocio de descuentos, módulo sales) |
| Estado | Completada (código + migración aplicada al proyecto remoto) |

---

## 1. Objetivo de la sesión

Petición del dueño: **"debemos dejar pasar descuentos del 100%"**.

Estado previo: el descuento discrecional estaba topado al 50% del subtotal para el rol
`cajero` (antes 10%, subido a 50% el 2026-06-23). El RPC `create_sale_atomic` lanzaba
`Descuentos mayores al 50% requieren aprobación de admin` y el POS bloqueaba el botón de
confirmar con el mismo mensaje. El `admin` ya podía pasar del 50%, así que el bloqueo real
lo sufría el cajero.

---

## 2. Lo que se implementó

### 2.1 Archivos creados
- `supabase/migrations/20260802125014_allow_full_discount.sql` — recrea
  `create_sale_atomic` (cuerpo idéntico a `20260714225231_loyalty_move_on_club.sql`)
  eliminando el tope del 50% para `cajero`. Conserva la traza:
  `discount_approved_by` se sigue firmando cuando un admin descuenta más del 50%.
- `docs/sessions/2026-08-02-descuentos-hasta-100.md` — este spec.

### 2.2 Archivos modificados
- `apps/pos-angular/src/app/features/sales/domain/services/sale-calculator.ts` —
  `validateDiscountAuthorization`: umbral por defecto `0.5` → `1`; mensaje nuevo
  `El descuento no puede superar el 100% del subtotal` (solo se dispara ante un estado
  imposible, queda como red de seguridad del invariante).
- `apps/pos-angular/src/app/features/pos/presentation/services/pos-cart.store.ts` —
  se extrajo `itemsForTotals` (ítems con el canje ya aplicado) y se añadió
  `effectiveGlobalDiscount`: el descuento global recortado al total disponible.
- `apps/pos-angular/src/app/features/pos/presentation/pages/pos.page.ts` —
  se envía `effectiveGlobalDiscount()` al RPC en vez del monto crudo; se quitó el
  texto "Descuentos mayores al 50% requieren un administrador" del panel de cobro.
- `tests/unit/features/sales/sale-calculator.test.ts` — casos de 100% y de rechazo
  solo por encima del subtotal.
- `docs/modules/sales.md` — RN-S09 actualizada.

### 2.3 Archivos eliminados
- Ninguno.

---

## 3. Decisiones tomadas

| Decisión | Alternativa descartada | Razón |
|---|---|---|
| Quitar el tope por rol en vez de subirlo a otro número | Subir el tope a 90% / 99% | El 100% es un caso real (cortesía, reposición, promoción): la venta queda en $0 y debe registrarse igual. Ya hubo dos subidas de umbral (10 → 50); poner otro número invita a una tercera. |
| Mantener el límite estructural (línea ≤ precio, global ≤ total disponible) | Permitir descuentos por encima del total | Un descuento mayor al total generaría ventas negativas y rompería IVA y arqueo de caja. |
| Conservar `discount_approved_by` cuando un admin descuenta > 50% | Quitar la marca | Es la única traza de "esto fue una decisión de alguien con mando"; el reporte de control de descuentos la usa. |
| No firmar `discount_approved_by` para el cajero | Firmar con el propio cajero | `approved_by` significa "un admin lo aprobó"; auto-firmarlo lo volvería ruido. La trazabilidad del cajero ya está en `cashier_id` + motivo + `audit_logs`. |
| Recortar el descuento global antes de enviarlo al RPC | Dejarlo como estaba | El POS ya mostraba el total en $0, pero enviaba el monto crudo: si había además descuentos de línea, el RPC respondía `El descuento global no puede superar el total disponible`. Era el segundo motivo por el que un 100% no pasaba. |

El motivo del descuento (mínimo 3 caracteres) **sigue siendo obligatorio**: es lo que
sostiene el control cuando ya no hay tope.

---

## 4. ADRs creados o actualizados

- Ninguno. Es un cambio de parámetro de regla de negocio (RN-S09), no de arquitectura.
  Documentado en `docs/modules/sales.md`.

---

## 5. Tests

- [x] `pnpm typecheck` — pasó
- [x] `pnpm lint` — pasó (All files pass linting)
- [x] `pnpm test` — 616 tests pasaron, 0 fallaron (68 archivos)

---

## 6. Bloqueos y preguntas pendientes

- **Migración aplicada al remoto** (decisión del dueño, 2026-08-02) con
  `supabase db query --linked -f` y registrada en `supabase_migrations.schema_migrations`
  (`20260802125014 / allow_full_discount`). Verificado en `pg_proc`: el cuerpo nuevo está
  vivo y el `raise` del tope del 50% ya no existe.
- No se probó en local: Docker no estaba corriendo, así que la validación funcional
  quedó pendiente de una prueba manual (ver próximos pasos).
- **Ojo con `supabase db push`**: hay 8 migraciones locales que el remoto no tiene
  (`20260624000100/200`, `20260710000100/200`, `20260716000100/200`, `20260723010000/020000`).
  Varias ya están aplicadas por fuera con otro timestamp (ej. las de fidelización, que en
  el remoto figuran como `20260717224803/224819`). Un `db push` a ciegas las reejecutaría.
  Por eso esta migración se aplicó con `db query` y se registró a mano.
- El token válido para el CLI es `~/.supabase/access-token.pos`; el de la variable de
  entorno `SUPABASE_ACCESS_TOKEN` y el de `~/.supabase/access-token` devuelven 401. El MCP
  de Supabase tampoco tiene permiso sobre este proyecto.

---

## 7. Próximos pasos

1. Prueba manual en el POS: venta con descuento global del 100% → total $0, confirmar sin
   registrar pago, verificar `sales.total = 0`, `discount_total = subtotal` y el
   movimiento de inventario de cada línea.
2. Verificar cómo se ve una venta de $0 en el reporte de control de descuentos y en el
   arqueo de caja (no debe alterar el efectivo esperado).
3. Cuando Docker vuelva a estar arriba, alinear el historial de migraciones local vs
   remoto (las 8 pendientes de arriba) para poder volver a usar `db push`.

---

## 9. Segunda tarea — Opciones de proteína del batido (PLAN-71, ADR 0017)

### 9.1 Petición

"Al vender un batido se debe poder seleccionar el tipo de proteína: CH+ es la de por defecto y
mantiene el precio; con Bipro aumenta $2.000; con Best Whey aumenta $1.000."

Decisiones del dueño durante la sesión:
- El recargo va **en la misma línea del batido** (un batido con Bipro es un batido de $15.000),
  no como línea suelta de recargo.
- Las opciones y sus precios son **administrables desde la app**, no fijos en código.
- **Sí** debe descontar inventario: solo hay sachet de Bipro y de Best Whey; CH+ se sirve del
  tarro y por ahora no se descuenta (queda mapeable desde la app).
- Aplica a `BATIDO EN AGUA` y `BATIDO EN LECHE`. Los cafés quedan fuera.

### 9.2 Restricción que definió el diseño

`create_sale_atomic` recalcula precio, IVA y totales desde `productos.precio_venta` e ignora lo
que manda Angular. Un recargo aplicado en el cliente se habría descartado en silencio: el
recargo **tenía** que existir en el servidor. De ahí la tabla `product_options` y el cambio en
el RPC, en vez de aritmética en el POS.

### 9.3 Archivos creados

- `docs/adr/0017-opciones-de-producto-en-la-venta.md` — decisión, alternativas descartadas y
  consecuencias.
- `supabase/migrations/20260802143900_product_options.sql` — tabla `product_options` con RLS
  (lectura para la tienda, escritura solo admin), 3 columnas nuevas en `sale_items`,
  `create_sale_atomic` con precio efectivo, `tg_consume_sale_components` con el componente de
  la opción.
- `supabase/migrations/20260802144500_seed_batido_protein_options.sql` — las 6 opciones,
  resueltas por nombre de producto (idempotente, sirve en local y en remoto).
- `apps/pos-angular/src/app/features/pos/presentation/dialogs/product-option.dialog.ts`
- `apps/pos-angular/src/app/features/products/data/models/product-option.mapper.ts`
- `apps/pos-angular/src/app/features/products/domain/usecases/save-product-options.use-case.ts`
- `tests/unit/features/products/product-options.test.ts` — 6 tests del use-case.

### 9.4 Archivos modificados

- POS: `pos.types.ts`, `pos-data.service.ts` (carga opciones), `pos-cart.store.ts`
  (`key = productId:optionId`, `option` en la línea), `pos.page.ts` (diálogo + opción visible
  en el carrito), `pos-sale.service.ts` (manda `option_id`).
- Venta: `sale.entity.ts`, `sale.mapper.ts`, `sales.repository.ts` (columnas nuevas),
  `esc-pos-receipt.builder.ts` (`BATIDO EN LECHE (Bipro)`), `sale-detail-list.component.ts` y
  `sales-history.dialog.ts` (opción visible en el historial).
- Productos: `product.repository.ts` (contrato `getOptions`/`saveOptions`),
  `products.repository.ts` (implementación), `product-component.helpers.ts`
  (`filterOptionComponentCandidates`), `product-form.dialog.ts` (sección "Opciones de venta").
- Docs: `docs/modules/sales.md` (RN-S14), `docs/plan-de-trabajo.md` (PLAN-71).

### 9.5 Decisiones de implementación

| Decisión | Alternativa descartada | Razón |
|---|---|---|
| Tabla genérica `product_options` con `grupo` | Enum de proteínas fijo | El dueño cambia precios sin desarrollo, y el mismo modelo sirve para tamaño de café o leche vegetal sin volver a tocar el RPC. |
| `unit_price` guarda el precio **con** recargo | Guardar base y sumar en cada consumidor | `unit_price × quantity` sigue cuadrando con el total de la línea: ticket, historial y reportes no necesitan aritmética nueva. `option_extra` queda como desglose. |
| Snapshots `option_nombre`/`option_extra` en `sale_items` | Solo el `option_id` | Una venta pasada no puede cambiar porque alguien renombró la opción o le subió el precio (mismo criterio que `producto_nombre`). |
| Quitar una opción la **desactiva** | Borrar y reinsertar (como hace `saveComponents`) | `sale_items.option_id` referencia esas filas; borrarlas dejaría el `option_id` de ventas pasadas en `null`. Se hace upsert por la clave natural (producto, grupo, nombre). |
| La opción es parte de `PosCartItem.key` | Una línea por producto | Dos batidos con proteína distinta tienen precio distinto y consumen inventario distinto: son dos líneas. |
| Renombrado `LoyaltyRedemptionEntry.productId` → `itemKey` | Dejarlo como estaba | El campo siempre guardó la `key` de la línea, no el id del producto. Mientras `key === productId` la confusión era inocua; con opciones, `pos-sale.service` habría buscado la línea del canje por el campo equivocado. |

### 9.6 Estado en el remoto

Ambas migraciones **aplicadas y verificadas** (2026-08-02) con
`supabase db query --linked -f`, previo ensayo en seco dentro de una transacción revertida
(que confirmó sintaxis y que el seed mapea los 2 batidos × 3 opciones con los sachets
correctos). Registradas en `supabase_migrations.schema_migrations`. Verificación posterior:
`product_options` = 6 filas, `sale_items` con las 3 columnas, RPC y trigger con el código nuevo.

### 9.7 Pendiente de esta tarea

1. **Prueba manual en el POS** (no se pudo: Docker abajo, sin stack local): vender un batido con
   cada proteína y confirmar precio, ticket, historial y el `sale_exit` del sachet en inventario.
2. Decidir si CH+ debe descontar del tarro (`ISO CH+ 2LB`) y con qué cantidad — hoy queda sin
   componente, configurable desde el formulario del producto.
3. **Deuda conocida (preexistente, no introducida aquí):** `void_sale_atomic` no devuelve
   componentes al anular. Anular un batido nunca devolvió el vaso; ahora tampoco devuelve el
   sachet. Vale la pena cerrarlo en una sesión dedicada a anulaciones.

---

## 8. Notas adicionales

- El ticket ESC/POS y el historial ya soportan total $0; el DTO de venta ya permitía cero
  pagos cuando el total es 0 (venía del canje MOVE ON Club, RN-LF).
- `sale-error-mapper.ts` conserva la entrada
  `Descuentos mayores al 50% requieren aprobación de admin`: queda como red por si el
  cliente habla con una base que todavía no tiene la migración.
