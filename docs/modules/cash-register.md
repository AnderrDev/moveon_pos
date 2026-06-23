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
- RN-C06: el usuario confirma los montos no efectivo por método (`card`, `transfer`, `other`).
- RN-C07: `actual_sales_amount` se deriva de ventas efectivo confirmadas + medios no efectivo confirmados.
- RN-C08: `difference = expected_cash_amount - actual_cash_amount` mide solo descuadre de efectivo físico.
- RN-C09: `sales_difference = expected_sales_amount - actual_sales_amount` mide descuadre total de ventas del turno.
- RN-C10: diferencias mayores a $5.000 COP en efectivo físico o total ventas requieren nota de cierre.
- RN-C11: la página de caja muestra una tabla "Ventas del turno" (todas las ventas de la sesión activa, con método de pago y estado) para que el cajero/admin pueda cruzar visualmente las ventas que componen el "Esperado" antes de cerrar — no solo confiar en el agregado por método. El diálogo de cierre además muestra el número de pagos detrás de cada "Esperado" (no solo el monto), para detectar si falta o sobra una transacción.
- RN-C12: un `cash_movement` mal registrado se **anula** (`status='voided'`, `voided_by`, `voided_at`, `voided_reason`), nunca se borra ni se "corrige" con un movimiento inverso manual. Solo `admin` puede anular (`void_cash_movement_atomic`, mismo gate que `void_sale_atomic`). Los movimientos anulados quedan visibles en la UI y en el Excel del turno (marcados), pero se excluyen de `expected_cash_amount`/`difference` en `close_cash_session_atomic` y del cálculo en vivo de "Esperado en caja". Ver auditoría `docs/sessions/2026-06-19-auditoria-caja-movimientos.md`.
- RN-C13: un `cash_sessions.opening_amount` mal capturado al abrir la caja se **corrige** (no se "arregla" con `cash_movements` manuales: un movimiento neta sobre `v_movs_total` ENCIMA de `opening_amount`, RN-C03 — no puede representar "el monto de apertura en sí estaba mal"). `correct_cash_session_opening_atomic` permite la corrección **solo mientras `status = 'open'`**, sin importar cuántas ventas/movimientos ya se registraron contra la sesión (la corrección solo toca `opening_amount`; `close_cash_session_atomic` lee el valor en vivo al cerrar, así que el cuadre del cierre queda correcto automáticamente). Motivo obligatorio (mínimo 10 caracteres), monto `>= 0` y distinto del actual (rechaza no-ops). Auditado en `audit_logs` (`cash_session.opening_corrected`, `metadata` con `old_amount`/`new_amount`/`reason`). Ver incidente `docs/sessions/2026-06-23-analisis-horario-apertura-cierre.md` y plan `docs/sessions/2026-06-23-plan-44-corregir-apertura-caja.md`.

## Use cases

- `OpenCashSession`, `CloseCashSession`
- `RegisterCashMovement`, `VoidCashMovement`
- `CorrectCashSessionOpening`
- `GetCurrentSession`, `ListSessions`

## Permisos

- Caja compartida por tienda (ADR 0007): cualquier usuario activo de la tienda (admin o cajero) puede abrir la caja, vender contra la sesión abierta de su tienda, registrar movimientos y cerrarla — sin importar quién la abrió.
- Admin: ve todas las sesiones. La anulación de ventas (`void_sale_atomic`) y la anulación de movimientos de caja (`void_cash_movement_atomic`, RN-C12) siguen restringidas a admin (PLAN-15), independiente de la caja compartida — cualquier cajero puede registrar movimientos, pero no puede borrar su propio rastro.
- La corrección de apertura (`correct_cash_session_opening_atomic`, RN-C13) **NO** es admin-only: usa el mismo gate que `close_cash_session_atomic` (cualquier usuario activo de la tienda, no solo `opened_by`). A diferencia de anular un movimiento, corregir la apertura no borra rastro — el valor anterior y el nuevo quedan ambos en `audit_logs`. Restringirlo a admin reintroduciría la fricción del incidente 2026-06-22 (edición manual en la DB sin auditoría).

## Exportación Excel

- Durante una sesión abierta se puede descargar un libro del turno con resumen, ventas, productos, pagos y movimientos manuales de caja.
- La descarga usa las mismas ventas y movimientos autorizados de la sesión actual; no realiza consultas con privilegios adicionales.
- Está disponible para cualquier usuario activo que ya puede operar la caja compartida.
