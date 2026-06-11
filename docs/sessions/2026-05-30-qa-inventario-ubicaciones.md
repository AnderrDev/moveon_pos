# Spec de Sesion — 2026-05-30 — QA inventario por ubicaciones

> Registro de la sesion de QA de inventario por ubicacion PV/Bodega.

---

## Metadatos

| Campo | Valor |
|---|---|
| Fecha | 2026-05-30 |
| Sprint | Cierre MVP / QA inventario por ubicacion |
| Agente | Codex |
| HUs trabajadas | INV-01, INV-02, INV-03, INV-04, INV-05, INV-06, INV-07, POS-03, POS-05, POS-08, REP-02, FLUJO-07 |
| Estado | Completada |

---

## 1. Objetivo de la sesion

Ejecutar QA funcional de inventario por ubicacion usando navegador, trazar casos de prueba contra HUs y dejar un flujo manual completo para validar el MVP PV/Bodega con bajo riesgo operativo.

---

## 2. Lo que se implemento

### 2.1 Archivos creados
- `docs/user-stories/PLAN-DE-PRUEBAS-inventario-ubicaciones.md` — matriz HU/casos, evidencia de QA navegador y flujo manual completo PV/Bodega.
- `docs/audits/2026-05-30-auditoria-arquitectura-patrones-calidad.md` — auditoria integral documental/estatica del proyecto completo contra arquitectura, patrones, seguridad, UI/forms, docs y mantenibilidad.
- `docs/audits/2026-05-30-plan-accion-auditoria-arquitectura.md` — backlog ejecutable PLAN-27..37 derivado de la auditoria.

### 2.2 Archivos modificados
- `docs/user-stories/README.md` — agrega enlace al plan de pruebas de inventario por ubicacion.
- `docs/plan-de-trabajo.md` — agrega bloque activo PLAN-27..37 con prioridades, criterios de cierre y gates.
- Se mantiene el resto de cambios PLAN-22..26 previos en el worktree.

### 2.3 Archivos eliminados
- No aplica.

---

## 3. Decisiones tomadas

| Decision | Alternativa descartada | Razon |
|---|---|---|
| Documentar QA de inventario por ubicacion en un plan dedicado | Mezclarlo en el smoke E2E general | El alcance PV/Bodega cruza Inventario, POS, Reportes y permisos; un doc separado facilita regresion y rollback. |
| Dejar explicito que riesgo 100% no existe | Presentar el flujo como garantia total | La QA reduce riesgos criticos, pero quedan residuales como impresora fisica, concurrencia y evidencia SQL directa. |

---

## 4. ADRs creados o actualizados

- `docs/adr/0008-inventario-por-ubicacion.md` — ADR creado en la implementacion PLAN-22..26 previa; no se modifico en esta sesion.

---

## 5. Tests

- [x] `corepack pnpm typecheck` — paso.
- [x] `corepack pnpm lint` — paso.
- [x] `corepack pnpm test` — 34 archivos / 299 tests pasaron.
- [x] QA navegador — paso flujo PV/Bodega con producto `QAPVBOD203208`.
- [x] SQL/integracion staging — pgTAP habia pasado previamente; consulta SQL de evidencia directa no pudo ejecutarse en esta sesion por DNS/MCP auth.

Detalle de fallos (si los hay):

- `psql` contra staging no resolvio DNS local para el host Supabase.
- MCP Supabase respondio `Unauthorized`; falta token MCP para consultas directas desde este hilo.
- La validacion funcional principal se ejecuto en navegador contra la app local conectada a staging.

---

## 6. Bloqueos y preguntas pendientes

- [ ] Validar en una corrida con acceso SQL directo para dejar evidencia DB exportable.
- [ ] Validar impresora fisica real fuera del navegador.
- [ ] Probar concurrencia con dos sesiones sobre el mismo producto.

---

## 7. Proximos pasos

1. Repetir `TC-INVLOC-13` en navegador si se necesita evidencia visual del tope de cantidad con PV > 1.
2. Ejecutar `supabase/tests/inventory-locations.test.sql` en un entorno con acceso DB directo antes de release formal.
3. Limpiar o conservar con convencion los datos QA `QA PV Bodega*` / `QAPVBOD*` segun politica de staging.

---

## 8. Notas adicionales

La sesion parte de la implementacion PLAN-22..26 ya realizada: migraciones aplicadas en staging, tipos Supabase regenerados, pruebas unitarias y SQL pgTAP previas en verde.

QA navegador ejecutada:

- Producto QA: `QA PV Bodega 20260530203208` / `QAPVBOD203208`.
- Nacimiento: PV `0`, Bodega `0`, Total `0`, Min `2`, `Stock bajo`.
- Entrada Bodega: PV `0`, Bodega `5`, Total `5`; POS no permitio vender, toast `Stock maximo: 0 unidades`.
- Traslado Bodega -> PV: PV `3`, Bodega `2`, Total `5`.
- Venta: `V-000005`, descuento de PV a `2`, Bodega queda `2`.
- Anulacion: `V-000005` queda `Anulada`, PV vuelve a `3`, Bodega `2`, Total `5`.
- Kardex: muestra Entrada Bodega, Traslado salida Bodega, Traslado entrada PV, Venta PV y Anulacion PV.
- Reportes Stock: muestra columnas PV/Bodega/Total y producto QA `3/2/5/2`.
- Negativo traslado: `99` desde Bodega muestra `Stock insuficiente en origen. Disponible: 2`.
- Cajero: no ve Productos/Inventario/Reportes y `/inventario` redirige a `/pos`.
- Capturas guardadas: `/private/tmp/moveonapp-qa-inventario-final.png`, `/private/tmp/moveonapp-qa-kardex-ubicaciones.png`, `/private/tmp/moveonapp-qa-reporte-stock.png`.

Validacion final adicional solicitada por el usuario:

- Producto QA: `QA FLUJO FINAL 20260530205806` / `QAFLOW205806`.
- Caja: abierta durante la corrida.
- Entrada Bodega: PV `0`, Bodega `1`, Total `1`; POS no permitio vender, toast `Stock maximo: 0 unidades`.
- Traslado Bodega -> PV: PV `1`, Bodega `0`, Total `1`.
- Venta: `V-000006`, descuento de PV a `0`, Bodega queda `0`.
- Anulacion: `V-000006` queda `Anulada`, PV vuelve a `1`, Bodega `0`, Total `1`.
- Kardex: muestra Entrada Bodega, Traslado salida Bodega, Traslado entrada PV, Venta PV y Anulacion PV.
- Reportes Stock: muestra producto QA final con PV `1`, Bodega `0`, Total `1`, Min `2`, `Stock bajo`.
- Capturas guardadas: `/private/tmp/moveonapp-qa-final-inventario.png`, `/private/tmp/moveonapp-qa-final-kardex.png`, `/private/tmp/moveonapp-qa-final-reporte-stock.png`.

---

## 9. Auditoria integral de arquitectura, patrones y calidad

Auditoria documental/estatica ejecutada a solicitud del usuario. Entregable:

- `docs/audits/2026-05-30-auditoria-arquitectura-patrones-calidad.md`

Checks ejecutados:

- [x] `corepack pnpm typecheck` — paso.
- [x] `corepack pnpm lint` — paso.
- [x] `corepack pnpm test` — 34 archivos / 299 tests pasaron.
- [ ] `corepack pnpm test:e2e` — fallo por ausencia de tests Playwright (`Error: No tests found`; `tests/e2e/.gitkeep` solamente).

Conclusiones principales:

- Base tecnica en verde: typecheck/lint/unitarios pasan; Angular standalone + OnPush y dominio TS puro estan bien encaminados.
- Critico: mutaciones admin-only de productos/inventario dependen de UI/guards mientras RLS es tenant-only para `for all`; requiere RLS/RPC por rol.
- Critico: autorizacion de descuentos por rol RN-S09 no se aplica en el flujo POS real; el use-case puro la valida, pero POS Angular llama RPC directo.
- Alto: `pos.page.ts` tiene 859 lineas y debe dividirse antes de seguir creciendo.
- Alto: repositorios Angular no devuelven `Result` como los contratos de dominio.
- Alto: no hay E2E automatizado aunque Playwright esta configurado.
- Medio: formularios de inventario/caja no usan consistentemente factory/mapper/presenter.
- Medio: README/standards/roadmap conservan referencias documentales legacy a Next/Vercel/shadcn.

---

## 10. Plan de accion derivado de auditoria

Entregables:

- `docs/audits/2026-05-30-plan-accion-auditoria-arquitectura.md`
- Bloque PLAN-27..37 agregado en `docs/plan-de-trabajo.md`

Orden recomendado:

1. PLAN-27 — Seguridad RLS/RPC admin-only.
2. PLAN-28 — Descuentos por rol en servidor.
3. PLAN-29 — E2E Playwright minimo MVP.
4. PLAN-30 — Dividir `pos.page.ts`.
5. PLAN-31 — Repositorios Angular + `Result`.
6. PLAN-32 — Dividir importador Siigo.
7. PLAN-33 — Dividir reportes/caja/cierre.
8. PLAN-34 — Formularios factory/mapper/presenter.
9. PLAN-35 — Errores tipados por modulo.
10. PLAN-36 — Limpieza documental legacy/runtime config.
11. PLAN-37 — Placeholders, TODOs y fixtures.

Gates:

- Go-live recomendado: PLAN-27, PLAN-28 y PLAN-29.
- Mantenibilidad MVP: PLAN-30, PLAN-31 y PLAN-32.
