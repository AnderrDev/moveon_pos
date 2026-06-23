# Spec de Sesión — 2026-06-22 — Reporte SQL estado del negocio

---

## Metadatos

| Campo | Valor |
|---|---|
| Fecha | 2026-06-22 |
| Sprint | N/A (consulta ad-hoc, no HU de producto) |
| Agente | Claude Code |
| HUs trabajadas | Ninguna — entregable es un script SQL de consulta para el dueño del negocio |
| Estado | Completada |

---

## 1. Objetivo de la sesión

El usuario pidió un script SQL para correr directamente en la terminal SQL de Supabase
que extraiga todos los datos necesarios para armar un reporte de estado del negocio:
qué se vende, a qué hora se vende, a qué hora se abre/cierra caja, cuánto se factura,
movimientos de caja, etc. No se modifica código de la app ni el esquema.

---

## 2. Lo que se implementó

### 2.1 Archivos creados
- `scripts/reports/business-status-report.sql` — script de consultas SQL (solo lectura)
  para Supabase SQL editor, con 9 secciones: resumen general, ventas por día, ventas
  por hora, top productos, ventas por método de pago, sesiones de caja (apertura/cierre),
  movimientos de caja, ventas anuladas y resumen ventas-vs-caja por sesión.

### 2.2 Archivos modificados
- (ninguno)

### 2.3 Archivos eliminados
- (ninguno)

---

## 3. Decisiones tomadas

| Decisión | Alternativa descartada | Razón |
|---|---|---|
| Usar `tiendas.timezone` (America/Bogota) para agrupar por día/hora local | Agrupar por `created_at` en UTC | Las horas de apertura/cierre y venta deben reflejar la hora local de Colombia, no UTC |
| Excluir `status = 'voided'` en ventas y `status <> 'active'` en movimientos de caja de los totales, pero reportarlos aparte | Incluir todo junto | Coherente con la regla de negocio de auditoría (ventas/movimientos anulados no deben inflar ni desinflar el reporte de facturación real) |
| Parametrizar con una CTE `params` al inicio de cada bloque en vez de variables psql `\set` | Variables de sesión psql | El usuario va a pegar esto en el SQL editor de Supabase (no psql), que no soporta `\set` |

---

## 4. ADRs creados o actualizados

- Ninguno — es una consulta de solo lectura, no una decisión arquitectónica.

---

## 5. Tests

- [ ] `pnpm typecheck` — N/A, no se tocó código TypeScript
- [ ] `pnpm lint` — N/A
- [ ] `pnpm test` — N/A
- Verificación manual: sintaxis revisada contra el esquema real en
  `supabase/migrations/20260426_002_cash_sales_billing_settings.sql`,
  `20260619_001_void_cash_movement.sql`, `20260428_001_add_total_sales_closure.sql`
  y `20260527_001_add_tienda_timezone.sql`. No se ejecutó contra la DB real en esta sesión.

---

## 6. Bloqueos y preguntas pendientes

- [ ] El usuario debe reemplazar el placeholder `tienda_id` en la CTE `params` de cada
      sección con el UUID real de su tienda antes de ejecutar.

---

## 7. Próximos pasos

1. El usuario corre el script en el SQL editor de Supabase y ajusta el rango de fechas.
2. Si se vuelve un reporte recurrente, considerar convertirlo en una vista o función RPC
   (`get_business_report(tienda_id, from, to)`) en una migración versionada, en vez de
   un script ad-hoc.

---

## 8. Notas adicionales

Ninguna.
