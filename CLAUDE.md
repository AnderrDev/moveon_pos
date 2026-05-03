# CLAUDE.md — Guía para Claude Code

Este archivo es la guía operativa para Claude Code cuando trabaje en este repositorio. Léelo completo antes de cualquier tarea no trivial.

---

## 1. Qué es este proyecto

**MOVEONAPP POS** es un sistema de Punto de Venta para una tienda física de suplementos y batidos para gimnasio en Colombia. El objetivo es reemplazar Siigo y reducir costos operativos manteniendo control total de la operación.

- **Negocio:** suplementos + batidos preparados.
- **Volumen:** 50–100 ventas/día, 1 operador, 1 sede (multi-sede preparado en datos).
- **Stack:** Angular 21 standalone PWA + TypeScript + Supabase (PostgreSQL + Auth + RLS + RPC/Edge Functions) + Tailwind CSS 4.
- **Despliegue:** estático (Angular CLI) — el target de hosting se decidirá tras el cleanup de Vercel/Next (sesión `2026-05-02-cleanup-next-vercel`).

> Next.js, React, RHF, Zustand, shadcn/ui y Vercel ya **no** son parte del stack — fueron retirados en el cleanup del 2026-05-02. Si encuentras referencias residuales, repórtalas y bórralas.

Antes de programar, **lee siempre**:
1. `/docs/00-vision.md` — qué intentamos resolver.
2. `/docs/01-mvp-scope.md` — qué entra y qué NO en el MVP v1.0.
3. `/docs/02-architecture.md` — reglas arquitectónicas no negociables.
4. El módulo en `/docs/modules/<modulo>.md` correspondiente a la tarea.
5. Las HUs activas en `/docs/user-stories/sprint-XX.md`.
6. Los estándares relevantes en `/docs/standards/` si vas a crear UI, formularios o patrones.
7. El spec de sesión más reciente en `/docs/sessions/` para entender el contexto de trabajo anterior.

---

## 2. Principios no negociables

Estos principios **no se discuten en cada tarea**. Si la solución que vas a proponer los rompe, busca otra solución.

### 2.1 Arquitectura
- **Clean Architecture por módulos.** Cada módulo (`sales`, `inventory`, `billing`, etc.) tiene su propio dominio, DTOs y use-cases en `src/modules/<modulo>`. La UI/orquestación Angular vive en `apps/pos-angular/src/app/features/<modulo>`.
- **El dominio no depende de Angular, ni de Supabase, ni de proveedores externos.** El dominio es TypeScript puro.
- **Patrón Adapter para integraciones externas** (facturación electrónica, impresión, pagos). Define interfaces en el dominio, implementaciones en infraestructura Angular.
- **Inyección de dependencias** vía argumentos de funciones / factories en use-cases puros, y vía Angular `@Injectable` + tokens en presenters/servicios.

### 2.2 Datos
- **Toda tabla operativa lleva `tienda_id`** desde el día uno (multi-sede preparado).
- **Stock NUNCA se modifica directamente.** Todo cambio pasa por `inventory_movements`.
- **Las ventas no se borran físicamente.** Se anulan con auditoría (`status = 'voided'`, `voided_by`, `voided_at`, `voided_reason`).
- **RLS activado en todas las tablas con datos del negocio.** Sin excepción.
- **Service role solo en Edge Functions o scripts locales.** Nunca empacar en el bundle Angular ni exponer al navegador.

### 2.3 Código
- **TypeScript estricto.** `strict: true` en `tsconfig.angular.json`. No usar `any` sin justificación documentada.
- **Validación con Zod** en todos los bordes (presenter Angular antes del submit, payload antes de invocar Supabase).
- **Errores tipados** con `Result<T, E>` para dominio; `throw` solo para fallos técnicos (red, DB caída).
- **Idempotencia** en operaciones críticas (crear venta, emitir factura, cerrar caja). La clave se genera al iniciar el flujo, no por cada click.
- **Tests unitarios** obligatorios en lógica de dominio, DTOs y use-cases. Tests Angular pendientes de setup (vitest+@analogjs/vitest-angular o karma) — escribir tan pronto como exista.

### 2.4 Seguridad
- Ningún secreto en cliente. La app Angular sólo recibe `SUPABASE_URL` y `SUPABASE_ANON_KEY`.
- Llaves de proveedor de facturación, service role, etc. → solo Edge Functions o scripts CLI locales (`scripts/`).
- Validar permisos por rol en cada servicio Angular sensible. No confiar solo en RLS.

---

## 3. Cómo trabajamos contigo (Claude Code)

### 3.1 Antes de escribir código
1. Identifica qué módulo toca la tarea.
2. Lee el archivo de ese módulo en `/docs/modules/`.
3. Revisa si hay un ADR relacionado en `/docs/adr/`.
4. **Lee los estándares relevantes en `/docs/standards/`** antes de crear componentes, formularios o patrones nuevos.
5. Si vas a tomar una decisión arquitectónica nueva, **propón un ADR antes** de implementar.
6. Si la HU no está clara, pregunta. No asumas.

### 3.2 Al implementar
- **Pequeños incrementos.** Una tarea = un PR mental. No mezcles refactors grandes con features nuevas.
- **Sigue la estructura existente.** Dominio + DTOs + use-cases + forms factory/mapper en `src/modules/<modulo>`. UI Angular en `apps/pos-angular/src/app/features/<modulo>`.
- **Usa los tipos compartidos en `/src/shared/types/`**. No redefinas entidades en cada módulo.
- **Componentes reutilizables Angular** van en `apps/pos-angular/src/app/shared/` cuando se justifique.
- **Migrations versionadas** en `/supabase/migrations/`. Nombres con timestamp.

### 3.3 Después de implementar
- Ejecuta `pnpm typecheck` y `pnpm lint`.
- Ejecuta los tests del módulo afectado (`pnpm test`).
- Actualiza el archivo del módulo en `/docs/modules/` si cambió algo relevante.
- Si tomaste una decisión arquitectónica, déjala como ADR.
- **Actualiza el spec de sesión** en `/docs/sessions/` con lo que hiciste.

### 3.4 Qué NO hacer
- No reintroduzcas Next, React, RHF, Zustand, shadcn ni Vercel — fueron retirados a propósito.
- No instales dependencias sin justificación. Cada librería suma riesgo y costo.
- No introduzcas patrones nuevos sin discutirlo en un ADR primero.
- No mezcles SQL crudo en componentes Angular. Toda llamada a datos pasa por un servicio Angular `@Injectable`.
- No agregues funcionalidades fuera del scope del MVP v1.0 (ver `/docs/01-mvp-scope.md`).
- No crees componentes UI o formularios sin leer primero `/docs/standards/ui-components.md` y `/docs/standards/forms.md`.

---

## 4. Comandos útiles

```bash
pnpm dev              # ng serve pos-angular (http://localhost:4200)
pnpm build            # ng build pos-angular (producción)
pnpm typecheck        # tsc --noEmit + ng build dev
pnpm lint             # ng lint pos-angular
pnpm test             # vitest run (dominio + DTOs + use-cases + forms)
pnpm test:watch       # vitest en modo watch
pnpm test:e2e         # playwright (apunta a http://localhost:4200)
pnpm db:migrate       # aplicar migrations a Supabase local
pnpm db:reset         # resetear DB local (cuidado en prod)
pnpm db:types         # regenerar tipos TS desde Supabase
```

---

## 5. Convenciones de código

- **Nombres de archivos:** `kebab-case.ts` (ej: `create-sale.use-case.ts`).
- **Componentes Angular:** `kebab-case.component.ts` con clase `PascalCase`. Selector con prefijo `mo-` (ej: `mo-pos-page`).
- **Nombres de tablas y columnas en DB:** `snake_case` (ej: `sale_items`, `created_at`).
- **Imports absolutos** desde `@/` (apunta a `src/`) y `@angular-app/` (apunta a `apps/pos-angular/src/app`).
- **Idioma:** código en inglés, comentarios y mensajes de UI en español. Documentación interna en español.

---

## 6. Coordinación con Codex

Codex (OpenAI) también trabaja en este repo. Para evitar conflictos:

- Codex lee `AGENTS.md` (en la raíz). Su contenido apunta a esta misma documentación en `/docs`.
- Si trabajas en una tarea que Codex también podría tocar (por commits recientes en otro feature), avísale al humano.
- **No edites `AGENTS.md` y `CLAUDE.md` para que digan cosas distintas.** Las reglas son una sola fuente de verdad: `/docs`.

---

## 7. Cuando no sepas algo

Pregunta. Es mejor parar 5 minutos a clarificar que implementar 2 horas en la dirección equivocada.

Las preguntas que valen la pena hacer:
- ¿Esta funcionalidad está en el scope del MVP?
- ¿Hay un ADR sobre esto?
- ¿La regla de negocio está documentada en algún módulo?
- ¿Quién es el responsable de esta decisión: técnica o de negocio?

---

## 8. Estándares de código (obligatorios)

Los estándares están en `/docs/standards/`. **Léelos antes de crear cualquier componente, formulario o patrón nuevo.**

| Estándar | Archivo | Cuándo aplica |
|---|---|---|
| Componentes UI centralizados | `/docs/standards/ui-components.md` | Siempre que crees un componente Angular |
| Formularios reactivos | `/docs/standards/forms.md` | Siempre que construyas un form |
| Principios SOLID | `/docs/standards/solid-principles.md` | Al diseñar use-cases, repos, adapters |
| Patrones de diseño | `/docs/standards/design-patterns.md` | Al elegir cómo estructurar lógica nueva |

### Resumen de reglas críticas

**UI:**
- Todo componente reutilizable Angular va en `apps/pos-angular/src/app/shared/`.
- Standalone components con selector `mo-*`.
- Tailwind v4 (`@import 'tailwindcss'` + `@theme` en CSS). Sin shadcn/Radix.

**Formularios:**
- Stack obligatorio: Angular Reactive Forms + schema Zod.
- El schema Zod del DTO es la única fuente de verdad de validación.
- Patrón 3 archivos: `factory.ts` + `mapper.ts` (en `src/modules/.../forms/`) + `presenter.ts` (en `apps/pos-angular/src/app/features/<modulo>/`).

**Arquitectura:**
- Domain → Application → Infrastructure (dirección de dependencias: de arriba hacia abajo).
- Use-case = función con deps inyectadas como argumento (TS puro, sin Angular).
- Repository: interfaz en `src/modules/.../domain/repositories/`, implementación Angular en `apps/pos-angular/src/app/features/<modulo>/infrastructure/`. Nunca expone tipos de Supabase al dominio.
- Errores de dominio: `Result<T, E>`. Errores técnicos: `throw`.

---

## 9. Specs de sesión

Al inicio de cada sesión de trabajo **crea un archivo de spec** copiando la plantilla:

```bash
cp docs/sessions/_TEMPLATE.md docs/sessions/YYYY-MM-DD-<tema>.md
```

Llena el spec durante la sesión y complétalo al terminar. El próximo agente (o tú en la próxima sesión) leerá este archivo para entender qué pasó y qué sigue.

**El spec documenta:**
- Qué HUs se trabajaron.
- Qué archivos se crearon/modificaron.
- Qué decisiones se tomaron (y por qué).
- Bloqueos y preguntas pendientes.
- Próximos pasos concretos.

Los specs viven en `/docs/sessions/` y **no se borran** — son el historial de trabajo del proyecto.
