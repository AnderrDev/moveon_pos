# ADR 0018 — Combos y promociones como producto con componentes

| Campo | Valor |
|---|---|
| Fecha | 2026-08-03 |
| Estado | **Aceptado** (2026-08-03) — implementado en PLAN-73 |
| Decisores | Dueño del negocio (regla comercial) + Arquitecto (Claude) |
| Relacionado | ADR 0017 (opciones de producto), `docs/modules/products.md`, `docs/modules/inventory.md`, `docs/modules/sales.md` (RN-S07, RN-S09), migraciones `20260803200000_product_type_combo.sql` y `20260803200100_combo_support.sql` |

---

## 1. Contexto

El dueño quiere armar promociones combinando productos —"proteína + shaker por $250.000"— y
ponerles un precio especial. Hoy no hay ninguna forma de hacerlo: el POS solo ofrece descuentos
manuales línea a línea (RN-S09), lo que obliga al cajero a recordar el monto exacto en cada
venta y deja el ticket con un descuento suelto sin explicación.

Restricciones del sistema actual:

1. **`create_sale_atomic` es la autoridad de precios.** Recalcula todo desde
   `productos.precio_venta` e ignora lo que manda Angular. Cualquier precio de combo tiene que
   existir en el servidor (misma restricción que motivó ADR 0017).
2. **Ya existe el mecanismo de "vender algo que consume otra cosa":** `product_components` +
   el trigger `tg_consume_sale_components`, que usan los batidos (`tipo = 'prepared'`) para
   descontar el vaso y el sachet sin llevar stock propio.
3. El guarda `tipo <> 'prepared'` está repetido en el camino del dinero (validación de stock,
   `sale_exit`, `void_return`) — cualquier tipo nuevo sin stock propio tiene que pasar por ahí.

Decisiones de producto tomadas por el dueño antes de diseñar:

- El combo es **un producto más del catálogo**, con precio fijo propio y **una sola línea en el
  ticket**. No líneas separadas con un descuento prorrateado.
- El precio se captura **directo** (el precio final del combo), no como porcentaje ni monto de
  descuento.
- **Sin vigencia**: se activa y desactiva con `is_active`, como cualquier producto.
- **Solo POS**: el catálogo público no cambia.

### Alternativas descartadas

| Alternativa | Por qué no |
|---|---|
| Reutilizar `tipo = 'prepared'` para los combos | Cero cambios en SQL, pero la UI llamaría "Preparado" a los combos, los reportes de batidos quedarían contaminados y el seed de opciones de proteína (`where p.tipo = 'prepared'`) los alcanzaría. El ahorro no compensa mentir en el modelo. |
| Líneas individuales con descuento automático prorrateado | Reusa el motor de descuentos existente sin tocar el esquema, pero el ticket muestra los productos a precio lleno y un descuento suelto al lado — exactamente el "cargo suelto" que el dueño ya rechazó en ADR 0017 §1. Además contamina `discount_total` y la traza de RN-S09 con algo que no es un descuento discrecional. |
| Motor de promociones que detecta combinaciones en el carrito | Es lo más potente ("si lleva proteína y shaker, aplica X"), pero exige un evaluador de reglas en cliente y servidor, y resolver conflictos entre promociones. Desproporcionado para 1 sede y 50-100 ventas/día. |
| Tabla `promotions` + `promotion_items` propia | Duplica `product_components` con otro nombre. Un combo ya *es* "un producto que consume otros"; el modelo existente lo expresa sin inventar uno nuevo. |

## 2. Decisión

### 2.1 Modelo: un valor nuevo de `product_type`

Se agrega `'combo'` al enum `public.product_type` (`simple | prepared | ingredient | combo`).
Un combo es un producto normal salvo por dos cosas:

- **No rastrea stock propio.** Al venderlo no se genera `sale_exit` sobre él.
- **Consume sus productos incluidos** vía `product_components`, la misma tabla y el mismo
  trigger que usan los batidos. No se creó ninguna tabla nueva.

El precio vive donde vive el de cualquier producto: `productos.precio_venta`. Con eso
`create_sale_atomic` cobra el combo correctamente **sin tocar su lógica de precios** — solo hubo
que enseñarle que el combo, como el batido, no descuenta stock de sí mismo.

La migración del enum va **sola en su propio archivo**: Postgres no permite usar un valor de
enum recién agregado dentro de la misma transacción que lo agrega, y el CLI de Supabase corre
cada migración en una.

### 2.2 El guarda `tipo <> 'prepared'` pasa a `not in ('prepared','combo')`

Seis puntos en SQL, todos inventariados en la migración `20260803200100_combo_support.sql`:
`create_sale_atomic` (validación de stock y `sale_exit`), `tg_consume_sale_components`,
`void_sale_atomic`, `create_product_with_initial_stock` y la vista
`storefront_productos_publicos` (que además excluye los combos: solo POS).

En TypeScript el espejo es `tracksOwnStock(tipo)` en `src/shared/lib/product-type.ts`. Si SQL y
TS dejan de coincidir, el POS mostraría un stock que el servidor no valida.

### 2.3 Disponibilidad derivada, no stock propio

`deriveComboStock` calcula cuántos combos se pueden armar: `min(floor(stock / cantidad))` sobre
los productos incluidos. El POS lo publica como `stockDisponible`, así que el combo topa la
cantidad del carrito y muestra "N disponibles" como cualquier producto, reutilizando
`stock-cap.ts` sin cambios.

**El servidor sigue permisivo**: no bloquea la venta por falta de componentes, igual que con los
batidos (ADR 0017 §2.4, "advertir, no bloquear"). El tope es del cliente. Riesgo aceptado: con
el caché desactualizado el stock de un componente puede quedar negativo — queda visible en
inventario, no silencioso. Bloquear en el RPC habría exigido validar N componentes bajo advisory
lock dentro del camino del dinero, y el dueño opera una sola caja.

### 2.4 Qué NO aplica a un combo

- **Opciones de venta (ADR 0017).** Un combo se vende tal cual; el diálogo de opciones sigue
  siendo exclusivo de los preparados.
- **Anidamiento.** Un combo no puede contener otro combo ni un batido: ninguno de los dos
  rastrea stock propio, así que incluirlos generaría un movimiento sobre un producto sin
  inventario. Lo impide `filterComboItemCandidates`.
- **Importación por CSV.** El importador de Siigo rechaza `tipo = combo` con un mensaje
  explícito: un combo sin componentes se vendería sin descontar nada, y el CSV no puede
  expresar qué lleva dentro.
- **Inventario inicial.** `create_product_with_initial_stock` lo rechaza, igual que a los
  preparados.

Lo que **sí** funciona sin cambios: descuentos manuales (el tope por línea se compara contra el
precio del combo), MOVE ON Club (`participa_fidelizacion` es una columna del producto) y la
anulación.

### 2.5 Ayuda de precio y costo automático en el formulario

Al armar el combo, el formulario muestra en vivo `Suma normal · Precio del combo · Ahorro (%)`
con `combo-pricing.ts`. Es solo apoyo de captura para que el dueño vea cuánto está descontando:
lo que se persiste es un único `precio_venta` y el servidor cobra eso. Un combo más caro que la
suma muestra "sin ahorro" en vez de un porcentaje negativo.

El **costo sí se calcula automáticamente**: al agregar o quitar un producto incluido, el campo
`costo` se reescribe con `sumComboItemCost` (la suma de `costo × cantidad` de lo que consume).
Es la definición correcta del costo de un combo, y evita que el dueño lo calcule a mano y
falsee el margen.

Dos decisiones deliberadas:

- **Se dispara desde `addComponent`/`removeComponent`, no desde un `effect`.** Un efecto
  reactivo pisaría el costo guardado al abrir un combo existente, apenas terminara de cargar la
  lista de componentes. Así el valor persistido se respeta hasta que se toque la lista.
- **El campo queda editable**, con una nota que explica de dónde sale el número. Un combo puede
  tener costo extra (empaque, bolsa) que el catálogo no conoce.

Si algún producto incluido no tiene costo registrado, suma $0 y la nota lo advierte por nombre:
el margen se vería mejor de lo que es y eso no puede pasar en silencio.

## 3. Deuda saldada: la anulación devuelve los componentes

Hasta hoy `void_sale_atomic` **no devolvía al stock los componentes consumidos** — deuda
conocida y documentada en ADR 0017 §Consecuencias. Con batidos el faltante era un vaso; con un
combo sería una proteína de $180.000, así que se corrigió en la misma migración: al anular se
generan `void_return` por los componentes fijos **y** por el componente de la opción elegida
(cerrando la deuda completa, no solo la parte de combos). No hay doble devolución posible: el
combo o el batido en sí nunca generó `sale_exit`.

## 4. Consecuencias

**A favor**

- Cero tablas nuevas y cero cambios en la lógica de precios del RPC.
- El ticket muestra una línea limpia, que es lo que pidió el dueño.
- El inventario se mueve solo, con el mecanismo ya probado de los batidos.
- El dueño arma y despublica combos desde el formulario, sin sesión de desarrollo.

**En contra / riesgos**

- Se tocó `create_sale_atomic` y `void_sale_atomic`, ambos en el camino del dinero. Mitigado con
  pruebas end-to-end en el stack local (venta y anulación de un combo, más no-regresión de un
  batido con opción de proteína).
- Un valor de enum no se puede quitar fácilmente si el modelo cambia.
- El stock del combo es derivado: si el caché del POS está viejo, el tope puede quedar corto o
  largo por unos segundos.
- Los reportes que agrupen por `tipo` ahora tienen una categoría más. Se recomienda además crear
  una categoría comercial "Combos" para los reportes por categoría.
