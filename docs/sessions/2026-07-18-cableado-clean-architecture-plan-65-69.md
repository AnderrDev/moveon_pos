# Spec de Sesión — 2026-07-18 — Cableado hexagonal PLAN-65..69 (continuación)

> Continuación directa de `docs/sessions/2026-07-17-reestructura-clean-atomic.md`. La sesión
> cruzó medianoche; este spec cubre el trabajo desde el arranque del bloque PLAN-65..69
> (orquestación con subagentes en paralelo) en adelante.

---

## Metadatos

| Campo | Valor |
|---|---|
| Fecha | 2026-07-18 |
| Sprint | Post-Sprint 4 (reestructura arquitectónica, bloque PLAN-61..69) |
| Agente | Claude Code |
| HUs trabajadas | ADR 0015 (sin HU asociada) |
| Estado | En progreso |

---

## 1. Objetivo de la sesión

Ejecutar el resto del plan PLAN-61..69 (ADR 0015, Clean Architecture feature-first) definido
en la sesión del 07-17: cableado hexagonal completo (contratos `abstract class` + use-cases +
DI en presentation) de todas las features restantes, orquestando con subagentes `developer` en
worktrees aislados donde el trabajo es paralelizable con seguridad, y cerrando con limpieza
(PLAN-68) y auditoría final + merge a `main` (PLAN-69) por mi cuenta.

Contexto heredado del 07-17 (ya cerrado ahí): PLAN-61 (co-ubicación mecánica), PLAN-62
(contratos abstract class + composition root), PLAN-63 (fronteras ESLint), PLAN-64 (pilotos
`products` + `customers` cableados a mano por mí, estableciendo el patrón de referencia).

---

## 2. Lo que se implementó

### 2.1 Orquestación con subagentes

Se lanzaron 3 agentes `developer` en paralelo, cada uno en worktree aislado (`isolation:
worktree`), con prompts extensos que replican el patrón de PLAN-64 (leen los archivos reales
de `customers`/`products` como referencia) y delimitan alcance sin solapamiento de archivos:

- **PLAN-65** (`sales` + `inventory` + `cash-register`, sin dividir `pos.page.ts`): terminó en
  un solo intento. 10 use-cases nuevos, 16 archivos de presentation cableados. Commit
  `a2d918b`, integrado a `dev` con `git merge --no-ff` (1 conflicto trivial en
  `CABLED_FEATURES` de `eslint.config.js`, resuelto como unión de ambas listas).
- **PLAN-66** (`expenses` + `loyalty` + `reports` + `settings`): se cortó DOS VECES por errores
  de conexión de la API (no errores de código) a mitad de trabajo. Reanudado ambas veces vía
  `SendMessage` al mismo agente (mantiene el contexto completo de su transcript). Ver §6.
- **PLAN-67** (`audit` + `auth` + revisión de excepciones del linter): terminó en un solo
  intento, con hallazgo honesto de que ninguna de las 5 excepciones documentadas en PLAN-63 se
  pudo retirar (todas dependen de features que PLAN-65/66 aún no habían cerrado). Commit
  `8f7aa76`, integrado sin conflictos.

Cada integración se verificó por mi cuenta antes de mergear (revisé el diff real contra `dev`,
no solo el reporte del agente) y después con `pnpm typecheck && pnpm lint && pnpm test`.

### 2.2 Archivos creados
- (ver los commits `a2d918b` y `8f7aa76`, y el que resulte de PLAN-66 al cerrar)

### 2.3 Archivos modificados
- `eslint.config.js` — `CABLED_FEATURES` acumulando features por cada PLAN integrado.

### 2.4 Archivos eliminados
- (ninguno propio de esta sesión aún — pendiente de confirmar lo que haga PLAN-66 con
  `reports.service.ts`/`loyalty-report.service.ts` viejos)

---

## 3. Decisiones tomadas

| Decisión | Alternativa descartada | Razón |
|---|---|---|
| Verificar cada rama de agente contra `dev` (diff real) antes de mergear, no confiar solo en el reporte final | Mergear directo confiando en "typecheck+lint+test verde" del reporte | Un agente puede reportar éxito con trabajo parcial o con juicios arquitectónicos que necesitan revisión humana antes de entrar a `dev` |
| Reanudar el agente de PLAN-66 vía `SendMessage` en vez de relanzar uno nuevo tras cada corte | Lanzar un agente nuevo desde cero | El agente resumido conserva el contexto completo (qué ya exploró, qué patrones ya aplicó); relanzar perdería ese trabajo de análisis y arriesga inconsistencia con lo ya hecho en el worktree |
| Limpiar (`git worktree remove` + `git branch -d`) los worktrees ya mergeados inmediatamente | Dejarlos acumulándose hasta el cierre de todo el bloque | Reduce ruido en `git worktree list` y evita confusión sobre cuáles ramas siguen activas |

---

## 4. ADRs creados o actualizados

- Ninguno nuevo en esta sesión — se sigue ejecutando bajo `docs/adr/0015-feature-first-clean-architecture.md` (creado el 07-17).

---

## 5. Tests

- [x] `pnpm typecheck` — pasó (tras integrar PLAN-65)
- [x] `pnpm lint` — pasó (tras integrar PLAN-65)
- [x] `pnpm test` — 531 tests pasaron (tras integrar PLAN-65; sube desde 511 de PLAN-64)

Pendiente repetir esta verificación tras integrar PLAN-66.

---

## 6. Bloqueos y preguntas pendientes

- [ ] PLAN-66 sufrió 2 cortes de conexión de la API a mitad de ejecución (no relacionados con
  el código). Se reanudó ambas veces. Si vuelve a cortarse, seguir el mismo patrón: revisar el
  estado del worktree (`git status --short` dentro de él) antes de decidir si reanudar o
  reiniciar.
- [ ] La división de `pos.page.ts` (~1500 líneas) en componentes < 300 líneas quedó
  explícitamente pospuesta (era parte del criterio original de PLAN-65) porque requiere QA
  manual en navegador — la extensión de Chrome no está disponible en esta sesión. Queda como
  tarea para una sesión futura con esa capacidad.
- [ ] El `SaleReader` segregado (ISP) mencionado en el criterio original de PLAN-65 no se creó
  — el agente evaluó que no hay beneficio real hoy (solo 3 métodos de lectura ya delgados en
  `reports.service.ts`). Revisar si sigue sin aplicar cuando el contrato de `SaleRepository`
  crezca.

---

## 7. Próximos pasos

1. Terminar de verificar e integrar PLAN-66 cuando el agente reanudado termine.
2. PLAN-68: limpieza profunda (cero código muerto, nombres consistentes, reescribir
   `CLAUDE.md`/`docs/02-architecture.md`/estándares contra ADR 0015, marcar ADR 0014 superseded
   parcialmente, ADR 0015 → Aceptado).
3. PLAN-69: verificación integral (typecheck+lint+test+coverage ≥90% dominio), QA manual E2E de
   los 8 flujos núcleo en cuanto haya navegador disponible, `pnpm build` de producción, y
   merge `dev` → `main` con confirmación del dueño.
4. Actuar como auditor final contra el ADR 0015 y el plan-de-trabajo.md completo, reportando
   honestamente cualquier criterio no cumplido en vez de declarar éxito prematuro.

---

## 8. Notas adicionales

Esta sesión es un caso de uso real de orquestación de subagentes en paralelo sobre worktrees
git aislados para una migración arquitectónica grande: funcionó bien para features
bien-delimitadas y con patrón ya establecido (PLAN-65, 67), y sobrevivió a fallos de
infraestructura (cortes de conexión) gracias a que los worktrees preservan el estado en disco
independientemente de la sesión del agente — permitiendo reanudar sin perder trabajo.
