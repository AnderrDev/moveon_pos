# Módulo: inventory (Inventario)

## Responsabilidad

Mantener el stock de productos por tienda. Toda variación pasa por `inventory_movements`. **Nunca** se modifica un campo `stock` directamente.

---

## Reglas de negocio

### RN-I01: Stock como suma de movimientos
El stock de un producto en una tienda es:
```sql
SELECT COALESCE(SUM(cantidad), 0) FROM inventory_movements
WHERE producto_id = $1 AND tienda_id = $2;
```

Implementado como función `get_stock(producto_id, tienda_id) RETURNS numeric`.

### RN-I02: Tipos de movimiento
- `entry`: cantidad positiva. Entrada de mercancía.
- `sale_exit`: cantidad **negativa**. Salida por venta.
- `adjustment`: cantidad positiva o negativa. Ajuste manual con motivo obligatorio.
- `void_return`: cantidad positiva. Reposición por venta anulada.

### RN-I03: Motivo obligatorio para `adjustment`
Todo movimiento `adjustment` requiere `motivo` con mínimo 10 caracteres.

### RN-I04: Permisos
- Cajero: solo puede generar movimientos `sale_exit` (vía venta) y `void_return` (vía anulación).
- Admin: puede crear `entry` y `adjustment`.

### RN-I05: Auditoría
Todo `adjustment` deja entrada en `audit_logs`.

### RN-I06: Stock no puede ser negativo en consultas
Aunque la suma matemática puede dar negativo (si hubo ajuste por inventario físico), la UI muestra `max(stock, 0)` y advierte.

---

## Use cases

- `RegisterEntryUseCase` — admin registra entrada de mercancía.
- `AdjustInventoryUseCase` — admin ajusta stock con motivo.
- `GetStockUseCase` — calcula stock actual.
- `ListLowStockUseCase` — productos con stock < stock_minimo.
- `GetMovementsUseCase` — kardex paginado.

---

## Repositorio

```typescript
export interface InventoryRepository {
  recordMovement(movement: InventoryMovement): Promise<void>;
  recordMovementsBatch(movements: InventoryMovement[]): Promise<void>;
  getStock(productoId: string, tiendaId: string): Promise<number>;
  getStockBulk(productoIds: string[], tiendaId: string): Promise<Map<string, number>>;
  listMovements(filters: MovementFilters): Promise<Paginated<InventoryMovement>>;
  listLowStock(tiendaId: string): Promise<LowStockProduct[]>;
}
```

---

## Importación masiva (v1.0 inicial)

Para cargar stock inicial desde Siigo, se usa `RegisterEntryUseCase` masivamente con CSV. Cada fila genera un movimiento tipo `entry` con motivo "Stock inicial migración Siigo".

---

## Testing

- Suma correcta de movimientos mixtos.
- Ajustes negativos funcionan.
- Permisos: cajero no puede crear `entry`.
- Stock bulk de N productos en una sola query.
