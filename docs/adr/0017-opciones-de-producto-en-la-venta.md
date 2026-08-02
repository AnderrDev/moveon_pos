# ADR 0017 — Opciones de producto en la venta (tipo de proteína del batido)

| Campo | Valor |
|---|---|
| Fecha | 2026-08-02 |
| Estado | **Aceptado** (2026-08-02) — implementado en PLAN-71 |
| Decisores | Dueño del negocio (regla comercial) + Arquitecto (Claude) |
| Relacionado | ADR 0013 (MOVE ON Club), `docs/modules/sales.md` (RN-S09, RN-S10), `docs/modules/products.md`, migración `20260615000500_product_components.sql` |

---

## 1. Contexto

Los batidos (`BATIDO EN AGUA` $11.000, `BATIDO EN LECHE` $13.000, tipo `prepared`) se preparan
con una proteína a elección del cliente. Directriz del dueño (2026-08-02):

- **CH+** es la proteína por defecto y **no cambia el precio**.
- **Bipro** suma **$2.000**.
- **Best Whey** suma **$1.000**.

Además, el inventario debe reflejar qué se consumió: hay sachet de Bipro y sachet de Best Whey
en stock; CH+ se sirve del tarro y hoy no se descuenta.

Restricciones del sistema actual:

1. **`create_sale_atomic` es la autoridad de precios.** Recalcula precio, IVA y totales desde
   `productos.precio_venta` e ignora los valores que manda Angular (defensa contra
   manipulación del cliente). Cualquier recargo tiene que existir en el servidor.
2. **`product_components` es estático por producto.** El trigger `tg_consume_sale_components`
   descuenta siempre los mismos componentes (hoy: el vaso). No sabe distinguir variantes.
3. Una línea de carrito hoy se identifica solo por `producto_id` (`key = productId`), así que
   dos batidos con proteínas distintas colapsarían en una sola línea.

Alternativas descartadas:

| Alternativa | Por qué no |
|---|---|
| Un producto por combinación (`BATIDO EN LECHE BIPRO`, …) | 6 productos para 2 batidos; el POS se llena de botones casi iguales y los reportes de "batidos vendidos" quedan fragmentados. No hay selección, hay duplicación. |
| Línea aparte de recargo (`RECARGO PROTEÍNA BIPRO` $2.000) | No toca el RPC del dinero (más barato y menos riesgoso), pero el ticket y los reportes muestran el batido a $13.000 y un cargo suelto al lado; el vínculo batido↔recargo queda implícito y no sirve para descontar la proteína correcta. Descartada por el dueño. |
| Recargo calculado en Angular sobre `unit_price` | Imposible: el RPC recalcula desde `productos` y descartaría el recargo. |

## 2. Decisión

### 2.1 Modelo: opciones por producto (`product_options`)

Una tabla nueva `public.product_options` declara, por producto, un conjunto de opciones
mutuamente excluyentes agrupadas por `grupo` (para los batidos, el grupo es `Proteína`):

```
product_options
  id, tienda_id, producto_id
  grupo                -- 'Proteína' (etiqueta del selector en el POS)
  nombre               -- 'CH+' | 'Bipro' | 'Best Whey'
  precio_extra         -- 0 | 2000 | 1000  (recargo por unidad, >= 0)
  componente_id        -- producto de inventario que se descuenta (nullable)
  componente_cantidad  -- cuántas unidades por batido
  es_default, orden, is_active
```

Es la generalización natural de `product_components` (que ya modela "qué consume este
preparado"), con dos añadidos: el recargo y el hecho de ser **elegible en la venta**.

**Por qué una tabla y no un enum/constante:** el dueño debe poder cambiar precios y agregar
proteínas sin una sesión de desarrollo. Se administra desde el formulario de producto, junto a
los componentes consumibles, que ya vive ahí.

### 2.2 La opción viaja en la línea de venta

`sale_items` gana tres columnas:

- `option_id` — referencia a la opción elegida (`on delete set null`).
- `option_nombre` — **snapshot** del nombre al momento de la venta.
- `option_extra` — **snapshot** del recargo unitario aplicado.

Los snapshots son deliberados: una venta pasada no puede cambiar porque alguien renombró la
opción o le subió el precio (mismo criterio que `producto_nombre`/`unit_price`, que ya se
copian en `sale_items`).

### 2.3 El precio efectivo se calcula en el servidor

`create_sale_atomic` recibe `option_id` dentro de cada ítem de `p_items` y calcula:

```
precio_unitario_efectivo = productos.precio_venta + product_options.precio_extra
```

Ese valor es el que alimenta subtotal, IVA, descuentos y total — el resto del RPC no cambia.
`unit_price` en `sale_items` guarda el precio efectivo (base + recargo), de modo que
`unit_price × quantity` sigue cuadrando con el total de la línea sin lógica adicional en
tickets, historial ni reportes. `option_extra` queda al lado como desglose informativo.

Validaciones del RPC:

- La opción debe pertenecer al producto, a la tienda y estar activa; si no → `Opción no válida`.
- Si el producto tiene opciones activas y el cliente no manda ninguna, se usa la opción
  `es_default` (compatibilidad hacia atrás: una venta sin `option_id` sigue siendo válida).
- El tope de descuento por línea pasa a compararse contra el precio efectivo, no contra
  `precio_venta`.

### 2.4 El inventario lo descuenta el trigger existente

`tg_consume_sale_components` ya descuenta los componentes fijos del preparado. Se le agrega un
paso: si `sale_items.option_id` tiene `componente_id`, genera un `inventory_movement` de tipo
`sale_exit` por `componente_cantidad × quantity`.

Se mantiene la política vigente de componentes: **advertir, no bloquear** — el stock del sachet
puede quedar negativo, igual que el del vaso. Un batido no se cae por falta de sachet.

Mapeo inicial: Bipro → `BIPRO CLASSIC VAINILLA SACHET 26G` ×1; Best Whey →
`BEST WHEY VAINILLA SACHET` ×1; **CH+ sin componente** (se sirve del tarro y hoy no se mide por
batido). CH+ queda mapeable desde la app el día que decidan medirlo.

### 2.5 En el POS, la opción es parte de la identidad de la línea

`PosCartItem.key` pasa de `productId` a `productId` + `:optionId` cuando hay opción. Dos batidos
con proteína distinta son dos líneas; dos batidos con la misma proteína se acumulan en una.

Al tocar un producto con opciones activas, el POS abre un diálogo de selección con el default
preseleccionado. Un toque más por batido, que es el costo real de la funcionalidad.

## 3. Consecuencias

**A favor**

- El batido con Bipro se vende, se imprime y se reporta como lo que es: un batido de $15.000.
- El dueño ajusta precios y opciones sin desarrollo.
- El inventario de sachets se descuenta solo.
- El modelo sirve para cualquier preparado futuro (tamaño de café, leche vegetal, etc.) sin
  tocar el RPC de nuevo.

**En contra / riesgos**

- Toca `create_sale_atomic`, que es el camino del dinero. Mitigado: el cambio se concentra en
  el cálculo del precio unitario y una validación; el resto del cuerpo se conserva idéntico.
- Un toque adicional en el flujo de venta más frecuente del negocio.
- **`void_sale_atomic` no devuelve componentes al anular** (limitación preexistente: anular un
  batido tampoco devuelve el vaso). El sachet hereda esa limitación. Queda registrado como
  deuda conocida, no se resuelve aquí para no cambiar el comportamiento de anulación en la
  misma sesión que se toca la venta.

**Neutro**

- MOVE ON Club no cambia: el batido genera un sello por unidad elegible sin importar la
  proteína, y el canje sigue aplicando sobre la línea (RN-LF08: si el batido con recargo cuesta
  más que la recompensa, el cliente paga la diferencia — que es justo el comportamiento
  deseado).
