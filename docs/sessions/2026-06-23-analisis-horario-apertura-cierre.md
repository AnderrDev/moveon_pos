# Spec de Sesión — 2026-06-23 — Análisis de horario y plan de mejora de reportes

---

## Metadatos

| Campo | Valor |
|---|---|
| Fecha | 2026-06-23 |
| Sprint | N/A (consulta ad-hoc + planeación, no implementación de HU) |
| Agente | Claude Code |
| HUs trabajadas | Ninguna — análisis de datos + planeación de PLAN-38..43 (módulo reportes) |
| Estado | Completada |

---

## 1. Objetivo de la sesión

Dos partes:
1. Continuación de `2026-06-22-reporte-sql-estado-negocio`: recomendar horario de
   apertura/cierre basado en el patrón real de ventas de los primeros 10 días de
   operación (13-22 jun 2026), incluyendo un análisis de qué tipo de producto se vende
   en el tramo de cierre (batidos perecederos vs. suplementos empacados) para decidir
   si vale la pena mantener la tienda abierta hasta más tarde.
2. El usuario pidió mejorar la sección `/reportes` de la app porque "está muy cruda".
   Se investigó el estado actual del módulo y se propuso un plan de mejora, alineado
   con el flujo de trabajo del proyecto (`docs/plan-de-trabajo.md`, pipeline
   architect → developer → auditor).

---

## 2. Lo que se implementó

### 2.1 Archivos creados
- `docs/sessions/2026-06-23-analisis-horario-apertura-cierre.md` — este spec.

### 2.2 Archivos modificados
- `docs/01-mvp-scope.md` — sección M8 (Reportes básicos): se agregaron ventas por
  hora/tendencia por día, top productos por periodo, conciliación histórica de caja
  y ventas anuladas al scope de MVP actual (antes en "Qué NO entra en v1.0" como v1.4).
  La fila de "Qué NO entra en v1.0" se ajustó para dejar solo lo que de verdad sigue
  bloqueado (comparativos semana/mes, margen con costo histórico — requiere capturar
  costo en `sale_items` al momento de venta).
- `docs/plan-de-trabajo.md` — nuevo bloque "Reportes operativos avanzados (sesión
  2026-06-23)" con PLAN-38 a PLAN-43, agregados también a la tabla de estado de
  ejecución como `⏳ Pendiente`.

### 2.3 Archivos eliminados
- (ninguno)

---

## 3. Decisiones tomadas

| Decisión | Alternativa descartada | Razón |
|---|---|---|
| Horario recomendado: apertura 9:00am, cierre 9:00pm | Mantener 8:30am-10pm (patrón actual de aperturas de caja) | Hora 8-9am: 1 venta en 10 días ($6,000). Hora 9-10pm: solo 6 ventas en 3 de 10 días, 88% del valor son suplementos empacados (no urgentes), no batidos |
| Mover "ventas por hora/día, top productos, conciliación de caja, ventas anuladas" de v1.4 a MVP actual (M8) | Mantener en v1.4 | La razón original ("requieren histórico primero") ya no aplica — hay 10 días de datos reales de operación. Confirmado con el usuario vía pregunta directa |
| Primera iteración del módulo de reportes: solo tablas, sin gráficos | Incluir gráficos desde ya | Evita instalar una librería de charts sin ADR previo (CLAUDE.md exige justificar toda dependencia nueva); más rápido de construir y auditar |
| Nuevos PLAN-38..43 dependen de PLAN-33 (dividir `reportes.page.ts`, ya pendiente) | Agregar las nuevas secciones directamente al archivo actual de 1043 líneas | El archivo ya está sobre el límite de 300 líneas del estándar de mantenibilidad; agregar más sin dividir primero empeora el problema |
| PLAN-43 (vistas SQL para agregados) queda P3, sin bloquear el resto | Implementar vistas SQL desde el inicio | Con ~120 ventas/10 días el cálculo client-side actual aguanta bien; vistas materializadas se evalúan solo si el rendimiento se degrada con más volumen |

---

## 4. ADRs creados o actualizados

- Ninguno todavía. PLAN-44 (ADR de estándar de visualización de datos) se descartó
  por ahora — el usuario confirmó arrancar solo con tablas, así que no hace falta
  decidir librería de gráficos en esta iteración.

---

## 5. Tests

- [ ] `pnpm typecheck` — N/A, no se tocó código
- [ ] `pnpm lint` — N/A
- [ ] `pnpm test` — N/A

---

## 6. Bloqueos y preguntas pendientes

- [ ] La muestra de ventas es de solo 10 días — el horario recomendado debe
      revalidarse con más datos (idealmente 4-6 semanas) antes de fijarlo como
      definitivo.
- [ ] PLAN-38..43 están solo planeados, no implementados. Falta correr el pipeline
      architect → developer → auditor para cada uno (empezando por PLAN-33, su
      dependencia).

---

## 7. Próximos pasos

1. El usuario decide si ajusta el horario operativo (9am-9pm recomendado) en la
   tienda real.
2. Revisar de nuevo el patrón de ventas por hora en 2-3 semanas con más volumen de
   datos, para confirmar o ajustar el horario.
3. Ejecutar PLAN-33 (dividir `reportes.page.ts`) antes de arrancar PLAN-38..42.
4. Lanzar el agente `architect` sobre PLAN-38 (siguiente en la secuencia) cuando el
   usuario confirme que quiere empezar la implementación.

---

## 8. Notas adicionales

Ver `docs/sessions/2026-06-22-reporte-sql-estado-negocio.md` para los datos crudos
del reporte (ventas por hora, sesiones de caja, top productos) que sustentan tanto
la recomendación de horario como el plan de mejora de reportes.
