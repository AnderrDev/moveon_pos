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
  id: string
  tiendaId: string
  cashSessionId: string
  saleNumber: string
  clienteId: string | null
  clienteNombre: string | null
  cashierId: string
  cashierEmail: string | null
  items: SaleItem[]
  payments: Payment[]
  subtotal: Money
  discountTotal: Money
  taxTotal: Money
  total: Money
  status: 'completed' | 'voided'
  billingStatus: BillingStatus
  billingDocumentId: string | null
  voidedBy: string | null
  voidedAt: Date | null
  voidedReason: string | null
  idempotencyKey: string
  createdAt: Date
}
```

### `SaleItem`

```typescript
type SaleItem = {
  productoId: string
  productoNombre: string // snapshot
  productoSku: string | null // snapshot
  quantity: number
  unitPrice: Money
  discountAmount: Money
  taxRate: number // ej: 19, 5, 0
  taxAmount: Money
  total: Money
}
```

### `Payment`

```typescript
type Payment = {
  metodo: 'cash' | 'card' | 'transfer' | 'other'
  amount: Money
  referencia: string | null
}
```

> El negocio solo acepta `cash` y `transfer` (2026-06-30). `card` y `other` se
> conservan en el tipo/BD por compatibilidad con datos históricos, pero ningún
> selector de la UI (modal de pago, corrección, cierre de caja, filtros) los
> ofrece — ver `src/shared/lib/payment-methods.ts`.

---

## Reglas de negocio (no negociables)

### RN-S01: Caja abierta obligatoria

No se puede crear una venta si el usuario no tiene una `cash_session` con status `open` en la tienda activa.

### RN-S02: Stock disponible

No se puede vender una cantidad mayor al stock disponible en `punto_venta` para productos `simple` o `ingredient`. Productos `prepared` (batidos) en MVP no validan stock (se asume preparación bajo demanda).

### RN-S03: Total = suma de pagos

La suma de todos los `payments.amount` debe ser **mayor o igual** al `total` de la venta. Si es mayor, la diferencia es el cambio (solo aplica para método `cash`).

### RN-S04: Idempotencia

Toda creación de venta requiere `idempotencyKey`. Si llega una segunda request con el mismo key, se devuelve la venta original sin crear una nueva.

### RN-S05: Snapshot de producto

`producto_nombre` y `producto_sku` se copian al `sale_item` en el momento de la venta. No se obtienen por join después.

### RN-S06: Inmutabilidad post-creación

Una venta `completed` no se puede editar. Solo se puede anular (que crea registros adicionales pero no modifica los originales, excepto los campos `voided_*` y `status`), o corregir vía las RPC de corrección auditada (ver RN-S13): `correct_payment_atomic` (`payments.metodo`) y `correct_sale_customer_atomic` (`sales.cliente_id`, solo si era `null`).

### RN-S07: Anulación reversa el inventario

Al anular una venta, por cada `sale_item` se crea un `inventory_movement` tipo `void_return` con cantidad positiva.

### RN-S08: Permisos

- Cajero: puede crear ventas, no puede anular.
- Admin: puede anular ventas dentro de la sesión actual de caja del cashier original (si la sesión ya cerró, requiere reapertura manual o ajuste contable).

### RN-S09: Descuentos

- Todo descuento exige un motivo operativo de mínimo 3 caracteres.
- El cajero puede aplicar hasta el 50% del subtotal bruto (subido desde 10% el 2026-06-23). La RPC rechaza cualquier monto superior.
- El admin puede aplicar descuentos superiores; `sales.discount_approved_by` conserva la aprobación.
- `sales.item_discount_total` y `sales.global_discount_total` separan el origen del descuento; su suma debe ser igual a `discount_total`.
- El descuento global se prorratea entre líneas en `sale_items.global_discount_amount` para reconciliar total e IVA.
- Toda venta con descuento crea el evento `sale.discount_applied` en `audit_logs`, con porcentaje, desglose, motivo y aprobador.
- `create_sale_atomic` recalcula precios, IVA y totales desde `productos`; no confía en los valores calculados por Angular.

### RN-S10: Cálculo de IVA

`producto.precio_venta` es el precio final al consumidor e incluye IVA. El IVA se extrae por ítem según
`producto.iva_tasa` para discriminarlo en ventas, reportes y tickets, sin sumarlo nuevamente al total.
El IVA total de la venta es la suma de los IVAs incluidos por ítem después de aplicar el descuento
directo y la parte prorrateada del descuento global.

### RN-S11: Usuario responsable

Cada venta registra obligatoriamente el `cashier_id` del usuario autenticado y un snapshot de su correo en `cashier_email`. La base valida que el usuario coincida con la sesión Auth y tenga acceso activo a la tienda; el cliente no puede atribuir la venta a otro usuario.

### RN-S12: Historial operativo del turno

El historial del turno muestra por venta: productos y cantidades, precios, descuentos, IVA incluido, total, pagos y referencias, cambio entregado, cliente, usuario responsable, fecha, estado y motivo de anulación. El cambio histórico se reconstruye como `max(0, suma de pagos - total)`.

### RN-S13: Asociar cliente retroactivamente (2026-07-23)

Si el cajero olvidó asociar el cliente en el cobro, un admin puede corregirlo después vía `correct_sale_customer_atomic(sale_id, tienda_id, cliente_id, corrected_by, reason)` — mismo patrón que `correct_payment_atomic` (rol admin, motivo mínimo 10 caracteres, evento en `audit_logs`).

- **Alcance acotado a propósito:** solo funciona si `sales.cliente_id` era `null`. Reasignar de un cliente A a un cliente B no está soportado (revertir los sellos ya otorgados a A es un caso distinto, fuera de este alcance) — el RPC rechaza la venta si ya tiene cliente.
- **Sellos retroactivos del Club MOVE ON:** si algún `sale_item` participaba en fidelización (misma elegibilidad que `create_sale_atomic`: sin descuento de línea ni global, RN-LF01/02/05 en `docs/modules/loyalty.md`), el RPC otorga esos sellos en la misma transacción, sujeto a que el cliente esté activo, haya autorizado fidelización, y el programa siga activo. Si no cumple, el cliente queda asociado pero sin sellos.
- **Idempotente:** un segundo intento sobre la misma venta falla (ya tiene cliente) — no puede otorgar sellos dos veces. `loyalty_transactions` tiene una restricción única por `sale_id` para `type = 'earn'` que además protege contra doble conteo si esta corrección coincidiera alguna vez con un reintento de `create_sale_atomic`.
- **Nota:** `participa_fidelizacion` se evalúa contra el estado *actual* del producto — `sale_items` no guarda una foto histórica de ese flag (igual que el ajuste manual de sellos, RN-LF16).
- **UI:** botón "Asociar cliente" en el detalle de la venta (`/caja` → Ventas del turno), visible solo cuando la venta está `completed` y sin cliente. Reusa `CustomerPickerDialog` (búsqueda) + un diálogo de motivo dedicado (`CorrectSaleCustomerDialog`).

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
   - Insert `inventory_movements` tipo `sale_exit` en `punto_venta` por cada ítem (cantidad negativa).
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
  saleId: string
  reason: string
}
```

**Flujo:**

1. Verificar permiso (RN-S08).
2. Verificar venta existe y status `completed`.
3. Si tiene `billing_document` aceptado → crear nota crédito (en v1.1+, en MVP solo permite anular ventas sin facturación).
4. Transacción DB:
   - Update `sales` set `status='voided'`, `voided_*`.
   - Insert `inventory_movements` tipo `void_return` en `punto_venta` por cada ítem.
   - Insert `audit_log`.

### `GetSaleUseCase`, `ListSalesUseCase`

Lecturas paginadas con filtros.

---

## Repositorio (interfaz)

```typescript
export interface SaleRepository {
  findById(id: string): Promise<Sale | null>
  findByIdempotencyKey(key: string): Promise<Sale | null>
  findByCashSession(sessionId: string): Promise<Sale[]>
  list(filters: SaleFilters): Promise<Paginated<Sale>>
  save(sale: Sale): Promise<void>
  void(saleId: string, voidedBy: string, reason: string): Promise<void>
  getNextSaleNumber(tiendaId: string): Promise<string>
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

## Exportación Excel

- “Ventas del turno” descarga un libro con hojas de resumen, ventas, productos, pagos y movimientos de caja.
- Cada venta conserva número, estado, cliente, usuario responsable, totales, cambio y motivo de anulación.
- Las líneas de producto y pagos se exportan por separado para facilitar filtros y conciliación.
- Las ventas anuladas se incluyen con su estado, pero no se suman al total efectivo del resumen.
