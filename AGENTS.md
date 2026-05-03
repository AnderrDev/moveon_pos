# AGENTS.md — Guía para Codex y agentes IA

Este archivo sigue la convención `AGENTS.md` que Codex (OpenAI) y otros agentes leen automáticamente. **Las reglas son las mismas que en `CLAUDE.md`** — ambos archivos son puntos de entrada equivalentes que apuntan a la misma fuente de verdad: `/docs`.

> Si eres Codex: lee este archivo, luego lee la documentación en `/docs` antes de cualquier tarea no trivial.
> Si eres Claude Code: usa `CLAUDE.md` (idéntico contenido en lo esencial).

---

## PRIMER PASO OBLIGATORIO — Ejecuta esto antes de cualquier tarea

**Antes de leer nada más ni escribir ningún código**, ejecuta este comando:

```bash
bash scripts/session-start.sh
```

Este script verifica si el spec de sesión de hoy existe. Si no existe, lo crea automáticamente desde la plantilla. **No puedes omitir este paso.** El spec de sesión es el registro de trabajo de esta sesión y el próximo agente depende de él para continuar.

Si el script no existe o falla, crea manualmente:
```bash
cp docs/sessions/_TEMPLATE.md docs/sessions/$(date +%Y-%m-%d)-<tema-de-la-sesion>.md
```

Al terminar la sesión, completa el spec con los cambios realizados, decisiones tomadas y próximos pasos.

---

## 1. Contexto del proyecto

**MOVEONAPP POS** — sistema POS para tienda física de suplementos y batidos en Colombia. Reemplaza Siigo. Stack único: **Angular 21 standalone + TypeScript + Tailwind CSS 4 + Supabase (PostgreSQL + Auth + RLS + RPC/Edge Functions)**. La app vive en `apps/pos-angular`. Next.js, React, RHF, Zustand y Vercel ya no forman parte del stack (sesión cleanup 2026-05-02).

Antes de programar, lee:
1. `/docs/00-vision.md`
2. `/docs/01-mvp-scope.md`
3. `/docs/02-architecture.md`
4. El módulo correspondiente en `/docs/modules/`
5. Las HUs activas en `/docs/user-stories/`
6. Los estándares relevantes en `/docs/standards/` si vas a crear UI, formularios o patrones.
7. El spec de sesión más reciente en `/docs/sessions/` para contexto del trabajo anterior.

---

## 2. Reglas no negociables

### Arquitectura
- Clean Architecture por módulos (`domain`, `application`).
- Dominio en TypeScript puro (vive en `src/modules/<feature>/domain`).
- DTOs Zod y use-cases puros viven en `src/modules/<feature>/application/{dtos,use-cases}`.
- Forms factory + mapper compartidos viven en `src/modules/<feature>/forms/`.
- La capa de UI/orquestación Angular vive **únicamente** en `apps/pos-angular/src/app/**`.
- Las escrituras críticas (ventas, cierres, anulaciones) se hacen vía RPC transaccional o Edge Function, **no** desde el componente.

### Datos
- Toda tabla operativa lleva `tienda_id`.
- Stock cambia solo vía `inventory_movements`.
- Ventas se anulan, no se borran.
- RLS activado en todas las tablas sensibles.
- Service role solo en Edge Functions o scripts locales — **nunca** en el bundle Angular.

### Código
- TypeScript estricto, sin `any` injustificado.
- Zod en todos los bordes (presenter Angular antes de invocar servicios; servicios antes de invocar Supabase si construyen el payload).
- Errores tipados con `Result<T, E>` para dominio; `throw` solo para errores técnicos (red, DB).
- Idempotencia en operaciones críticas (clave generada al inicio del flujo, no por click).
- Tests unitarios obligatorios en dominio, DTOs y use-cases. Tests Angular pendientes de setup (vitest+@analogjs o karma).

### Seguridad
- Secretos nunca en el bundle Angular.
- Validación de permisos por rol en cada servicio Angular sensible. No confiar solo en RLS.

---

## 3. Flujo de trabajo

### Antes de escribir código
1. Identifica el módulo afectado.
2. Lee `/docs/modules/<modulo>.md`.
3. Revisa ADRs en `/docs/adr/`.
4. Si la decisión es nueva, propón un ADR antes de implementar.
5. Si la HU no está clara, pregunta.

### Al implementar
- Incrementos pequeños.
- Sigue la estructura existente: `apps/pos-angular/src/app/features/<modulo>` para UI, `src/modules/<modulo>` para dominio + DTOs + use-cases + forms factory/mapper.
- Tipos compartidos en `/src/shared/types/`.
- Migrations versionadas en `/supabase/migrations/`.

### Después de implementar
- `pnpm typecheck && pnpm lint && pnpm test`.
- Actualiza el archivo del módulo si hay cambios relevantes.
- Crea ADR si tomaste decisión arquitectónica.
- **Actualiza el spec de sesión** en `/docs/sessions/` con lo que hiciste.

### Qué evitar
- No instales dependencias sin justificación.
- No introduzcas patrones nuevos sin ADR.
- No reintroduzcas Next, React, RHF, Zustand, Vercel ni shadcn.
- No mezcles llamadas Supabase directamente en componentes Angular: van por servicios `@Injectable`.
- No agregues funcionalidades fuera del MVP v1.0.
- No crees componentes UI o formularios sin leer `/docs/standards/ui-components.md` y `/docs/standards/forms.md`.

---

## 4. Comandos

```bash
pnpm dev          # ng serve pos-angular (http://localhost:4200)
pnpm build        # ng build pos-angular
pnpm typecheck    # tsc --noEmit + ng build dev
pnpm lint         # ng lint pos-angular
pnpm test         # vitest run (dominio, DTOs, use-cases, forms)
pnpm test:e2e     # playwright (apunta a http://localhost:4200)
pnpm db:migrate   # supabase migration up
pnpm db:types     # regenera src/infrastructure/supabase/database.types.ts
```

---

## 5. Convenciones

- Archivos: `kebab-case.ts`.
- Componentes Angular: `kebab-case.component.ts` con clase `PascalCase`. Selector `mo-<nombre>`.
- DB: `snake_case`.
- Imports absolutos desde `@/` (apunta a `src/`) y `@angular-app/` (apunta a `apps/pos-angular/src/app`).
- Código en inglés, UI y docs en español.

---

## 6. Estándares de código

Los estándares están en `/docs/standards/`. Léelos antes de crear componentes, formularios o patrones.

| Estándar | Archivo |
|---|---|
| Componentes UI centralizados | `/docs/standards/ui-components.md` |
| Formularios reactivos | `/docs/standards/forms.md` |
| Principios SOLID | `/docs/standards/solid-principles.md` |
| Patrones de diseño | `/docs/standards/design-patterns.md` |

**Resumen crítico:**
- Componentes Angular reutilizables → `apps/pos-angular/src/app/shared/`. Standalone components.
- Formularios → Angular Reactive Forms + Zod schema (factory en `src/modules/.../forms/`). Presenter en `apps/pos-angular/src/app/features/<modulo>/<feature>-form.presenter.ts`.
- Use-cases → función con deps inyectadas. `Result` para errores de dominio.
- Repositories → vivirán dentro de `apps/pos-angular/src/app/features/<modulo>/infrastructure/` cuando se porten; nunca exponer tipos crudos de Supabase a presenters/components.

## 7. Specs de sesión

Al inicio de cada sesión, copia `/docs/sessions/_TEMPLATE.md` como `YYYY-MM-DD-<tema>.md` y llénalo. El próximo agente lo leerá para entender qué pasó y qué sigue.

## 8. Coordinación con Claude Code

Claude Code también trabaja en este repo (vía `CLAUDE.md`). Las reglas son idénticas. La fuente de verdad única es `/docs`. No edites estos archivos de forma divergente — si una regla cambia, actualízala en `/docs` y refleja en ambos.
