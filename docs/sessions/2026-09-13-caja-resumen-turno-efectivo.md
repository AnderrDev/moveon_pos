# Spec de Sesión — 2026-09-13 — Caja: resumen de turno y efectivo esperado

---

## Metadatos

| Campo | Valor |
|---|---|
| Fecha | 2026-09-13 |
| Sprint | Mantenimiento post-MVP |
| Agente | Codex |
| HUs trabajadas | Mejora operativa de Caja (sin HU asignada) |
| Estado | En progreso |

---

## 1. Objetivo de la sesión

Revisar el módulo de Caja y diseñar una mejora para mostrar por turno las ventas recibidas en
efectivo y transferencia, el efectivo registrado al cierre, los retiros realizados durante el
turno y el efectivo que debería existir físicamente antes de cerrar la caja.

---

## 2. Lo que se implementó

### 2.1 Archivos creados

- Este spec de sesión.
- `docs/superpowers/specs/2026-09-13-cierre-caja-retiro-opcional-design.md` con el diseño
  funcional y técnico aprobado.
- `docs/superpowers/plans/2026-09-13-cierre-caja-retiro-opcional.md` con siete entregas TDD.

### 2.2 Archivos modificados

- Ningún archivo de aplicación; la implementación está pendiente del plan.

### 2.3 Archivos eliminados

- Ninguno.

---

## 3. Decisiones tomadas

| Decisión | Alternativa descartada | Razón |
|---|---|---|
| El conteo físico ocurre antes del retiro de cierre | Restar el retiro antes de calcular la diferencia | Evita mostrar un retiro legítimo como faltante |
| El retiro de cierre es opcional y tiene campos propios en la sesión | Exigir un `cash_out` manual antes del cierre | El cierre queda atómico, explícito y auditable |
| El efectivo dejado se sugiere como próxima base, pero se puede editar | Forzar automáticamente la próxima apertura | Permite corregir diferencias físicas sin perder continuidad |
| Los retiros durante el turno siguen usando `cash_out` | Reemplazar todos los movimientos por un subsistema nuevo | Conserva el modelo existente y limita el alcance |

---

## 4. ADRs creados o actualizados

- Ninguno por ahora.

---

## 5. Tests

- [ ] `pnpm typecheck`
- [ ] `pnpm lint`
- [ ] `pnpm test`

---

## 6. Bloqueos y preguntas pendientes

- [x] Revisión final del spec escrito por parte del usuario.
- [ ] Elegir modalidad de ejecución del plan.

---

## 7. Próximos pasos

1. Elegir ejecución con subagentes o ejecución inline.
2. Implementar mediante TDD y verificar migración, aplicación e historial.
3. Actualizar este spec con los resultados y comandos finales.

---

## 8. Notas adicionales

El retiro de efectivo debe conservar trazabilidad por turno y no confundirse con una venta ni con
el conteo físico capturado al cierre.
