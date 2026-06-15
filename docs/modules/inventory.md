# Módulo: inventory (Inventario)

## Responsabilidad

Mantener el stock de productos por tienda y ubicación física. Toda variación pasa por `inventory_movements`. **Nunca** se modifica un campo `stock` directamente.

---

## Reglas de negocio

### RN-I01: Stock como suma de movimientos

El stock de un producto en una tienda y ubicación es:

```sql
SELECT COALESCE(SUM(cantidad), 0) FROM inventory_movements
WHERE producto_id = $1 AND tienda_id = $2 AND ubicacion = $3;
```

Implementado como función `get_stock(producto_id, tienda_id, ubicacion default 'punto_venta') RETURNS numeric`. El default conserva compatibilidad y representa el stock vendible.

### RN-I02: Tipos de movimiento

- `entry`: cantidad positiva. Entrada de mercancía.
- `sale_exit`: cantidad **negativa**. Salida por venta.
- `adjustment`: cantidad positiva o negativa. Ajuste manual con motivo obligatorio.
- `void_return`: cantidad positiva. Reposición por venta anulada.
- `transfer_out`: cantidad negativa. Salida de la ubicación origen en un traslado.
- `transfer_in`: cantidad positiva. Entrada a la ubicación destino en un traslado.

### RN-I07: Ubicaciones

- `punto_venta`: stock físico disponible para vender.
- `bodega`: stock de respaldo que no se vende directamente.

La mercancía nueva (`entry`) entra por defecto a `bodega`; las ventas (`sale_exit`) descuentan de `punto_venta`; anulaciones (`void_return`) reponen a `punto_venta`.

El alta de producto puede crear opcionalmente un movimiento `entry` inicial mediante `create_product_with_initial_stock`. La creación del producto y el movimiento son atómicos y quedan asociados por `referencia_tipo = 'product_initial_stock'`.

### RN-I08: Traslados

Los traslados entre `bodega` y `punto_venta` son atómicos vía `transfer_stock_atomic`: insertan `transfer_out` y `transfer_in` con el mismo `referencia_id`, no permiten dejar negativo el origen y en MVP solo los ejecuta `admin`.

### RN-I03: Motivo obligatorio para `adjustment`

Todo movimiento `adjustment` requiere `motivo` con mínimo 10 caracteres.

### RN-I04: Permisos

- Cajero: solo puede generar movimientos `sale_exit` vía venta.
- Admin: puede anular ventas (`void_return`), crear `entry`, `adjustment` y traslados.

### RN-I05: Auditoría

Todo `adjustment` deja entrada en `audit_logs`.

### RN-I06: Stock no puede ser negativo en consultas

Aunque la suma matemática puede dar negativo (si hubo ajuste por inventario físico), la UI muestra `max(stock, 0)` y advierte.

---

## Use cases

- `RegisterEntryUseCase` — admin registra entrada de mercancía.
- `AdjustInventoryUseCase` — admin ajusta stock con motivo.
- `GetStockUseCase` — calcula stock actual por ubicación.
- `ListLowStockUseCase` — productos con stock < stock_minimo.
- `GetMovementsUseCase` — kardex paginado.
- `TransferStockUseCase` — valida y delega traslado entre ubicaciones.

---

## Repositorio

```typescript
export interface InventoryRepository {
  recordMovement(movement: InventoryMovement): Promise<void>
  recordMovementsBatch(movements: InventoryMovement[]): Promise<void>
  getStock(productoId: string, tiendaId: string, ubicacion?: InventoryLocation): Promise<number>
  getStockBulk(productoIds: string[], tiendaId: string): Promise<Map<string, number>>
  listMovements(filters: MovementFilters): Promise<Paginated<InventoryMovement>>
  listLowStock(tiendaId: string): Promise<LowStockProduct[]>
  transferStock(params: TransferStockParams): Promise<string>
}
```

---

## Importación masiva (v1.0 inicial)

Para cargar stock inicial desde Siigo, se usa el importador CSV. Cada fila genera un movimiento tipo `entry` en `bodega` con motivo "Stock inicial migración Siigo".

---

## Testing

- Suma correcta de movimientos mixtos.
- Ajustes negativos funcionan.
- Permisos: cajero no puede crear `entry`.
- Stock bulk de N productos en una sola query.

## Exportación Excel

- Inventario descarga las filas filtradas con stock por ubicación, total, mínimo y alerta.
- El kardex descarga todos los movimientos cargados del producto, con fecha, ubicación, cantidad, costo y motivo.
- La funcionalidad permanece restringida a `admin` porque el módulo de inventario usa `roleGuard('admin')`.
