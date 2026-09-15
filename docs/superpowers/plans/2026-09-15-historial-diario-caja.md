# Historial diario de Caja Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax.

**Goal:** Presentar el historial como el seguimiento diario de Sheets, abriendo cada día para consultar turnos y ventas.
**Architecture:** Consulta SQL SECURITY INVOKER agrega sesiones cerradas por fecha local; contratos y mappers conservan Clean Architecture. Se reutilizan filtros, tabla paginada de turnos y drawer de ventas.
**Tech Stack:** Angular 21, TypeScript, Tailwind 4, Supabase/PostgreSQL, Zod, Vitest, pgTAP, Playwright.
**Spec:** Diseño aprobado en chat y docs/sessions/2026-09-15-historial-caja-sheets.md.

## Global Constraints

- Solo administración, con RLS por tienda y grants explícitos; sin cambios en producción.
- Fecha del cierre en zona horaria de tienda; página de 20 días en servidor.
- Ventas, efectivo, transferencias, gastos, extras y retiros son flujos sumables.
- Saldo final es cash_left_amount del último cierre del día, jamás suma de saldos.
- Filtros responsable/cuadre seleccionan turnos; saldo final físico y base inicial del día se obtienen de todos los cierres del día, independientemente del filtro.
- Identificar horarios reales, no fabricar nombres Mañana/Tarde ni firmas.
- Gastos/extra excluyen movimientos anulados; retiros incluyen cash_out y retiro de cierre.
- No sumar aperturas repetidas. Base inicial del día = primer turno.
- Resumen diario corresponde a turnos cerrados ese día, no ventas de cajas todavía abiertas.

### Task 1: Consulta diaria verificable

**Files:** nueva migración CLI cash_history_daily; supabase/tests/cash-history-daily.test.sql; database.types.ts.
**Interfaces:** list_cash_history_days(p_tienda_id uuid,p_start timestamptz,p_end timestamptz,p_closed_by uuid,p_balance text,p_page integer,p_page_size integer) devuelve day, turn_count, sales_total, cash_total, transfer_total, expenses_total, extra_income_total, withdrawals_total, opening_amount, final_cash_left, notes, total_days.
- [ ] Crear pgTAP con dos cierres por día y dos tiendas: totals 30000+20000=50000, base 100000 y saldo final 80000 (no 170000), gastos/extra activos; aislamiento y validación.
- [ ] Ejecutar RED con supabase test db supabase/tests/cash-history-daily.test.sql.
- [ ] Crear migración con CLI; agrupar cierres usando (closed_at AT TIME ZONE timezone)::date; agregar pagos desde payment_closure.expected y movimientos por sesión antes del agrupamiento para evitar fan-out.
- [ ] Validar página positiva, tamaño 1–100, p_balance enum y p_start < p_end. Filtrar tienda/rol admin activo.
- [ ] Probar GREEN local, regenerar tipos y revisar diff.

### Task 2: Contrato, mapper y repositorio

**Files:** domain/services/cash-history.ts; domain/repositories/cash-register.repository.ts; data/models/cash-history-day.mapper.ts; data/repositories/cash-register.repository.ts; tests/unit/features/cash-register/cash-history-day.test.ts.
**Interfaces:** CashHistoryDay y CashHistoryDaysPage; listHistoryDays(input:CashHistoryQuery):Promise<CashHistoryDaysPage>.
- [ ] Escribir RED del mapper con valores numéricos, saldo final null y notes string[].
- [ ] Implementar mapper con Zod: rechazar respuesta inválida; date ISO, counts enteros, numeric coerce finito, nullable physical balances.
- [ ] Implementar RPC con input validado por Zod y rangos de página ya existentes.
- [ ] Ejecutar Vitest focal GREEN.

### Task 3: Resumen diario y turnos

**Files:** presentation/components/cash-history-days.component.ts; presentation/pages/cash-history.page.ts; presentation/components/cash-session-detail.drawer.ts; tests/e2e/cash-history-page.spec.ts.
**Interfaces:** página diaria input CashHistoryDaysPage y selectedDay string|null; selected output string y pageChanged output number.
- [ ] E2E RED: filtrar 14 septiembre, una fila diaria con dos turnos, Abrir turnos, dos filas existentes, abrir SEED-HIST-001 y detalle.
- [ ] Construir tabla desktop y tarjetas móviles con fecha, cantidad de turnos, ventas, efectivo, transferencia, gastos, extras, retiros, saldo final y observaciones.
- [ ] Página load usa listHistoryDays; openDay aplica fechas iguales del día seleccionado y filtros vigentes a listClosedSessionsPage con página propia.
- [ ] Invalidar carga de turnos al cambiar filtros/página/día; token LatestRequest separado, errores/reintento y sin respuestas viejas.
- [ ] Drawer muestra base inicial, gastos, ingresos extra y retiros del turno calculados desde movimientos activos, además de indicadores existentes y conceptos.
- [ ] Ejecutar E2E GREEN con descarga, móvil y filtros.

### Task 4: Verificación y entrega

**Files:** docs/modules/cash-register.md; docs/sessions/2026-09-15-historial-caja-sheets.md.
- [ ] CI=1 pnpm typecheck; restaurar configuración local inmediatamente tras el prehook.
- [ ] CI=1 pnpm lint; CI=1 pnpm test; pgTAP focal diaria/responsabilidad/retiro.
- [ ] Revisar capturas desktop 1440×900 y móvil 390×844.
- [ ] Revisión independiente y corregir hallazgos.
- [ ] Registrar resultados, git diff --check, commit local y dejar rama para prueba del usuario.
