# ADR 0019 — Costo capturado en la línea de venta

| Campo | Valor |
|---|---|
| Fecha | 2026-08-04 |
| Estado | **Aceptado** (2026-08-04) — implementado en PLAN-74 |
| Decisores | Dueño del negocio + Arquitecto (Claude) |
| Relacionado | ADR 0017 (opciones de producto), ADR 0018 (combos), `docs/modules/reports.md`, migración `20260804030000_sale_item_unit_cost.sql` |

---

## 1. Contexto

La utilidad se calculaba con el costo **actual** del catálogo (`productos.costo`), no con el
que el producto tenía cuando se vendió. `sale_items` nunca guardó el costo. La consecuencia:
actualizar el costo de un producto **reescribía retroactivamente el margen de todos los períodos
pasados**.

Estaba documentado como limitación aceptada de v1 en `docs/modules/reports.md`, con la solución
ya anticipada: *"si esto se vuelve un problema real, la solución sería una migración que agregue
`sale_items.unit_cost` capturado por `create_sale_atomic`"*.

Se volvió un problema real al implementar los combos (ADR 0018), por dos razones:

1. **El costo de un combo es derivado.** Se calcula sumando el costo de sus productos incluidos
   y se guarda en `productos.costo`, pero nada lo propaga: si el proveedor sube la proteína, el
   combo sigue reportando el costo viejo. No era solo el margen histórico el que estaba mal —
   **el de hoy también**.
2. **El error estaba en tres lugares, no en uno.** Además del reporte de productos
   (`reports.repository.ts`), lo heredaban la utilidad neta de Finanzas (que suma los
   `costoTotal` del reporte) y el COGS del fondo de reinversión, este último calculado en SQL
   dentro de `get_reinvestment_fund_totals`.

### Alternativas descartadas

| Alternativa | Por qué no |
|---|---|
| Recalcular el costo del combo al abrir el formulario | Es un parche de captura: depende de que alguien entre a mirar, y no arregla el margen histórico de ningún producto. Se implementó igual, pero como comodidad, no como solución |
| Calcular el costo del combo al vuelo en el reporte | Corrige el margen actual de los combos pero no el histórico de nada, obliga al reporte a tratar los combos distinto del resto y deja el mismo bug en el COGS del fondo de reinversión |
| Vista materializada de márgenes | Resuelve rendimiento, no corrección: seguiría leyendo el costo actual |

## 2. Decisión

### 2.1 `sale_items.unit_cost`, resuelto en el servidor

Una columna nueva, `numeric(14,2)` nullable, que `create_sale_atomic` llena en el momento de la
venta. Igual que el precio y el recargo de la opción (ADR 0017), **el costo lo determina el
servidor**: el cliente nunca lo manda.

### 2.2 Cómo se costea cada tipo de producto

| Tipo | Costo de la línea |
|---|---|
| `simple`, `ingredient` | `productos.costo` |
| `combo` | Suma de `costo × cantidad` de sus productos incluidos, leída en la venta |
| `prepared` | `productos.costo` (hoy normalmente nulo) |

La regla detrás de la tabla: **se costea desde los componentes cuando esa lista es la lista
completa de materiales.**

En un combo lo es — un combo *es* exactamente los productos que lo componen. En un batido no:
sus `product_components` son el vaso y, si aplica, el sachet de la opción, pero **la proteína
base sale del tarro y no se mide por batido** (ADR 0017 §2.4). Sumar solo sus componentes daría
un costo parcial presentado como total, e inflaría el margen de los batidos en silencio.

Por eso los preparados se quedan como estaban: sin costo capturado, muestran "—" y quedan fuera
de la utilidad. Es una ausencia honesta en vez de un número engañoso. Costear los batidos exige
antes una decisión de negocio que nadie ha tomado: cuánto cuesta una porción servida del tarro.

### 2.3 Nulo significa desconocido, nunca cero

Si a un combo le falta el costo de **cualquier** producto incluido, la línea entera queda en
`null`. Es la misma regla que ya regía en los reportes —nunca asumir costo 0— aplicada al nivel
de línea.

La agregación por producto la respeta: si a una sola de las líneas del período le falta el
costo, el producto completo reporta utilidad desconocida en vez de una suma incompleta.

### 2.4 Consecuencias en la lectura

- El costo unitario que muestra el reporte pasa a ser un **promedio ponderado** del período: el
  costo pudo cambiar entre una venta y otra, así que ya no existe "el costo" de un producto.
- El reporte diario **dejó de cargar el catálogo completo**: solo lo consultaba para armar el
  mapa de costos. Una consulta menos por reporte.
- `get_reinvestment_fund_totals` lee `si.unit_cost` y ya no une con `productos`.
- `productos.costo` de un combo queda como valor **informativo** (lista de productos, Excel del
  catálogo, sugerencia al armarlo). Deja de ser la fuente de verdad del margen.

### 2.5 Backfill

Las líneas anteriores a la migración se rellenaron con el costo actual del catálogo: es
exactamente lo que los reportes ya venían mostrando para ellas. No mejora esas filas, pero
tampoco las empeora ni hace desaparecer el histórico de la UI. **Las ventas anteriores al
2026-08-04 siguen siendo aproximaciones**; de ahí en adelante el costo es el real.

## 3. Consecuencias

**A favor**

- El margen de un período pasado deja de cambiar cuando se actualiza un costo.
- Los combos reportan margen correcto, que era imposible antes.
- Se corrigen de una sola vez los tres consumidores (reporte, Finanzas y fondo de reinversión).
- Una consulta menos por carga del reporte diario.
- El cálculo de utilidad, que **no tenía ningún test**, quedó cubierto.

**En contra / riesgos**

- Se volvió a tocar `create_sale_atomic`, el camino del dinero.
- El histórico previo al backfill sigue siendo aproximado y no hay forma de recuperarlo: nadie
  guardó esos costos.
- Los batidos siguen sin costo. Es deliberado, pero significa que una parte del negocio no
  aparece en la utilidad hasta que se decida cuánto cuesta una porción de proteína del tarro.
