# Spec de Sesión — 2026-04-24 — Setup de estándares y sistema de sesiones

---

## Metadatos

| Campo | Valor |
|---|---|
| Fecha | 2026-04-24 |
| Sprint | Sprint 0 |
| Agente | Claude Code |
| HUs trabajadas | N/A (infraestructura de documentación) |
| Estado | Completada |

---

## 1. Objetivo de la sesión

Establecer estándares de código obligatorios para todos los agentes (Claude y Codex) y crear un sistema de specs por sesión para garantizar continuidad entre sesiones de trabajo.

---

## 2. Lo que se implementó

### 2.1 Archivos creados
- `docs/standards/ui-components.md` — estándar de componentes UI centralizados (shared/components/, CVA, shadcn)
- `docs/standards/forms.md` — estándar de formularios reactivos (React Hook Form + Zod, FormXxx compartidos)
- `docs/standards/solid-principles.md` — aplicación de SOLID al proyecto con ejemplos concretos
- `docs/standards/design-patterns.md` — catálogo de patrones: Repository, Adapter, Result, Factory, Mapper, Command
- `docs/sessions/_TEMPLATE.md` — plantilla para specs de sesión
- `docs/sessions/2026-04-24-standards-setup.md` — este archivo
- `.claude/settings.json` — hook UserPromptSubmit para Claude Code (recuerda crear spec si no existe)
- `scripts/session-start.sh` — script que Codex ejecuta al inicio de sesión para verificar/crear el spec

### 2.2 Archivos modificados
- `CLAUDE.md` — añadidas secciones §8 (estándares) y §9 (specs de sesión). Actualizadas instrucciones de lectura previa.
- `AGENTS.md` — añadido bloque "PRIMER PASO OBLIGATORIO" con `bash scripts/session-start.sh`. Añadidas secciones §6 (estándares) y §7 (specs).
- `docs/HOW_TO_USE_AI_AGENTS.md` — añadida sección §9 con prompts de inicio/fin de sesión.

### 2.3 Git hooks
- `.git/hooks/pre-commit` — bloquea commits si no existe spec del día en docs/sessions/

---

## 3. Decisiones tomadas

| Decisión | Alternativa descartada | Razón |
|---|---|---|
| Specs en docs/sessions/ (dentro del repo) | Directorio externo | Los specs son parte del historial del proyecto; viajan con el código |
| Git pre-commit hook para Codex | Solo AGENTS.md | Las instrucciones de texto pueden ignorarse; el hook es hard enforcement |
| session-start.sh como script explícito | Instrucción solo en texto | Codex puede ejecutar scripts; es más fiable que instrucciones en prosa |
| UserPromptSubmit hook para Claude | SessionStart hook | UserPromptSubmit se dispara en cada mensaje, no solo al inicio |

---

## 4. ADRs creados o actualizados

- Ninguno en esta sesión (cambios de infraestructura documental, no arquitectónicos)

---

## 5. Tests

- [ ] `pnpm typecheck` — no aplica (no se modificó código fuente)
- [ ] `pnpm lint` — no aplica
- [ ] `pnpm test` — no aplica

---

## 6. Bloqueos y preguntas pendientes

- El hook de Claude Code (.claude/settings.json) requiere abrir `/hooks` en la UI o reiniciar sesión para activarse (limitación del watcher de Claude Code).

---

## 7. Próximos pasos

1. Implementar componentes base de layout en `src/shared/components/layout/` (PageHeader, PageContainer).
2. Continuar con Sprint 1: HU-01 (login) según `docs/user-stories/sprint-01.md`.
3. Al crear el primer formulario real (login), usar `FormInput` + `SubmitButton` + `FormError` del sistema creado.

## Sistema de formularios implementado (añadido en esta sesión)

- `src/shared/components/forms/types.ts` — FieldBaseProps, SelectOption
- `src/shared/components/forms/FieldWrapper.tsx` — layout interno (label + error)
- `src/shared/components/forms/FormInput.tsx` — texto, email, password, etc.
- `src/shared/components/forms/FormTextarea.tsx` — área de texto
- `src/shared/components/forms/FormSelect.tsx` — select con options[]
- `src/shared/components/forms/FormNumberInput.tsx` — número entero
- `src/shared/components/forms/FormCurrencyInput.tsx` — COP con formato automático
- `src/shared/components/forms/FormCheckbox.tsx` — checkbox con label inline
- `src/shared/components/forms/SubmitButton.tsx` — botón con spinner CVA
- `src/shared/components/forms/FormError.tsx` — error raíz del servidor
- `src/shared/components/forms/index.ts` — barrel export
- `src/shared/validations/common.ts` — ampliado con moneySchema, salePriceSchema, phoneSchema, nitSchema, cedulaSchema, skuSchema, stockQuantitySchema, entityNameSchema, percentageSchema
- `tests/unit/shared/forms/form-currency-input.test.ts` — 8 tests, todos pasan

---

## 8. Notas adicionales

- El sistema de specs es nuevo — los próximos agentes deben leer este archivo antes de comenzar.
- `scripts/session-start.sh` también muestra el resumen del spec existente cuando ya fue creado, útil para retomar contexto rápidamente.

## 9. Revisión de estado por Codex

Fecha/hora: 2026-04-24, noche.

Se revisó el estado actual del repo a solicitud del usuario ("Revisa en que vamos").

Hallazgos:
- Sprint 0 está esencialmente completo a nivel documental y de estructura base.
- Sprint 1 todavía no está implementado: `/login`, layout de app, `/productos` y demás pantallas existen como placeholders.
- Existe migración inicial solo para `tiendas`, `user_tiendas`, `audit_logs` y enums base. Faltan tablas de Sprint 1 (`categorias`, `productos`) y sus RLS.
- Existen entidades/domain iniciales para productos, ventas, inventario y caja, pero no use cases ni repositorios implementados más allá de interfaces/base.
- Sistema compartido de formularios ya existe en `src/shared/components/forms/`.
- Hay cambios sin commit y un `package-lock.json` generado, aunque el proyecto declara `pnpm`.

Validación ejecutada:
- `./node_modules/.bin/vitest run` — pasa: 2 archivos, 12 tests.
- `./node_modules/.bin/next lint` — pasa sin warnings.
- `./node_modules/.bin/tsc --noEmit` — falla por `any` implícitos en `src/infrastructure/supabase/server.ts`.

Bloqueo operativo:
- `pnpm` no está disponible en PATH.
- `corepack pnpm --version` falla porque intenta escribir en `/Users/ander/.cache/node/corepack/v1`, fuera del sandbox.

Siguiente paso recomendado:
1. Corregir tipos implícitos en `src/infrastructure/supabase/server.ts`.
2. Resolver la inconsistencia de package manager (`pnpm-lock.yaml` ausente, `package-lock.json` presente).
3. Implementar HU-01 login con Supabase Auth usando el sistema de formularios existente.
