# Spec de Sesión — 2026-08-24 — Análisis de horario de apertura

---

## Metadatos

| Campo | Valor |
|---|---|
| Fecha | 2026-08-24 |
| Sprint | N/A — análisis operativo |
| Agente | Codex |
| HUs trabajadas | N/A |
| Estado | Completada |

---

## 1. Objetivo de la sesión

Analizar todo el historial de ventas disponible en la base de datos y recomendar la hora de apertura de la tienda, comparando el desempeño por franja horaria con un costo laboral de $10.000 COP por hora.

---

## 2. Lo que se implementó

### 2.1 Archivos creados

- `docs/sessions/2026-08-24-analisis-horario-apertura.md` — registro del análisis y sus resultados.

### 2.2 Archivos modificados

- Ninguno. No se modificó código ni base de datos; todas las consultas fueron de solo lectura.

### 2.3 Archivos eliminados

- Ninguno.

---

## 3. Decisiones tomadas

| Decisión | Alternativa descartada | Razón |
|---|---|---|
| Comparar el costo laboral contra utilidad bruta por hora realmente abierta | Compararlo solo contra facturación | Los ingresos no pagan por sí solos el salario; se debe descontar el costo de producto. |
| Recomendar apertura general a las 10:00 | Abrir a las 08:00 o 09:00 | A las 09:00 la utilidad ajustada reciente es $6.453/h frente a $10.000/h de personal; a las 10:00 sube a $16.660/h. |
| Excluir el día 2026-08-24 del cálculo horario | Mezclar el día aún incompleto | Evita sesgar las últimas horas del día; el total general sí incluye sus ventas registradas al momento de consulta. |
| Corregir solo en el cálculo la anomalía conocida del sachet | Usar el costo capturado erróneo o modificar producción | `ARMY EAAS AMINOS&GLUTAMINE SACHET` conserva líneas a $49.160 de costo frente a $2.450 vigente; se normalizó para el análisis sin escribir en la DB. |

---

## 4. ADRs creados o actualizados

- Ninguno.

---

## 5. Tests

- [x] No aplica: sesión de análisis sin cambios de código ni escrituras en base de datos.
- [x] Se contrastaron el histórico completo y los últimos 28 días completos.
- [x] La exposición se calculó con `cash_sessions.opened_at/closed_at`, no tratando horas cerradas como horas sin ventas.

---

## 6. Bloqueos y preguntas pendientes

- La URL PostgreSQL de `.env.local` responde pero su contraseña está desactualizada. El análisis se hizo mediante Supabase REST con la credencial privada local y consultas paginadas de solo lectura.
- Queda pendiente corregir de forma auditada en producción el costo histórico del sachet; no bloquea esta recomendación porque se normalizó explícitamente en el cálculo.
- La apertura por día tiene muestras menores (10 viernes, 10 sábados y 10 domingos en todo el histórico; 4 de cada uno en los últimos 28 días). Conviene validar cualquier horario diferenciado durante 4 semanas.

---

## 7. Próximos pasos

1. Aplicar durante 4 semanas una apertura base a las 10:00 y volver a medir utilidad por hora abierta.
2. Si se desea optimizar por día, probar viernes a las 11:00; mantener 10:00 el resto mientras crece la muestra.
3. Corregir de forma auditada el costo histórico del sachet en producción.

---

## 8. Notas adicionales

- Costo laboral informado por el usuario: $10.000 COP por hora.
- Alcance total al momento de consulta: 2026-06-13 a 2026-08-24; 1.272 ventas completadas, 5 anuladas y $33.766.105 COP facturados.
- Para no mezclar un día parcial, el análisis horario usa hasta 2026-08-23 inclusive: 1.247 ventas y $33.423.605 COP.
- Utilidad bruta conocida ajustada del histórico completo: $13.852.320 COP, margen 41,9%; cobertura de costo: 99% de la facturación.
- Últimos 28 días completos: 489 ventas, $12.807.700 facturados, $5.275.034 de utilidad bruta ajustada y margen 41,4%.
- Resultado por hora realmente abierta (últimos 28 días):
  - 08:00–08:59: $1.944 facturados/h, $681 de utilidad/h; pérdida laboral estimada $9.319/h.
  - 09:00–09:59: $12.790 facturados/h, $6.453 de utilidad/h; pérdida laboral estimada $3.547/h.
  - 10:00–10:59: $35.037 facturados/h, $16.660 de utilidad/h; excedente sobre personal $6.660/h.
  - 11:00–11:59: $28.316 facturados/h, $11.196 de utilidad/h; excedente sobre personal $1.196/h.
  - 12:00–12:59: $38.429 facturados/h, $16.286 de utilidad/h; excedente sobre personal $6.286/h.
- En todo el histórico la conclusión coincide: 09:00 produce $8.042 de utilidad/h (no cubre personal) y 10:00 produce $16.966/h (sí lo cubre).
- Un horario diferenciado sugiere viernes a las 11:00: la franja de las 10:00 produjo solo $3.498 de utilidad/h en todo el histórico y $3.400/h recientemente; la franja de las 11:00 produjo $13.035/h y $14.663/h, respectivamente. Para sábado y domingo hay volatilidad y muestra pequeña, por lo que 10:00 sigue siendo la opción prudente.
