# Módulo: sales (Ventas)

> El módulo más crítico del sistema. Cualquier cambio aquí requiere tests exhaustivos.

---

## Responsabilidad

Registrar ventas completas, calcular totales, descontar inventario, registrar pagos y opcionalmente disparar facturación electrónica.

---

## Entidades del dominio

### `Sale`
```typescript
type Sale = {
  id: string;
  tiendaId: string;
  cashSessionId: string;
  saleNumber: string;
  clienteId: string | null;
  cashierId: string;
  items: SaleItem[];
  payments: Payment[];
  subtotal: Money;
  discountTotal: Money;
  taxTotal: Money;
  total: Money;
  status: 'completed' | 'voided';
  billingStatus: BillingStatus;
  billingDocumentId: string | null;
  voidedBy: string | null;
  voidedAt: Date | null;
  voidedReason: string | null;
  idempotencyKey: string;
  createdAt: Date;
};
```

### `SaleItem`
```typescript
type SaleItem = {
  productoId: string;
  productoNombre: string;     // snapshot
  productoSku: string | null; // snapshot
  quantity: number;
  unitPrice: Money;
  discountAmount: Money;
  taxRate: number;            // ej: 19, 5, 0
  taxAmount: Money;
  total: Money;
};
```

### `Payment`
```typescript
type Payment = {
  metodo: 'cash' | 'card' | 'nequi' | 'daviplata' | 'transfer' | 'other';
  amount: Money;
  referencia: string | null;
};
```

---

## Reglas de negocio (no negociables)

### RN-S01: Caja abierta obligatoria
No se puede crear una venta si el usuario no tiene una `cash_session` con status `open` en la tienda activa.

### RN-S02: Stock disponible
No se puede vender una cantidad mayor al stock disponible para productos `simple` o `ingredient`. Productos `prepared` (batidos) en MVP no validan stock (se asume preparación bajo demanda).

### RN-S03: Total = suma de pagos
La suma de todos los `payments.amount` debe ser **mayor o igual** al `total` de la venta. Si es mayor, la diferencia es el cambio (solo aplica para método `cash`).

### RN-S04: Idempotencia
Toda creación de venta requiere `idempotencyKey`. Si llega una segunda request con el mismo key, se devuelve la venta original sin crear una nueva.

### RN-S05: Snapshot de producto
`producto_nombre` y `producto_sku` se copian al `sale_item` en el momento de la venta. No se obtienen por join después.

### RN-S06: Inmutabilidad post-creación
Una venta `completed` no se puede editar. Solo se puede anular (que crea registros adicionales pero no modifica los originales, excepto los campos `voided_*` y `status`).

### RN-S07: Anulación reversa el inventario
Al anular una venta, por cada `sale_item` se crea un `inventory_movement` tipo `void_return` con cantidad positiva.

### RN-S08: Permisos
- Cajero: puede crear ventas, no puede anular.
- Admin: puede anular ventas dentro de la sesión actual de caja del cashier original (si la sesión ya cerró, requiere reapertura manual o ajuste contable).

### RN-S09: Descuentos
- Cajero puede aplicar descuentos hasta cierto umbral configurable (default 10%).
- Mayor a ese umbral requiere rol admin o aprobación documentada en `audit_logs`.

### RN-S10: Cálculo de IVA
IVA se calcula por ítem según `producto.iva_tasa`. El IVA total de la venta es la suma de IVAs por ítem.

---

## Use cases

### `CreateSaleUseCase`
**Input (Zod):**
```typescript
{
  idempotencyKey: string;
  cashSessionId: string;
  clienteId?: string;
  items: Array<{
    productoId: string;
    quantity: number;
    discountAmount?: number;
  }>;
  payments: Array<{
    metodo: PaymentMethod;
    amount: number;
    referencia?: string;
  }>;
  totalDiscountAmount?: number; // descuento global adicional
}
```

**Flujo:**
1. Validar input con Zod.
2. Verificar idempotencia (consultar por `idempotencyKey`).
3. Verificar caja abierta (RN-S01).
4. Verificar stock disponible para items no `prepared` (RN-S02).
5. Calcular subtotal, IVA, descuentos, total por ítem y total general.
6. Verificar suma de pagos (RN-S03).
7. Generar `saleNumber` correlativo por tienda.
8. Transacción DB:
   - Insert `sales`.
   - Insert `sale_items`.
   - Insert `payments`.
   - Insert `inventory_movements` tipo `sale_exit` por cada ítem (cantidad negativa).
9. Devolver `Sale` completa.

**Errores posibles (Result.error):**
- `CashSessionNotOpen`
- `InsufficientStock { productoId, available, requested }`
- `PaymentTotalMismatch { total, paymentsSum }`
- `DiscountNotAuthorized`
- `ProductNotFound`

### `VoidSaleUseCase`
**Input:**
```typescript
{
  saleId: string;
  reason: string;
}
```

**Flujo:**
1. Verificar permiso (RN-S08).
2. Verificar venta existe y status `completed`.
3. Si tiene `billing_document` aceptado → crear nota crédito (en v1.1+, en MVP solo permite anular ventas sin facturación).
4. Transacción DB:
   - Update `sales` set `status='voided'`, `voided_*`.
   - Insert `inventory_movements` tipo `void_return` por cada ítem.
   - Insert `audit_log`.

### `GetSaleUseCase`, `ListSalesUseCase`
Lecturas paginadas con filtros.

---

## Repositorio (interfaz)

```typescript
export interface SaleRepository {
  findById(id: string): Promise<Sale | null>;
  findByIdempotencyKey(key: string): Promise<Sale | null>;
  findByCashSession(sessionId: string): Promise<Sale[]>;
  list(filters: SaleFilters): Promise<Paginated<Sale>>;
  save(sale: Sale): Promise<void>;
  void(saleId: string, voidedBy: string, reason: string): Promise<void>;
  getNextSaleNumber(tiendaId: string): Promise<string>;
}
```

---

## RLS

```sql
-- Solo lectura de ventas de tienda del usuario
CREATE POLICY "read_own_tienda_sales" ON sales
  FOR SELECT USING (
    tienda_id IN (SELECT tienda_id FROM user_tiendas WHERE user_id = auth.uid() AND is_active = true)
  );

-- Crear ventas: solo si hay sesión abierta para el usuario
-- (validación adicional en use case)
CREATE POLICY "create_sales_with_open_session" ON sales
  FOR INSERT WITH CHECK (
    tienda_id IN (SELECT tienda_id FROM user_tiendas WHERE user_id = auth.uid() AND is_active = true)
    AND cashier_id = auth.uid()
  );

-- Update: solo admin (para anulación)
-- (validación adicional en use case por rol)
CREATE POLICY "update_sales_admin_only" ON sales
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_tiendas
      WHERE user_id = auth.uid()
        AND tienda_id = sales.tienda_id
        AND rol = 'admin'
        AND is_active = true
    )
  );
```

---

## Testing

### Unitarios obligatorios
- Cálculo de totales con IVA mixto (productos con 19%, 5%, 0%).
- Aplicación de descuentos por ítem y global.
- Validación de pagos mixtos.
- Error cuando suma de pagos < total.
- Idempotencia: mismo key devuelve misma venta.

### Integración obligatorios
- Crear venta + verificar `inventory_movements` insertados correctamente.
- Anular venta + verificar reposición de stock.
- Crear venta sin caja abierta → error.
- Crear venta con stock insuficiente → error.
