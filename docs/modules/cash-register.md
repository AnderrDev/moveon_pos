# Módulo: cash-register (Caja)

## Responsabilidad
Gestión de sesiones de caja: apertura, cierre, ingresos/egresos manuales, cuadre.

## Reglas
- RN-C01: un usuario solo puede tener 1 sesión `open` a la vez (índice parcial).
- RN-C02: no se pueden registrar ventas si no hay sesión abierta.
- RN-C03: el cierre calcula automáticamente `expected_cash_amount` (efectivo físico esperado) sumando:
  - `opening_amount`
  - + suma de pagos en efectivo de ventas de la sesión
  - + suma de `cash_movements` tipo `cash_in`
  - − suma de `cash_movements` tipo `cash_out`, `expense`
- RN-C04: el cierre calcula automáticamente `expected_sales_amount` como total de ventas completadas de la sesión, sumando todos los medios de pago.
- RN-C05: `actual_cash_amount` lo ingresa el usuario al cerrar como efectivo físico contado en el cajón.
- RN-C06: el usuario confirma los montos no efectivo por método (`card`, `nequi`, `daviplata`, `transfer`, `other`).
- RN-C07: `actual_sales_amount` se deriva de ventas efectivo confirmadas + medios no efectivo confirmados.
- RN-C08: `difference = expected_cash_amount - actual_cash_amount` mide solo descuadre de efectivo físico.
- RN-C09: `sales_difference = expected_sales_amount - actual_sales_amount` mide descuadre total de ventas del turno.
- RN-C10: diferencias mayores a $5.000 COP en efectivo físico o total ventas requieren nota de cierre.

## Use cases
- `OpenCashSession`, `CloseCashSession`
- `RegisterCashMovement`
- `GetCurrentSession`, `ListSessions`

## Permisos
- Cajero: abre/cierra su propia caja, registra movimientos.
- Admin: ve todas las sesiones, puede forzar cierre en casos excepcionales.
