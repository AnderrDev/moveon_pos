# Spec de Sesión — 2026-07-17 — Reestructura data/domain/presentation + design system atómico

---

## Metadatos

| Campo | Valor |
|---|---|
| Fecha | 2026-07-17 |
| Sprint | Post-Sprint 4 (reestructura arquitectónica) |
| Agente | Claude Code |
| HUs trabajadas | ADR 0014 (reestructura, sin HU asociada) |
| Estado | En progreso |

---

## 1. Objetivo de la sesión

Ejecutar la primera fase de la reestructura decidida por el dueño (ADR 0014):

1. ADR 0014 con la estructura de capas data/domain/presentation y el design system atómico.
2. Reorganizar `shared/` en atoms/molecules/organisms/services.
3. Crear los componentes faltantes del design system (spinner, skeleton, card, stat-card, dialog-footer, primitivas de tabla).
4. Adoptar el design system en TODAS las páginas (pos.page con refactor conservador).
5. Migrar los módulos piloto `products` y `customers` a la estructura nueva CON cableado hexagonal completo (repos `implements` interfaz + páginas invocan use-cases).
6. Actualizar estándares y docs de arquitectura.

Decisiones del dueño: híbrido (dominio puro en `src/modules`, presentación en `apps`), cableado completo, migración incremental (pilotos primero), design system completo con adopción total.

---

## 2. Lo que se implementó

_(en progreso — se completa al cierre de la sesión)_

### 2.1 Archivos creados
- `docs/adr/0014-estructura-data-domain-presentation-y-atomic-design.md`

### 2.2 Archivos modificados
-

### 2.3 Archivos eliminados
-

---

## 3. Decisiones tomadas

| Decisión | Alternativa descartada | Razón |
|---|---|---|
| Atomic design directo en `shared/` (atoms/molecules/organisms) | Carpeta `shared/design-system/` intermedia | Un solo design system; paths más cortos; menos moves |
| Tabla como primitivas estiladas (shell + directivas de atributo) | `mo-data-table` genérico con ng-template | 20 tablas heterogéneas; templates tipados = mantenimiento caro; primitivas = sustitución 1:1 sin tocar lógica |
| Interfaces de dominio de products se reescriben desde el uso real | Adaptar la impl a las interfaces históricas | El código en producción es la verdad operativa; las interfaces divergieron como documentación muerta |
| Modal de cobro del POS NO se migra a mo-dialog en esta sesión | Migración completa del POS | Riesgo en producción; requiere QA dedicado (sesión futura) |
| Globs de cobertura duales en vitest.config.ts durante la migración | Migrar todos los módulos de una | Migración incremental exige que legacy y nuevo convivan sin romper el umbral 90% |

---

## 4. ADRs creados o actualizados

- `docs/adr/0014-estructura-data-domain-presentation-y-atomic-design.md` — capas data/domain/presentation híbridas + atomic design + cableado hexagonal obligatorio + plan de migración incremental.

---

## 5. Tests

- [ ] `pnpm typecheck` — pendiente
- [ ] `pnpm lint` — pendiente
- [ ] `pnpm test:coverage` — pendiente (umbral 90%)
- [ ] `pnpm build` — pendiente

---

## 6. Bloqueos y preguntas pendientes

- Ninguno por ahora.

---

## 7. Próximos pasos

_(checklist de migración por módulo para las sesiones siguientes — actualizar al cierre)_

**Checklist por módulo pendiente** (aplicar en orden: sales → inventory → cash-register → loyalty → expenses → reports → settings → auth → audit → pos):

1. `git mv` `application/dtos/` → `data/dtos/`; `application/use-cases/` → `domain/use-cases/`; `infrastructure/mappers/` → `data/mappers/` (+ imports por alias en src/apps/tests).
2. Reescribir/crear interfaz de repositorio desde el uso real; use-cases patrón expenses (`deps + Zod + Result`) con tests.
3. Repo Angular `implements` interfaz; páginas/diálogos invocan use-cases.
4. `git mv` del feature a `data/` + `presentation/{pages,dialogs,components,presenters,services}`; actualizar `app.routes.ts` y consumidores cross-feature.
5. Verde en cada paso: `pnpm typecheck && pnpm lint && pnpm test:coverage && pnpm build`.
6. Al terminar TODOS los módulos: eliminar globs legacy de `vitest.config.ts` y evaluar incluir `data/mappers/**` en cobertura (deuda ADR 0014).

---

## 8. Notas adicionales

- Trabajo en rama `dev`. Cada fase = un commit que deja el repo en verde.
- Commits de moves contienen SOLO `git mv` + líneas de import (rename detection >90%); cableado y adopción DS van en commits separados.
- `apps/landing-web` queda fuera de la reestructura (ADR 0012).
