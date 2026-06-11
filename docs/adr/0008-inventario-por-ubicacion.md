# ADR 0008 — Inventario separado por ubicación: Punto de Venta vs Bodega

| Campo | Valor |
|---|---|
| Fecha | 2026-05-28 |
| Estado | Aceptado |
| Decisores | Dueño del negocio (requisito) + Arquitecto (Claude) |
| Reemplaza | Amplía RN-I01 (stock = suma de movimientos por producto/tienda) |

## Contexto

Hasta hoy el inventario es **un solo pool** por `(tienda_id, producto_id)`: `get_stock` suma todos los `inventory_movements` sin distinguir dónde está físicamente la mercancía. El negocio necesita **dos inventarios separados por tienda**:

- **Punto de venta (`punto_venta`)** — lo que está en el mostrador/exhibición y desde donde se vende.
- **Bodega (`bodega`)** — stock de respaldo que no se vende directamente; se traslada al punto de venta cuando hace falta.

La mercancía nueva llega a **bodega**; el operador **traslada** a punto de venta para vender. Las ventas descuentan del **punto de venta**.

> Esto amplía el MVP "inventario simple" (`docs/01-mvp-scope.md`) por requisito explícito del dueño. Se documenta aquí como decisión arquitectónica.

## Decisión

### 1. Dimensión de ubicación en los movimientos
- Nuevo enum `inventory_location` con valores `('punto_venta', 'bodega')`.
- Nueva columna `inventory_movements.ubicacion inventory_location not null default 'punto_venta'`.
- **El stock es por `(tienda_id, producto_id, ubicacion)`** = suma de movimientos de esa ubicación.
- **Backfill:** los movimientos existentes quedan en `'punto_venta'` (vía el default), preservando la capacidad de venta actual sin disrupción. Bodega arranca vacía; el operador puede trasladar lo que quiera a bodega después.

### 2. Semántica de movimientos por ubicación
- `entry` (recepción de mercancía): **default `bodega`** (la mercancía llega a bodega). El diálogo de entrada permite elegir ubicación.
- `adjustment` (ajuste físico): el diálogo exige elegir ubicación.
- `sale_exit` (venta): siempre **`punto_venta`**. `create_sale_atomic` descuenta de punto de venta.
- `void_return` (anulación): repone a **`punto_venta`**.
- **Traslado (nuevo):** mueve stock entre ubicaciones de la misma tienda. Dos nuevos tipos de movimiento `transfer_out` (negativo, origen) y `transfer_in` (positivo, destino), insertados atómicamente con un `referencia_id` compartido por un RPC `transfer_stock_atomic`.

### 3. Validación de venta (RN-S02 ampliada)
`create_sale_atomic` valida y descuenta contra el stock de **`punto_venta`** (no el total). Una venta solo puede sacar lo que hay en el punto de venta; si no alcanza, hay que **trasladar desde bodega primero**. Productos `prepared` siguen exentos.

### 4. `get_stock`
Se agrega un 3er parámetro de ubicación con default para compatibilidad:
`get_stock(p_producto_id, p_tienda_id, p_ubicacion inventory_location default 'punto_venta')` → suma filtrada por ubicación. (El default conserva el comportamiento de cualquier llamador que aún no pase ubicación, pero todos los callers nuevos la pasan explícita.)

### 5. UI
- **Inventario:** la tabla muestra **dos columnas de stock: Punto de venta y Bodega** (y total) por producto. Nueva acción **"Trasladar"** (bodega↔punto de venta). Entrada y Ajuste agregan **selector de ubicación**. El kardex muestra la **ubicación** de cada movimiento.
- **POS:** el tope de stock (`stock-cap`) y la disponibilidad mostrada usan el stock de **punto de venta**.
- **Reportes (pestaña Stock):** desglose por ubicación (PV / Bodega / Total); "Stock bajo" se evalúa sobre el **punto de venta** (es lo vendible). `prepared` sigue excluido.

### 6. Bajo stock (RN ampliada de PLAN-14)
"Stock bajo" se calcula sobre el stock de **punto de venta** vs `stock_minimo` (es lo que importa para no quedarse sin vender). `prepared` sigue exento.

## Mecánica de migración (de-risking del enum)

Para evitar el problema de Postgres "usar un valor de enum recién agregado con `ALTER TYPE ... ADD VALUE` en la misma transacción", se parte en **dos migraciones**:

1. `20260529_001_inventory_locations.sql` — `create type inventory_location`; `alter type inventory_movement_type add value if not exists 'transfer_in'` y `'transfer_out'`; `alter table inventory_movements add column ubicacion ... default 'punto_venta'`; índice por `(tienda_id, producto_id, ubicacion)`; redefine `get_stock` con el 3er parámetro. **No usa** los nuevos valores de movimiento (solo los agrega + agrega la columna). `inventory_location` sí se usa (es `create type`, disponible de inmediato).
2. `20260529_002_inventory_location_rpcs.sql` — (transacción separada, los enum values ya están commiteados) `create or replace` de `create_sale_atomic` (descuenta `punto_venta`, set `ubicacion`), `void_sale_atomic` (repone a `punto_venta`), y nuevo `transfer_stock_atomic`.

## Consecuencias

**Positivas**
- Control real de mercancía: separa lo expuesto de lo guardado; evita vender lo que no está en el mostrador.
- Trazabilidad: cada movimiento sabe su ubicación; traslados auditables.
- Compatibilidad: el default y el backfill no rompen las ventas actuales.

**Negativas / costos**
- Cambio en el modelo central de inventario (alto impacto, requiere pruebas exhaustivas — es la razón del endurecimiento de pruebas que acompaña esta historia).
- El operador ahora debe **trasladar bodega→punto de venta** para vender lo recibido; cambio de flujo operativo (documentar en manual).
- Dos RPCs críticas (`create_sale_atomic`, `void_sale_atomic`) se reescriben + una nueva (`transfer_stock_atomic`).

## Reglas de negocio derivadas
- **RN-I07:** todo `inventory_movements` lleva `ubicacion` (`punto_venta` | `bodega`).
- **RN-I08:** la mercancía nueva (`entry`) entra por defecto a `bodega`.
- **RN-I09:** las ventas descuentan de `punto_venta`; la validación de stock es contra `punto_venta`.
- **RN-I10:** el traslado mueve stock entre ubicaciones de la misma tienda atómicamente (no puede dejar negativo el origen).
- **RN-I11:** "stock bajo" se evalúa sobre `punto_venta`.
