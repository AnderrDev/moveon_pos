# Módulo: cash-register (Caja)

## Responsabilidad

Gestión de sesiones de caja: apertura, cierre, ingresos/egresos manuales, cuadre.

## Reglas

- RN-C01: una **tienda** solo puede tener 1 sesión `open` a la vez (índice parcial `ux_one_open_session_per_tienda`). La caja es **compartida**: cualquier usuario activo de la tienda (admin o cajero) vende y cierra contra la única sesión abierta. `opened_by` registra quién la abrió (auditoría); `cashier_id` por venta registra quién vendió. Ver ADR 0007.
- RN-C02: no se pueden registrar ventas si no hay sesión abierta.
- RN-C03: el cierre calcula automáticamente `expected_cash_amount` (efectivo físico esperado) sumando:
  - `opening_amount`
  - - suma de pagos en efectivo de ventas de la sesión
  - - suma de `cash_movements` tipo `cash_in`
  - − suma de `cash_movements` tipo `cash_out`, `expense`
- RN-C04: el cierre calcula automáticamente `expected_sales_amount` como total de ventas completadas de la sesión, sumando todos los medios de pago.
- RN-C05: `actual_cash_amount` lo ingresa el usuario al cerrar como efectivo físico contado en el cajón.
- RN-C06: el usuario confirma los montos no efectivo por método (`card`, `nequi`, `daviplata`, `transfer`, `other`).
- RN-C07: `actual_sales_amount` se deriva de ventas efectivo confirmadas + medios no efectivo confirmados.
- RN-C08: `difference = expected_cash_amount - actual_cash_amount` mide solo descuadre de efectivo físico.
- RN-C09: `sales_difference = expected_sales_amount - actual_sales_amount` mide descuadre total de ventas del turno.
- RN-C10: diferencias mayores a $5.000 COP en efectivo físico o total ventas requieren nota de cierre.
- RN-C11: la página de caja muestra una tabla "Ventas del turno" (todas las ventas de la sesión activa, con método de pago y estado) para que el cajero/admin pueda cruzar visualmente las ventas que componen el "Esperado" antes de cerrar — no solo confiar en el agregado por método. El diálogo de cierre además muestra el número de pagos detrás de cada "Esperado" (no solo el monto), para detectar si falta o sobra una transacción.

## Use cases

- `OpenCashSession`, `CloseCashSession`
- `RegisterCashMovement`
- `GetCurrentSession`, `ListSessions`

## Permisos

- Caja compartida por tienda (ADR 0007): cualquier usuario activo de la tienda (admin o cajero) puede abrir la caja, vender contra la sesión abierta de su tienda, registrar movimientos y cerrarla — sin importar quién la abrió.
- Admin: ve todas las sesiones. La anulación de ventas (`void_sale_atomic`) sigue restringida a admin (PLAN-15), independiente de la caja compartida.

## Exportación Excel

- Durante una sesión abierta se puede descargar un libro del turno con resumen, ventas, productos, pagos y movimientos manuales de caja.
- La descarga usa las mismas ventas y movimientos autorizados de la sesión actual; no realiza consultas con privilegios adicionales.
- Está disponible para cualquier usuario activo que ya puede operar la caja compartida.
