# Spec de Sesión — 2026-10-24 — Auditoría: registros completos y legibles

## Metadatos

| Campo | Valor |
|---|---|
| Fecha | 2026-10-24 |
| Sprint | Post-MVP (mejoras) |
| Agente | Claude Code |
| HUs trabajadas | Mejora de auditoría pedida por el dueño |
| Estado | Completada y en producción |

## 1. Objetivo de la sesión

La pantalla de Auditoría marca registros pero les falta información importante. Diagnóstico en producción (solo lectura):

- Conviven dos convenciones: registros escritos por la app (`void`, `adjust`, tipo `venta`/`producto`… con `changes` y correo) y por la base (`sale.voided`, `cash_session.closed`, tipo `sale`/`product`… con `metadata`, **sin correo y sin nombre** de la entidad).
- La pantalla solo lee `changes`: los ~1.000 registros de la base salen sin usuario, sin detalle, con el código de la acción y un UUID como entidad. El filtro por módulo no los encuentra.
- Eventos duplicados (anular venta, anular/corregir movimiento de caja, corregir apertura, cierre de caja, ajuste de stock): uno con usuario y otro con detalle.
- Editar producto o cliente guarda los valores nuevos, no qué cambió (sin "antes").
- Las ventas se registran sin número de venta; los gastos no se auditan al crearse.

Regla: pruebas solo en local; producción solo con OK del dueño.

## 2. Lo que se implementó

- Migración `20261024190000_audit_logs_enrichment.sql`: `audit_entity_label`, trigger `tr_audit_logs_enrich` (correo, usuario y nombre), ajuste de stock con ubicación, `register_expense_atomic` audita `expense.created`, cierre de caja con base, esperado y nota.
- Migración `20261024200000_backfill_audit_logs.sql` (DATOS): completa correo y nombre en registros antiguos.
- App: quitados 6 registros duplicados (anular venta, anular/corregir movimiento, corregir apertura, cierre, ajuste); editar producto/cliente audita antes → después (`src/shared/lib/audit-diff.ts`).
- Pantalla `/auditoria` reescrita: lee `metadata` y `changes`, acciones en español, módulo, nombre de la entidad, detalle legible y expandible, búsqueda, filtros por módulo (ambas convenciones), usuario y periodo.
- Doc nuevo `docs/modules/audit.md`.

## 3. Verificación (local)

- pgTAP: 18 suites / 236 pruebas OK (nueva `audit-logs-enrichment.test.sql`, 10).
- Unitarias: 887+ OK; paridad iOS 35 OK; lint y typecheck OK.
- Navegador (4210): registros de la base con usuario y nombre; filtro Caja trae `open`/`cash_session.closed`/`cash_movement.corrected`; detalle expandido con antes → después; búsqueda "V-000002" muestra creación y anulación; 375 px sin scroll horizontal de página.

## 4. Pendientes

- ~~Producción~~ **Hecho 2026-10-24 con OK del dueño:** `20261024190000` y `20261024200000` aplicadas con `db query --linked` y versión registrada. De 4.349 registros: 0 sin nombre; 15 sin correo (cambios sin usuario, p. ej. importaciones: se ven como "Sistema"). Frontend publicado en `main` 168f5c1 (hasta b8e3dd2; el commit de diseño f1bc788 quedó en dev sin publicar), Netlify ready en POS y catálogo.
- App iOS: deja de escribir `void`/`adjust` propios (la base ya los audita) — en su repo.
- No auditados aún: empleados, plantillas y configuración del fondo de Finanzas; usuarios/roles en Configuración.
