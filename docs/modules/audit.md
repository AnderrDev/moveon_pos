# Módulo: audit (Auditoría)

## Responsabilidad

Registro de quién hizo qué, cuándo y con qué detalle (`audit_logs`), y la pantalla `/auditoria` (solo admin) para consultarlo.

## Cómo se escribe un registro

Conviven dos convenciones (no se migran los históricos):

| Origen | `action` | `entity_type` | Detalle en |
|---|---|---|---|
| App web / iOS (`AuditLogRepository.log`) | `create`, `update`, `void`, `open`, `transfer`... | `venta`, `producto`, `cliente`, `sesion_caja`, `movimiento_inventario`... | `changes` |
| Funciones y triggers de la base | `sale.voided`, `cash_session.closed`, `inventory.adjusted`, `expense.created`... | `sale`, `product`, `payment`, `cash_session`, `cash_movement`, `expense`, `loyalty_account`... | `metadata` |

Reglas (2026-10-24, `20261024190000`):

- **Trigger `tr_audit_logs_enrich` (BEFORE INSERT):** completa `user_id` (con `auth.uid()`), `user_email` (desde `auth.users`) y `entity_label` (con `audit_entity_label`) cuando vienen vacíos o cuando el nombre es un id. Ninguna RPC necesita mandarlos.
- **`audit_entity_label(tipo, id)`:** nombre legible de la entidad: producto → nombre; venta/pago → número de venta; caja → "Caja del DD/MM/AAAA HH:MM"; movimiento de caja → motivo; movimiento o traslado de inventario → producto; cliente/cuenta de fidelización → nombre del cliente; gasto → concepto. Solo la usan triggers y migraciones (sin EXECUTE para el cliente).
- **Sin duplicados:** si una RPC ya audita un evento, la app no lo vuelve a registrar (anular venta, anular/corregir movimiento de caja, corregir apertura, cierre de caja, ajuste de stock). La app iOS aún escribe `void`/`adjust` propios (pendiente en su repo).
- **Ediciones con antes → después:** editar producto o cliente guarda solo los campos que cambiaron como `{ campo: { from, to } }` (`src/shared/lib/audit-diff.ts`); guardar sin cambios no audita.
- **Eventos auditados por la base:** venta anulada, descuento, corrección de pago/cliente, cierre (con base, esperado, contado, diferencias, retiro y nota), corrección de apertura, movimiento de caja anulado/corregido, entrada de inventario y corrección de su costo, ajuste de stock (con ubicación), cambio de precio/costo, receta y opciones, cliente eliminado, sellos ajustados, gasto creado (`expense.created`) y anulado.
- **Histórico:** `20261024200000_backfill_audit_logs.sql` rellena correo y nombre de registros antiguos (solo campos vacíos; el nombre es el actual de la entidad).

## Pantalla

- `domain/services/audit-modules.ts`: módulos (Ventas, Caja, Inventario, Productos, Clientes y fidelización, Finanzas) que agrupan ambas convenciones; el filtro se hace en el servidor (`entity_type.in.(...)` o `action.like.prefijo*`).
- `presentation/services/audit-log-format.ts`: acción en español, detalle legible (moneda, métodos, ubicaciones, pares antes → después, sin ids ni campos vacíos).
- Filtros: búsqueda de texto (producto, venta, motivo, usuario...), módulo, usuario y periodo. Clic en una fila muestra todo el detalle. Carga los 500 más recientes del periodo.
- Tests: `tests/unit/features/audit/audit-log-format.test.ts`, `tests/unit/shared/lib/audit-diff.test.ts`, `supabase/tests/audit-logs-enrichment.test.sql`.
