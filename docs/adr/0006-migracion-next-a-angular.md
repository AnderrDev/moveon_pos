# ADR 0006 — Migración de Next.js/React a Angular

**Fecha:** 2026-04-30 (revisión 2026-05-02 — cleanup completado)
**Estado:** Aceptado — Next/React/Vercel retirados el 2026-05-02
**Decisores:** Equipo MOVEONAPP

## Contexto

El POS inició como una aplicación Next.js 15 + React 19. La arquitectura de negocio ya separa dominio, aplicación e infraestructura, pero la capa de UI y parte de la orquestación quedaron acopladas a:

- App Router y Server Components.
- Server Actions.
- React Hook Form.
- Zustand.
- shadcn/Radix.

El equipo decide migrar el sistema a Angular, manteniendo el mismo alcance funcional, reglas de negocio, diseño operativo, validaciones y Clean Architecture.

## Decisión

Migramos a **Angular standalone** como framework principal de la PWA. La aplicación Angular vive en `apps/pos-angular`. El cleanup del 2026-05-02 retiró completamente Next/React/RHF/Zustand/Vercel; sólo el dominio TS-puro permanece bajo `src/modules`.

La arquitectura queda así:

- Dominio TypeScript puro se conserva y se reutiliza desde `src/modules/**/domain` y `src/modules/**/application/{dtos,use-cases}`.
- Schemas Zod, factories y mappers se conservan como fuente de verdad en `src/modules/<feature>/forms/`.
- La UI y la orquestación viven en `apps/pos-angular/src/app/features/<feature>` con presenters/facades Angular (`@Injectable`) o stores con signals.
- Zustand fue reemplazado por stores Angular con `signal`/`computed`.
- Server Actions desaparecieron; las llamadas a Supabase pasan por servicios Angular con RLS, o por RPC transaccional / Edge Function para escrituras críticas.
- Operaciones críticas de escritura deben usar RPC/Edge Function, no secuencias de inserts desde componentes.
- UI se porta a componentes Angular standalone y Tailwind CSS 4 (sin shadcn/Radix).

## Consecuencias

### Positivas

- Angular Reactive Forms encaja mejor con el patrón de formularios ya documentado.
- Signals permiten estado local explícito sin librería adicional.
- La app puede seguir siendo PWA responsive y desplegable como sitio estático.
- La lógica de dominio actual sigue siendo portable y testeable.

### Negativas

- Los componentes visuales deben reescribirse; shadcn/Radix no se reutilizan directamente.
- Las Server Actions desaparecen; hay que mover seguridad y transaccionalidad a RLS/RPC/Edge Functions.
- Se requiere disciplina para no duplicar reglas de negocio en servicios Angular.
- Hosting y CI/CD quedan por re-cablear (Vercel ya no aplica). Decisión pendiente.

### Estado del cleanup (2026-05-02)

- ✅ `src/app/`, `src/middleware.ts`, todos los Server Actions, componentes React, hooks React, Zustand store y clientes Supabase Next-only fueron eliminados.
- ✅ `vercel.json`, `.vercelignore`, `next.config.ts`, `next-env.d.ts`, `postcss.config.mjs`, `tailwind.config.ts` y `.eslintrc.json` (Next) fueron eliminados.
- ✅ `package.json` ya no incluye `next`, `react`, `react-dom`, `@hookform/*`, `react-hook-form`, `zustand`, `lucide-react`, `@tanstack/react-query`, `@supabase/ssr`, `eslint-config-next`, `@testing-library/react`, `@types/react*`.
- ⚠️ ESLint Angular pendiente de cablear (`pnpm lint` apunta a `ng lint pos-angular`; falta correr `ng add @angular-eslint/schematics`).
- ⚠️ Hosting estático pendiente de definir.

## Reglas derivadas

- No se crea lógica de negocio en componentes Angular.
- Todo formulario de negocio Angular usa: `factory.ts` + `mapper.ts` + `presenter.ts`.
- Los servicios Angular de infraestructura no exponen tipos Supabase a componentes.
- Los componentes Angular solo consumen presenters, stores o servicios de aplicación.
- El port se hace por módulos completos, empezando por `auth` y `sales/POS`.

## Referencias

- Angular CLI `ng new`: https://angular.dev/cli/new
- Angular standalone components: https://angular.dev/reference/migrations/standalone
- Angular application builder: https://angular.dev/tools/cli/build
- Tailwind CSS con Angular: https://tailwindcss.com/docs/guides/angular
