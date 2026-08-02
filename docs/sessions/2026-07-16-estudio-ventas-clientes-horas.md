# Spec de Sesión — 2026-07-16 — Estudio de ventas: clientes potenciales y horas pico/valle

> Copia este archivo como `YYYY-MM-DD-<tema-kebab-case>.md` al inicio de cada sesión de trabajo.
> Llénalo durante y al final de la sesión. Es el registro de lo que pasó.

---

## Metadatos

| Campo | Valor |
|---|---|
| Fecha | 2026-07-16 |
| Sprint | Post-Sprint 3 / análisis de negocio |
| Agente | Claude Code |
| HUs trabajadas | N/A (estudio de datos, no HU) |
| Estado | Completada |

---

## 1. Objetivo de la sesión

Analizar la base de datos de producción (Supabase) para producir un estudio de ventas:

- Identificar **clientes potenciales / mejores clientes** (frecuencia, ticket promedio, recencia).
- Identificar **mejores y peores horas** de venta (y días de la semana).
- Insumos para decisiones de negocio: horarios, promociones, fidelización (MOVE ON Club).

---

## 2. Lo que se implementó

### 2.1 Archivos creados
- `docs/sessions/2026-07-16-estudio-ventas-clientes-horas.md` — este spec.

### 2.2 Archivos modificados
- (pendiente)

### 2.3 Archivos eliminados
- N/A

---

## 3. Decisiones tomadas

| Decisión | Alternativa descartada | Razón |
|---|---|---|
| Análisis vía SQL de solo lectura sobre la DB remota | Exportar datos y analizar local | Más directo; sin cambios de esquema |

---

## 4. ADRs creados o actualizados

- N/A

---

## 5. Tests

- N/A — sesión de análisis, sin cambios de código.

---

## 6. Bloqueos y preguntas pendientes

- Ninguno técnico. Limitación de datos: **0 de 571 ventas tienen `cliente_id`** — no se puede identificar clientes individuales todavía; el análisis de "potenciales clientes" se hizo por segmentos de ticket y patrones de compra.

---

## 7. Próximos pasos

1. Operativizar el registro de clientes en el POS para ventas grandes (≥$100.000): son 47 ventas = 51% del ingreso, todas anónimas hoy.
2. Impulsar inscripción a MOVE ON Club en la barra de batidos (363 ventas <$15k = tráfico frecuente ideal para fidelización).
3. Repetir este estudio con ~90 días de datos y con clientes ya asociados a ventas (RFM real).

---

## 8. Resultados del estudio (resumen)

Periodo: 2026-06-13 → 2026-07-16 (34 días). 571 ventas completadas, $16.318.704 COP, ticket promedio $28.579, mediana $11.500.

- **Mejores horas (ingresos):** 14:00–15:00 (pico absoluto, $3.66M entre ambas), 19:00–21:00 (fuerte en suplementos; 21h tiene el ticket más alto: $59k prom).
- **Peores horas:** 08:00–09:00 (2 ventas en 34 días a las 8am), 18:00 tiene tráfico pero ticket bajo ($17.6k).
- **Mejores días:** martes ($735k/día) y jueves ($611k/día). Sábado pocas ventas pero ticket alto ($40.8k).
- **Peores días:** domingo ($315k/día) y viernes ($346k/día — contraintuitivo, el más flojo entre semana).
- **Categorías:** Creatinas 34% del ingreso, Proteínas 20%, Batidos 16% (pero mayor tráfico: 179 ventas).
- **Pagos:** 73% transferencia, 27% efectivo.
- **Clientes:** 1 registrado, 1 cuenta loyalty, 0 ventas con cliente asociado.

---

## 8. Notas adicionales

- Zona horaria del negocio: America/Bogota (UTC-5). Las horas se convierten desde UTC en las queries.
