# Spec de Sesión — 2026-09-15 — Historial de Caja alineado con Sheets

## Metadatos

| Campo | Valor |
|---|---|
| Fecha | 2026-09-15 |
| Sprint | Mantenimiento post-MVP |
| Agente | Codex |
| HUs trabajadas | Mejora operativa de Caja |
| Estado | Aprobado por el usuario; integración local a main en curso |

## 1. Objetivo de la sesión

Comparar el historial con la hoja compartida y acordar ajustes de datos y organización.

## 2. Trabajo realizado

- Leída por exportación CSV pública la hoja SEGUIMIENTO DIARIO.
- Encabezados diarios: Fecha, Venta Total Día, Efectivo Día, Tarjeta/Transferencia Día,
  Gastos Día, Ingreso Extra Día, Saldo Final Día, Observaciones.
- Detalle por turno: Fecha, Turno, Responsable, Base Inicial, Venta Efectivo,
  Venta Tarjeta/Transf., Total Venta Turno, Ingresos Extras, Detalle Ingreso Extra,
  Gastos Turno, Detalle Gastos, Efectivo Total Recolectado, Firma/Verificación.
- Implementado resumen diario paginado con ventas efectivo/transferencia, gastos, ingresos extra, retiros, efectivo final y notas.
- Apertura de día con turnos paginados, responsable y detalle de ventas/exportación existentes.
- RPC diaria con validación, permisos de administración y aislamiento por tienda; migration aplicada solo en Supabase local.
- Indicadores de movimientos vigentes por turno; anulados visibles pero excluidos de totales.
- Hoja original y producción sin modificaciones.
- Eliminado el botón duplicado Retirar efectivo de Caja, aprobado por el usuario. Se conserva el tipo Retiro en + Movimiento y el retiro opcional al cierre, sin cambios de lógica ni datos.
- Ajuste UX aprobado: Ver turnos sustituye el resumen por una vista dedicada del día; Volver al resumen conserva filtros y página. Encabezado enfocado al navegar; apertura y cierre completos visibles en escritorio/móvil, incluyendo fechas para turnos nocturnos.

## 3. Decisiones aprobadas

- Vista principal por día, con turnos y cuadre al abrir un día.
- Conservar contado, retiros y efectivo dejado para el proceso real del negocio.
- Saldo final diario: efectivo dejado por el último cierre, no suma de saldos de turnos.
- No inferir etiquetas Mañana/Tarde sin acordar la clasificación por horario.
- Fecha diaria basada en el cierre en zona horaria de la tienda. Filtros de responsable/cuadre afectan flujos, no el efectivo físico final de todo el día.

## 4. ADRs

Ninguno.

## 5. Tests

Typecheck/build y lint correctos. E2E: navegación diaria, turnos, filtros, ventas, Excel y móvil correctos (2 pruebas). SQL diario: 16 pruebas correctas. Unitarios: 82 archivos / 723 pruebas correctas. Revisión independiente detectó omisiones de indicadores de retiros diarios y flujos por turno, incorporados antes de entregar.

## 6. Pendientes

Integración a main autorizada por el usuario. No se autoriza despliegue ni aplicación de migrations en producción.

## 7. Próximos pasos

1. Probar /caja/historial con el seed local y filtros del 14/09/2026.
2. Integrar solo después de aceptación del usuario; no desplegado a producción.

## 8. Notas

Worktree .worktrees/caja-retiro-cierre, rama codex/caja-retiro-cierre.
Producción sin cambios. Referencia temporal: /tmp/moveon-seguimiento-diario.csv.
Fuente: https://docs.google.com/spreadsheets/d/1_bNEJbt1O0LrxGGYhY5DZLSP7LjZfImx-IK4W3JM490/edit
