# Spec de Sesión — 2026-04-26 — Sprint 3: POS + Ventas

---

## Metadatos

| Campo | Valor |
|---|---|
| Fecha | 2026-04-26 |
| Sprint | Sprint 3 |
| Agente | Claude Code |
| HUs trabajadas | HU-13, HU-14, HU-17, HU-18, HU-19, HU-20 |
| Estado | Completada (parcial — ver pendientes) |

---

## 1. Objetivo de la sesión

Implementar la pantalla del Punto de Venta (`/pos`) con: búsqueda de productos, carrito, modal de pago con métodos múltiples, validación de caja abierta y stock, y confirmación de venta con feedback al cajero.

---

## 2. Lo que se implementó

### 2.1 Archivos creados

**Dominio — cálculo de ventas:**
- `src/modules/sales/domain/services/sale-calculator.ts` — funciones puras: `calculateCartItem`, `calculateCartTotals`, `calculateChange` con IVA correcto por ítem

**Dominio — repositorio:**
- `src/modules/sales/domain/repositories/sale.repository.ts` — interfaz `SaleRepository` con `create`, `findById`, `listBySession`, `listByDate`, `void`

**Infraestructura:**
- `src/modules/sales/infrastructure/mappers/sale.mapper.ts` — rows DB → `Sale`, `SaleItem`, `Payment`
- `src/modules/sales/infrastructure/repositories/supabase-sale.repository.ts` — secuencia de 4 inserts: sale → sale_items → payments → inventory_movements (sale_exit). Idempotencia por `idempotency_key`.

**Aplicación:**
- `src/modules/sales/application/dtos/sale.dto.ts` — schemas Zod: `createSaleSchema`, `voidSaleSchema`
- `src/modules/sales/application/actions/sale.actions.ts` — `createSaleAction` (verifica caja + stock antes de crear), `voidSaleAction` (solo admin)

**Estado del carrito:**
- `src/modules/sales/store/cart.store.ts` — Zustand store con: `addItem`, `removeItem`, `updateQuantity`, `updateDiscount`, `addPayment`, `removePayment`, `clearCart`, `totalPaid`, `remainingAmount`

**Componentes:**
- `src/modules/sales/components/CartPanel.tsx` — panel lateral del carrito con controles de cantidad y totales
- `src/modules/sales/components/PaymentModal.tsx` — modal de cobro con múltiples métodos, atajo de monto exacto, cálculo de cambio en tiempo real
- `src/modules/sales/components/SaleSuccessModal.tsx` — confirmación post-venta con cambio al cliente
- `src/modules/sales/components/PosScreen.tsx` — composición del POS completo (Client Component)

### 2.2 Archivos modificados

- `src/app/(app)/pos/page.tsx` — Server Component que verifica caja abierta y renderiza `PosScreen` o mensaje de caja cerrada

---

## 3. Decisiones tomadas

| Decisión | Alternativa descartada | Razón |
|---|---|---|
| 4 inserts secuenciales (sin transaction) | RPC con BEGIN/COMMIT | RPC requeriría nueva migración; para MVP el riesgo de inconsistencia es bajo dado el volumen (50-100 ventas/día) |
| Idempotencia vía `idempotency_key` (`sessionId-timestamp`) | UUID aleatorio | Si el cliente reintenta por error de red, el mismo key evita duplicar la venta |
| Zustand para carrito | useState + prop-drilling | El carrito se comparte entre `PosScreen`, `CartPanel` y `PaymentModal` sin relación padre-hijo directa |
| `IvaRate` aplicado por ítem (no sobre total) | IVA sobre subtotal global | Correcto fiscalmente y permite productos con distintas tasas (0%, 5%, 19%) en la misma venta |
| Número de venta `YYMMDD-XXXXX` (timestamp truncado) | Secuencia en DB | Evita necesidad de sequence/trigger extra; suficiente para volumen esperado |

---

## 4. HUs implementadas vs. pendientes

| HU | Descripción | Estado |
|---|---|---|
| HU-13 | Pantalla `/pos` con búsqueda dual | ✅ |
| HU-14 | Agregar/editar productos al carrito | ✅ |
| HU-15 | Descuento por ítem | ✅ (store listo, falta UI en CartPanel) |
| HU-16 | Seleccionar cliente opcional | ⏳ (campo en DTO, falta UI) |
| HU-17 | Modal de pago múltiple | ✅ |
| HU-18 | Calcular cambio efectivo | ✅ |
| HU-19 | Confirmar venta con bloqueo si caja cerrada | ✅ |
| HU-20 | Validar stock antes de confirmar | ✅ |
| HU-21 | Anular venta (admin) | ✅ server action, falta UI en historial |
| HU-22 | Historial de ventas del día | ⏳ (use-case listo, falta página) |

---

## 5. Tests

- [x] `pnpm typecheck` — pasó (0 errores)
- [x] `pnpm lint` — pasó (0 warnings)
- [ ] `pnpm test` — pendiente tests unitarios para `sale-calculator.ts`

---

## 6. Próximos pasos

1. **UI de descuento por ítem** — botón en `CartPanel` que abre un input inline para `discountAmount`
2. **Historial de ventas** (`/pos` o nueva ruta) — tabla de ventas del turno con botón "Anular"
3. **Tests unitarios** para `sale-calculator.ts` (funciones puras — fáciles de testear):
   ```ts
   // tests/unit/modules/sales/sale-calculator.test.ts
   describe('calculateCartItem', () => {
     it('calcula IVA 19% sobre base neta', () => ...)
     it('aplica descuento antes de IVA', () => ...)
   })
   ```
4. **Regenerar tipos DB**: `pnpm db:types` para tener tipado de `get_stock` RPC
5. **Sprints 4-5**: Reportes, clientes, facturación electrónica (ver `docs/user-stories/sprint-04.md`)

---

## 7. Notas arquitectónicas

**Flujo de creación de venta (sin transacción DB):**
```
Server Action: createSaleAction
  1. getAuthContext() → tiendaId, userId
  2. Verificar caja abierta (SupabaseCashRegisterRepository.getOpenSession)
  3. Verificar stock por ítem (SupabaseInventoryRepository.getStock)
  4. SupabaseSaleRepository.create():
     a. INSERT sales → saleId
     b. INSERT sale_items (batch)
     c. INSERT payments (batch)
     d. INSERT inventory_movements tipo='sale_exit' cantidad negativa (batch)
  5. revalidatePath('/pos'), revalidatePath('/inventario')
```

**Limitación conocida:** si el paso 4d falla, la venta queda en DB sin movimientos de inventario. Para v1.1 migrar a una función PL/pgSQL transaccional.
