# ADR 0007 — Caja compartida por tienda (multi-usuario)

**Fecha:** 2026-05-28
**Estado:** Aceptado
**Decisores:** Equipo MOVEONAPP

## Contexto

El modelo original de caja (migración `20260426_002`) imponía **una sesión `open` por usuario**:

- Índice único `ux_one_open_session_per_user` sobre `cash_sessions(opened_by) where status='open'`.
- `create_sale_atomic` exigía que la sesión tuviera `opened_by = p_cashier_id` para registrar una venta.
- `close_cash_session_atomic` solo permitía cerrar al dueño (`opened_by`) o a un admin de la tienda.

En la operación real hay **1 sede y 1 cajón físico**, pero pueden rotar varios usuarios (el dueño/admin y un cajero) durante el día. Con el modelo per-usuario, si el admin abría la caja en la mañana, el cajero **no podía vender** contra esa sesión (el check `opened_by = p_cashier_id` lo rechazaba con `'No hay caja abierta para esta venta'`), y se veía forzado a abrir una segunda sesión — algo conceptualmente erróneo: un solo cajón no puede tener dos cajas abiertas a la vez.

El UI Angular (`getOpenCashSession`) y el RLS de `cash_sessions` ya estaban alineados al modelo por-tienda (filtran por `tienda_id` + `status='open'`, sin filtrar por `opened_by`). El desajuste vivía únicamente en dos objetos de DB.

## Decisión

**La caja pasa a ser compartida por tienda: una única sesión `open` por `tienda_id`.** Cualquier usuario activo de la tienda (admin o cajero) puede vender y cerrar contra esa sesión.

Cambio quirúrgico en DB, **cero cambios en Angular** (migración `20260528_001_shared_cash_session_per_store.sql`):

1. **Índice único.** `ux_one_open_session_per_user (opened_by) where status='open'` → `ux_one_open_session_per_tienda (tienda_id) where status='open'`. Antes de recrearlo, un paso de saneamiento consolida sesiones `open` duplicadas preexistentes por tienda (conserva la más reciente por `opened_at`, cierra el resto con nota automática) para que el nuevo índice parcial no falle por datos legacy.
2. **`create_sale_atomic`.** El bloque de validación de caja deja de exigir `opened_by = p_cashier_id`; solo valida `tienda_id` + `status='open'`. El resto del cuerpo (correlativo `V-NNNNNN` server-side, idempotencia, validación de pagos/cambio, descuento de stock, `sale_counters`, firma de 12 params y grant) queda **idéntico** a `20260527_002`.
3. **`close_cash_session_atomic`.** El gate "dueño (`opened_by`) o admin" se relaja a "cualquier usuario activo de la tienda" (`user_tiendas.is_active = true`). El resto (breakdown esperado/confirmado, threshold $5.000, `closed_by = p_closed_by`, validación `v_uid <> p_closed_by`, `audit_log`, revoke/grant) queda intacto.

### Trazabilidad que se conserva

- **`cash_sessions.opened_by`** se mantiene: registra qué usuario abrió la caja (auditoría). **No se elimina.**
- **`sales.cashier_id`** sigue guardando el usuario que registró cada venta. Una caja compartida no pierde el detalle de quién vendió qué.
- **`cash_sessions.closed_by`** sigue registrando quién cerró.

### Qué NO cambia

- **`void_sale_atomic` queda intacta.** Ya restringe la anulación a admin (PLAN-15); la caja compartida no afecta esa regla. Se documenta aquí explícitamente para que el lector no la busque en la migración.
- **RLS de `cash_sessions`** (`tenant_isolation`): ya filtra por tienda, se reutiliza sin cambios.
- **UI Angular**: `getOpenCashSession`, `cash-register.repository.ts`, `caja.page.ts`, `close-session.dialog.ts`, `pos-sale.service.ts` ya operaban por-tienda; no se tocan.
- **Textos de `raise exception`** (`'No hay caja abierta para esta venta'`, `'Stock insuficiente'`, etc.): se mantienen exactos porque los consume `sale-error-mapper.ts` y los tests pgTAP.

## Consecuencias

### Positivas

- Refleja la realidad operativa: 1 cajón físico = 1 caja abierta, sin importar quién opere.
- El cajero puede vender contra la caja que abrió el admin, sin abrir una segunda sesión espuria.
- La lógica de negocio sigue siendo una sola fuente de verdad en los RPC; no se duplicó en Angular.
- El índice parcial por tienda hace que la regla "una sola caja abierta por tienda" sea garantizada por la DB (no por convención).

### Negativas

- Se pierde la noción "cada usuario tiene su propia caja". Con multi-cajón por sede (futuro), este modelo necesitaría reintroducir un identificador de cajón/turno (ver Follow-ups).
- La auditoría de "quién vendió" ahora depende de `sales.cashier_id` por venta en lugar de la sesión completa (era así de facto, pero ahora es la única vía).

### Alternativas descartadas

- **Mantener per-usuario y que el UI fuerce a cada quien abrir su caja.** Rechazada: genera múltiples cajas abiertas para un solo cajón físico, descuadres y confusión operativa.
- **Tabla de turnos/cajones.** Fuera de scope del MVP v1.0 (1 sede, 1 cajón). Se deja como evolución futura.

### Reglas derivadas

- **RN-C01** pasa a: *una tienda solo puede tener 1 sesión `open` a la vez* (índice parcial `ux_one_open_session_per_tienda`).
- Dos sesiones `closed` en la misma tienda siguen siendo válidas (el índice es parcial, solo sobre `open`).
- Tiendas distintas pueden tener cada una su propia sesión `open` simultáneamente (índice parcial por `tienda_id`).

## Follow-ups (fuera de scope)

- Multi-cajón / turnos por sede: requeriría un identificador de cajón en `cash_sessions` y un índice único por `(tienda_id, cajon_id) where open`. No aplica al MVP v1.0.
