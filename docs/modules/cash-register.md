# Módulo: cash-register (Caja)

## Responsabilidad
Gestión de sesiones de caja: apertura, cierre, ingresos/egresos manuales, cuadre.

## Reglas
- RN-C01: un usuario solo puede tener 1 sesión `open` a la vez (índice parcial).
- RN-C02: no se pueden registrar ventas si no hay sesión abierta.
- RN-C03: el cierre calcula automáticamente `expected_cash_amount` sumando:
  - `opening_amount`
  - + suma de pagos en efectivo de ventas de la sesión
  - + suma de `cash_movements` tipo `cash_in`
  - − suma de `cash_movements` tipo `cash_out`, `expense`
- RN-C04: `actual_cash_amount` lo ingresa el usuario al cerrar.
- RN-C05: `difference = expected - actual`. Diferencias > $5.000 COP requieren nota de cierre.

## Use cases
- `OpenCashSession`, `CloseCashSession`
- `RegisterCashMovement`
- `GetCurrentSession`, `ListSessions`

## Permisos
- Cajero: abre/cierra su propia caja, registra movimientos.
- Admin: ve todas las sesiones, puede forzar cierre en casos excepcionales.
