# Spec de Sesión — 2026-05-02 — Cleanup Next/Vercel

---

## Metadatos

| Campo | Valor |
|---|---|
| Fecha | 2026-05-02 |
| Sprint | Migración Angular |
| Agente | Claude Code (Opus 4.7) |
| HUs trabajadas | N/A — saneamiento |
| Estado | Completada |

---

## 1. Objetivo de la sesión

Quitar todo el código, configuración y dependencias relacionadas con Next.js, React, RHF, Zustand y Vercel para dejar la app en Angular como único stack, conservando el dominio TS-puro reutilizable (entidades, value objects, DTOs, use-cases, forms factory+mapper, sale-calculator, types y validaciones).

---

## 2. Lo que se implementó

### 2.1 Archivos eliminados (109 entradas en git)

**Next/React UI y rutas:**
- `src/app/**/*` (layouts, páginas, loadings de Next App Router).
- `src/middleware.ts`.
- `src/modules/auth/LoginForm.tsx`.
- `src/modules/**/components/*.tsx` (todos los componentes React por feature).
- `src/modules/**/hooks/*.ts` (RHF/`use-*-form.ts`).
- `src/modules/**/store/*.ts` (Zustand).
- `src/shared/components/**` (UI shadcn/Radix).
- `src/shared/forms/form-error-resolver.ts` (RHF).
- `src/shared/hooks/use-action-feedback.ts`.
- `src/shared/lib/auth-context.ts` (RSC `cache()` + server client).
- `src/shared/lib/utils.ts` (clsx + tailwind-merge `cn()`, sin consumidores).

**Server Actions:**
- `src/modules/**/application/actions/*.ts` (todos los `'use server'`).

**Repositorios Supabase Next-only:**
- `src/modules/**/infrastructure/**` (acoplados al cliente `cookies()` de Next).
- `src/infrastructure/supabase/{client,server,service-role,env}.ts`.
- `src/infrastructure/config/**` (vacío).

**Configs Next/Vercel:**
- `next.config.ts`, `next-env.d.ts`, `postcss.config.mjs`, `tailwind.config.ts`.
- `.eslintrc.json` (extends `next/*`).
- `vercel.json`, `.vercelignore`.
- `package-lock.json` (lockfile npm sobrante; el repo usa pnpm).
- `forms.md` (orphan en root).

**Tests muertos:**
- `tests/unit/shared/forms/form-error-resolver.test.ts`.
- `tests/unit/modules/sales/cart-store.test.ts`.
- `tests/unit/infrastructure/supabase-env.test.ts`.

### 2.2 Archivos modificados

- `package.json`: stack reducido a Angular + Supabase JS + Zod + RxJS + Vitest + Playwright + Tailwind. Eliminadas: `next`, `react`, `react-dom`, `react-hook-form`, `@hookform/resolvers`, `@tanstack/react-query`, `zustand`, `lucide-react`, `@supabase/ssr`, `eslint-config-next`, `@testing-library/react`, `@testing-library/jest-dom`, `@types/react`, `@types/react-dom`, `class-variance-authority`, `clsx`, `tailwind-merge`, `decimal.js`, `date-fns`, `eslint`. Scripts `dev:next`, `build:next`, `start:next`, `typecheck:next` eliminados. `lint` queda como placeholder hasta cablear `@angular-eslint`.
- `tsconfig.json`: ahora extiende `tsconfig.angular.json` y sólo agrega `noEmit`. Sin plugin Next, sin `jsx`, sin `allowJs`.
- `tsconfig.angular.json`: `experimentalDecorators` retirado (Angular 21 usa decoradores TC39 estándar). Añadido `types: ['node']` para que vitest/playwright/process compilen.
- `vitest.config.ts`: paths de coverage actualizados (sin `store/`, sin `shared/forms/`).
- `playwright.config.ts`: `baseURL` y `webServer.url` apuntan a `http://localhost:4200`. `process.env['CI']` con bracket access (cumple `noPropertyAccessFromIndexSignature`).
- `.env.example`: variables renombradas a `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `APP_NAME`, etc. (sin prefijo `NEXT_PUBLIC_`). Notas Vercel removidas; nota Angular añadida.
- `.gitignore`: secciones `next.js`, `vercel`, `next-env.d.ts`, `forms.md`, `.pnp`, `.yarn` retiradas; añadidas `playwright-report` y `test-results`.
- `CLAUDE.md` y `AGENTS.md`: stack reescrito a Angular único; eliminada toda mención de Next/React/RHF/Vercel/shadcn; comandos actualizados.
- `docs/02-architecture.md`: tabla de stack, estructura de carpetas, sección §4 (clientes Supabase), §6 (Edge Functions), §7 (secretos), §9.2 (deploy) y §10 (observabilidad) reescritas para Angular.
- `docs/standards/forms.md`: rewrite Angular-only (presenter `@Injectable` con `NonNullableFormBuilder` + signal de errores).
- `docs/standards/ui-components.md`: rewrite Angular-only (componentes `mo-*` standalone con `OnPush`, sin shadcn).
- `docs/adr/0006-migracion-next-a-angular.md`: estado actualizado a "Aceptado — Next/React/Vercel retirados". Añadida sección "Estado del cleanup".
- `src/modules/auth/forms/login-form.factory.ts`: defaults vacíos por defecto, sin leer `process.env.NODE_ENV` (ya no filtra credenciales al bundle Angular). Acepta `Partial<>` para overrides.
- `src/modules/products/forms/categoria-form.factory.ts`: misma normalización.
- `src/modules/products/forms/product-form.factory.ts`: misma normalización (sin defaults de "Whey Protein 1kg").
- `tests/unit/modules/auth/login-form.test.ts`: eliminado el caso `precarga credenciales en development`; añadido caso de overrides parciales.
- `tests/unit/modules/products/product-form-schema.test.ts`: eliminados los casos de precarga; añadido caso de defaults limpios.

### 2.3 Archivos sin cambios pero relevantes

- `apps/pos-angular/**` íntegro: la auditoría 2026-05-02 ya documentó su estado.
- `supabase/migrations/**`: intactas. `create_sale_atomic` y `void_sale_atomic` siguen siendo el contrato transaccional que Angular invoca.
- `scripts/seed-admin-user.mjs`: contiene service role hardcodeado (riesgo conocido — fuera de scope de este cleanup).

---

## 3. Decisiones tomadas

| Decisión | Alternativa descartada | Razón |
|---|---|---|
| Eliminar `infrastructure/repositories/*.ts` | Reescribirlas para aceptar `SupabaseClient` por DI | Ningún consumidor Angular las usa hoy; cuando se porten módulos se reescribirán dentro de `apps/pos-angular`. |
| Eliminar `application/actions/*.ts` | Convertir Server Actions a servicios Angular | Las Server Actions son contrato Next; la lógica equivalente vivirá como Angular `Injectable` por feature. |
| Conservar `application/use-cases/*.ts` y `application/dtos/*.ts` | Borrar también | Son TS puro y mantienen viva la lógica/los Zod DTOs. |
| Conservar `domain/**` íntegro | Borrar el dominio sin uso | Es el contrato de negocio del MVP. |
| Quitar dev-defaults del `process.env.NODE_ENV` en factories | Mantenerlos como antes | M1 de la auditoría: en Angular el bundle del browser podría exponer credenciales si algún polyfill define `process.env`. Mejor que el presenter inyecte overrides. |
| Mantener `lint` como placeholder con guía de `ng add angular-eslint` | Borrar el script | CI ya lo invoca; un mensaje informativo evita silencios mientras se cabela `@angular-eslint`. |
| Deferir hosting | Cablear Cloudflare/Netlify ahora | Es decisión de negocio (costo + dominios + Supabase region). Documentado en arquitectura §9.2 como pendiente. |

---

## 4. ADRs creados o actualizados

- `docs/adr/0006-migracion-next-a-angular.md`: añadida revisión 2026-05-02 confirmando que Next/Vercel quedaron fuera del repo.

---

## 5. Tests

- [x] `corepack pnpm install` — 248 paquetes removidos, 3 añadidos. Sólo persiste el peer warning conocido `vitest@^4.0.8` (ya documentado).
- [x] `corepack pnpm typecheck` — pasa (`tsc --noEmit` + `ng build dev`).
- [x] `corepack pnpm lint` — placeholder (imprime guía).
- [x] `corepack pnpm test` — 14 archivos / **101 tests** pasando.
- [x] `corepack pnpm build` — bundle producción 532 kB inicial / 130 kB transferencia.

Cambios en cobertura: pasamos de 17 archivos / 116 tests a 14 / 101 al borrar:
- `cart-store.test.ts` (Zustand, 6 tests).
- `form-error-resolver.test.ts` (RHF, 5 tests).
- `supabase-env.test.ts` (env Next-only, 4 tests).

Los 101 tests restantes son TS puro y no dependen de ningún framework UI.

---

## 6. Bloqueos y preguntas pendientes

- **Hosting estático:** Vercel ya no aplica. Hay que decidir entre Cloudflare Pages, Netlify, Supabase Storage + CDN, GitHub Pages o un contenedor propio.
- **ESLint Angular:** falta correr `ng add @angular-eslint/schematics` (genera `eslint.config.js` y completa `architect.lint` en `angular.json`). Hasta entonces, `pnpm lint` sólo imprime guía.
- **Tests Angular:** el código bajo `apps/pos-angular/src/app/**` sigue sin specs (presenter, guard, store, servicios). Cuando exista, decidir entre `@analogjs/vitest-angular` (alineado al stack actual de tests) o Karma.
- **`vitest@^4`:** `@angular/build` espera 4.0.8+; el repo está en 2.1.9. Migrar cuando @analogjs/vitest-angular soporte v4.
- **C1 de la auditoría (vercel.json) RESUELTO** por borrado.
- **C2 (environment.ts placeholder):** sigue abierto — `apps/pos-angular/src/environments/environment.ts` aún tiene `replace-with-...`.
- **C3 (idempotency_key con `Date.now()`):** sigue abierto.
- **C4 (lint sin cubrir Angular):** sigue abierto, ahora además sin lint del lado Next legacy (que ya no existe). Cubrirlo cuando se cablea `angular-eslint`.

---

## 7. Próximos pasos

1. **`ng add @angular-eslint/schematics`** y restaurar `pnpm lint = ng lint pos-angular`.
2. **Cargar runtime de Supabase** en `apps/pos-angular/src/environments/environment.ts` (idealmente vía `fetch('/runtime-config.json')` al bootstrap) — cierra C2.
3. **Idempotency key persistente** en `pos-sale.service.ts`: generar al abrir checkout, reusar en reintentos, regenerar sólo al `clearCart()` exitoso — cierra C3.
4. **Hosting estático**: elegir target, configurar `pnpm build` para producir `dist/pos-angular/browser` y publicar.
5. **Setup tests Angular** (`@analogjs/vitest-angular` o Karma) y escribir specs para `LoginFormPresenter`, `PosCartStore`, `authGuard`, `PosSaleService`.
6. Continuar Fase 2 del plan de migración: portar Productos + Categorías reusando `src/modules/products/{forms,application/{dtos,use-cases},domain}` desde el nuevo `apps/pos-angular/src/app/features/products/`.

---

## 8. Notas adicionales

- Tras este cleanup el repo es 100 % Angular. Cualquier import nuevo de `next/*`, `react`, `react-hook-form`, `zustand`, `@hookform/*`, `@supabase/ssr`, `lucide-react`, `class-variance-authority` o `clsx` debe rechazarse en code review.
- `src/` sólo contiene TS puro: dominio, DTOs, use-cases, forms factory/mapper, validaciones, types, helpers (`format`, `payment-methods`, `result`) y los tipos generados de Supabase. La UI vive sólo bajo `apps/pos-angular/src/app/**`.
- Los specs anteriores (`2026-04-30-angular-migration.md`, `2026-05-02-auditoria-migracion-angular.md`) siguen vigentes como referencia histórica.
- Hay un commit pendiente: el árbol está limpio en compilación pero git tiene 109 borrados + 17 modificaciones que deben commitearse cuando el usuario lo apruebe.
