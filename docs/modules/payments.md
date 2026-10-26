# Módulo: payments (Pagos)

## Responsabilidad
No es un módulo independiente sustancial. Las entidades `Payment` viven dentro de `sales`. Este archivo documenta las reglas de pagos.

## Reglas
- RN-PG01: una venta puede tener N pagos (pagos mixtos).
- RN-PG02: la suma de pagos debe ser ≥ total de venta. Diferencia es cambio (solo cash).
- RN-PG03: métodos válidos: `cash`, `card`, `transfer`, `other`. `transfer` cubre Nequi, Daviplata y cualquier transferencia bancaria (no se distinguen).
- RN-PG04: pagos no-cash pueden incluir `referencia` (últimos 4 tarjeta, número aprobación, etc.).
- RN-PG05: no hay integración con datáfono; la referencia se ingresa manualmente. (Modificada por ADR 0024: el método `card` vuelve al checkout con recargo automático.)
- RN-PG06 (ADR 0024): pago con tarjeta vía Nequi Negocios. El cliente paga un recargo que cubre la comisión (1,99 % + 19 % IVA sobre la comisión, redondeo al peso en cada paso). Se cobra el menor monto cuyo neto cubra la parte de la venta pagada con tarjeta; con la tarifa actual el neto es exacto. Límites por transacción $1.500–$250.000. Cálculo en `features/sales/domain/services/card-surcharge.ts`; misma fórmula en SQL (`card_fee_amount`, `card_charge_for`, migración `20261026000100_card_surcharge.sql`) con paridad en `tests/integration/card-surcharge.parity.test.ts`.
- RN-PG07 (ADR 0024): el recargo se guarda APARTE: `payments.amount` es la parte de la venta que cubre el pago y `payments.card_surcharge` lo que se cobró de más por el datáfono; `sales.total` no incluye el recargo (`sales.card_surcharge` lo suma, con la tarifa usada en `card_fee_rate_bps` / `card_fee_iva_pct`). Así reportes, caja y la app iOS siguen sumando ventas sin recargo.
- RN-PG08 (ADR 0024): `create_sale_atomic` recalcula el recargo con la tarifa de la tienda (`card_fee_config`, `settings.data.pagoTarjeta`, por defecto 199 pb + 19 %) y rechaza la venta si no coincide con el que mostró el POS, si el pago con tarjeta no es entero o si el cobro queda fuera de $1.500–$250.000. En el POS, un pago con tarjeta no puede superar lo que falta.
- RN-PG10 (PLAN-101): el recargo se muestra aparte en la tirilla ("Recargo pago tarjeta" y "TOTAL PAGADO"; el pago con tarjeta se imprime con lo cobrado por el datáfono), en el detalle de la venta (recargo, total cobrado al cliente y pago monto + recargo, sin botón "Corregir") y en el reporte (pista de la tarjeta "Total ventas": total sin recargo + recargos aparte).
- RN-PG09 (ADR 0024): `correct_payment_atomic` no corrige un pago con recargo ni cambia un pago a tarjeta: se anula la venta y se registra de nuevo.
