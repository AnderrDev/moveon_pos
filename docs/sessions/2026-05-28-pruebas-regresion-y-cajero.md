# Spec de Sesión — 2026-05-28 — Pruebas de regresión post-fixes + usuario cajero

> Continuación de `2026-05-27-status-y-consolidacion-wip.md`. El trabajo cruzó la medianoche.

---

## Metadatos

| Campo | Valor |
|---|---|
| Fecha | 2026-05-28 |
| Sprint | Cierre P0 / pre-Sprint 5 |
| Agente | Claude Code (pipeline architect → developer → auditor + QA manual) |
| HUs trabajadas | PLAN-01..07, PLAN-15 (validación); AUTH-04 (TC-R02b) |
| Estado | Completada (P0 + regresión) |

---

## 1. Objetivo de la sesión

1. Aplicar al Supabase remoto las migraciones pendientes (PLAN-01 timezone, PLAN-03 sale_counters).
2. Re-ejecutar **todas** las pruebas manuales en el navegador con un plan paso a paso.
3. Crear un usuario cajero de prueba y cerrar la verificación del guard por rol (TC-R02b).

---

## 2. Lo que se hizo

### 2.1 Migraciones aplicadas al remoto (vía psql, idempotentes)
- `20260527_001_add_tienda_timezone` → `tiendas.timezone = America/Bogota`.
- `20260527_002_correlative_sale_number` → tabla `sale_counters` + RPC `create_sale_atomic` con correlativo. Verificado: sin colisión con ventas existentes.

### 2.2 Pruebas de regresión (navegador, Playwright MCP)
- Plan: `docs/user-stories/PLAN-DE-PRUEBAS-post-fixes.md`. **19/19 casos ejecutables PASS.**
- Confirmado en vivo: V-000001/V-000002/V-000003 correlativos; reporte por día local (TZ); form de producto (IVA/costo); cliente + descuentos (persistido en DB); paste en moneda (evento real); tope de stock; historial por sesión; anulación repone stock; cierre atómico; guard por rol (admin y cajero).

### 2.3 Usuario cajero
- Creado `cajero@moveonpos.co` / `Cajero1234!` (rol `cajero`, activo) vía `scripts/create-cajero-test-user.sh` (ejecutado por el usuario con `!` por política de seguridad sobre service role).

### 2.4 Archivos creados
- `scripts/create-cajero-test-user.sh` — helper idempotente para el cajero de prueba.
- `docs/user-stories/PLAN-DE-PRUEBAS-post-fixes.md` — plan + resultados (ya commiteado parcialmente).

---

## 3. Decisiones

| Decisión | Alternativa descartada | Razón |
|---|---|---|
| Aplicar migraciones por `psql` directo | `supabase db push` | Naming de migraciones del repo no mapea limpio al historial remoto; psql idempotente es más controlado |
| Crear cajero por script `!` | MCP de Supabase | El MCP está `Unauthorized` (token PAT expirado) y requiere reinicio; el classifier bloqueó el service role desde mi Bash |

---

## 4. Hallazgos nuevos (candidatos a nuevos PLAN)

- **F-A (alta):** caja por-tienda en la UI vs por-cajero en `create_sale_atomic`. Con 2 usuarios el cajero no puede vender/abrir su caja y ve la del admin. Alinear modelo UI+RPC+RLS.
- **F-B (media):** `sale-error-mapper` no mapeó "No hay caja abierta para esta venta" (mostró genérico). Revisar matching.

---

## 5. Tests
- [x] Migraciones verificadas en remoto.
- [x] QA manual navegador: 19/19 PASS.
- [ ] pgTAP (`sale-number.test.sql`): pendiente (Docker local apagado).

---

## 6. Próximos pasos
1. Atender F-A (modelo de caja multi-usuario) y F-B (mapper) — crear PLAN-19/20.
2. Continuar P1 (PLAN-08..14) y P2 (PLAN-16..18) con el mismo pipeline.
3. Correr pgTAP cuando Docker esté disponible.
4. Renovar el PAT del MCP de Supabase en `.mcp.json` y reiniciar Claude Code si se quiere usar el MCP.

---

## 7. Notas
- Datos de prueba en staging: producto `TESTQA02`, ventas `V-000001` (anulada)/`V-000002` (cliente+desc.)/`V-000003`, usuario `cajero@moveonpos.co`, sesiones de caja (una del admin abierta).
- El service role key y la contraseña de DB siguen en `.env.local`; recordatorio de rotarlos (quedaron expuestos en chat de sesiones previas).
