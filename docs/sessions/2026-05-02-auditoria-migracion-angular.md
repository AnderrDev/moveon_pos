# Spec de Sesión — 2026-05-02 — Auditoría migración Next → Angular

---

## Metadatos

| Campo | Valor |
|---|---|
| Fecha | 2026-05-02 |
| Sprint | Migración Angular |
| Agente | Claude Code (Opus 4.7) |
| HUs trabajadas | N/A — auditoría de migración |
| Estado | Completada |

---

## 1. Objetivo de la sesión

Revisar y auditar el estado actual de la migración Next.js → Angular (ADR 0006): cobertura de fases, calidad del código generado, riesgos abiertos y deuda. Entregar un reporte de status y QA con próximos pasos priorizados.

---

## 2. Estado de avance por fase

Plan en `docs/migration/angular-migration-plan.md`.

| Fase | Subtarea | Estado | Evidencia |
|---|---|---|---|
| 1 — Base + POS | Workspace Angular 21 | ✅ | `angular.json`, `apps/pos-angular/` |
| 1 | Login portado | ✅ | `features/auth/login.page.ts` + `login-form.presenter.ts` |
| 1 | Shell responsive | ✅ | `core/layout/shell.component.ts` (sidebar + bottom-nav) |
| 1 | Catálogo POS desde Supabase | ✅ | `features/pos/pos-data.service.ts` |
| 1 | Carrito con signals | ✅ | `features/pos/pos-cart.store.ts` |
| 1 | Cobro multi-medio | ✅ | `pos.page.ts` (modal checkout) |
| 1 | Venta vía RPC `create_sale_atomic` | ✅ | `pos-sale.service.ts` |
| 1 | Variables Supabase reales | ❌ | `environments/environment.ts` con placeholders |
| 1 | Probar venta con caja abierta | ❌ | Sin evidencia, no hay E2E ni test manual reportado |
| 1 | Ticket imprimible post-venta | ❌ | No portado |
| 1 | Historial / anulación | ❌ | No portado |
| 2 — Productos/categorías | — | ❌ | `placeholder.page.ts` |
| 3 — Inventario y caja | — | ❌ | `placeholder.page.ts` |
| 4 — Clientes y reportes | — | ❌ | `placeholder.page.ts` |
| 5 — Retiro de Next | — | ❌ | `src/app/**` y deps React siguen presentes |

**Cobertura funcional Angular:** ≈ 25–30 % del scope MVP (sólo login + POS feliz).
**Cobertura código portado:** 0 de 78 `.tsx/.ts` de `src/modules` reemplazados; sólo se reusan factory/mapper/sale-calculator del dominio (que ya eran TS puro).

---

## 3. Lo que verificamos en esta sesión

### 3.1 Build, typecheck, lint, tests

| Comando | Resultado |
|---|---|
| `corepack pnpm typecheck` | ✅ `tsc --noEmit` + `ng build --configuration development` ok |
| `corepack pnpm test` | ✅ 17 archivos / 116 tests (todos del legacy + dominio) |
| `corepack pnpm lint` | ✅ `next lint` 0 errores — **pero no cubre `apps/pos-angular`** |
| `corepack pnpm build` | ✅ Bundle producción 556 kB inicial / 132 kB transfer |

### 3.2 Archivos auditados (Angular)

- `angular.json`, `tsconfig.angular.json`, `apps/pos-angular/tsconfig.app.json`
- `apps/pos-angular/src/main.ts`, `index.html`, `styles.css`, `environments/environment.ts`
- `app.component.ts`, `app.config.ts`, `app.routes.ts`
- `core/auth/{auth.guard,session.service}.ts`
- `core/supabase/supabase-client.service.ts`
- `core/layout/shell.component.ts`
- `features/auth/{login.page,login-form.presenter}.ts`
- `features/pos/{pos.page,pos-cart.store,pos-data.service,pos-sale.service,pos.types}.ts`
- `features/placeholder/placeholder.page.ts`

### 3.3 Adherencia a estándares

- ✅ Patrón factory + mapper + presenter respetado en `auth` (cumple `docs/standards/forms.md` §0).
- ✅ Reactive Forms con validación Zod previa a `getRawValue()`.
- ✅ Dominio reutilizado sin importar Angular (sale-calculator, factories, mappers).
- ✅ Tailwind v4 (`@import 'tailwindcss';` + `@theme`), tokens HSL idénticos al legacy.
- ✅ `RouterOutlet` + `loadComponent` para code-splitting.
- ❌ No existe `apps/pos-angular/src/app/shared/` aún (estándar UI lo exige cuando se replique algo).
- ❌ No hay tests Angular (`*.spec.ts`): presenter, guard, services y store sin cobertura.

---

## 4. Hallazgos — Críticos (bloquean producción)

### C1 — Vercel desplegará la app rota
`vercel.json` sigue declarando `"framework": "nextjs"` y `buildCommand: "pnpm build"` que ahora corre `ng build pos-angular`. Salida es `dist/pos-angular/`, no `.next`. Vercel intentará servir Next y no encontrará el output. Hay que decidir:
- (a) Cambiar `vercel.json` a framework Angular y `outputDirectory: "dist/pos-angular/browser"`, o
- (b) Mantener `pnpm build:next` mientras dure la convivencia y crear un proyecto Vercel separado para Angular.

### C2 — `environment.ts` con placeholders
`apps/pos-angular/src/environments/environment.ts` tiene `https://replace-with-project.supabase.co` y `replace-with-anon-key` hardcodeados. La app **no puede autenticarse ni leer datos** en cualquier entorno hasta que se carguen valores reales. Además, viola la idea de cargar runtime config (planeada en sesión 04-30).

### C3 — Idempotencia rota en POS
`pos-sale.service.ts:54` genera `idempotency_key = '${cashSessionId}-${Date.now()}'`. Cada llamada produce una clave nueva, anulando el dedupe que ya hace `create_sale_atomic` (que busca `where idempotency_key = …`). Un doble click crearía dos ventas. Debe generarse **una vez por intento de cobro** (al abrir checkout) y resetearse sólo al confirmar/cancelar.

### C4 — `next lint` no audita Angular
El comando `pnpm lint` corre `next lint`, que sólo conoce `src/app` y `pages/`. **Todo `apps/pos-angular` queda sin lint**. Riesgo alto a medida que crezca el código Angular.

---

## 5. Hallazgos — Mayores

### M1 — Dev-defaults con credenciales en factory
`src/modules/auth/forms/login-form.factory.ts:21-31` precarga `admin@moveonpos.co` / `Admin1234!` cuando `process.env.NODE_ENV === 'development'`. En el bundle Angular del navegador `process` no existe, así que hoy resuelve a vacío — pero cualquier polyfill (Vite/Vercel/Sentry) que defina `process.env.NODE_ENV` filtra credenciales. El presenter Angular debería recibir defaults vía DI o variable de entorno explícita.

### M2 — Sin tests para código Angular
0 `.spec.ts` en `apps/pos-angular`. El presenter, guard, store y servicios son código nuevo no cubierto. Vitest está en deps pero el peer warning de Angular 21 (`@angular/build` espera `vitest@^4`) no se ha resuelto.

### M3 — Hard-cast del cliente Supabase
`pos-sale.service.ts:43` hace `as unknown as RpcClient` para llamar `rpc()`. Si la firma del RPC cambia, no hay protección de tipos. Mejor regenerar `database.types.ts` para incluir RPCs o tipar localmente el wrapper.

### M4 — Catálogo limitado a 200 SKUs
`pos-data.service.ts:37` `.limit(200)`. Cuando la tienda crezca el POS dejará de mostrar productos sin warning. Necesita paginación o filtro por categoría primero.

### M5 — Idempotency key + retries
Relacionado con C3: además de fijar la key, falta UX de "reintentar" cuando el RPC falle por red. Hoy un error tira el flujo y deja el carrito intacto pero sin diferenciar "creada en el server pero perdió respuesta" vs "no creada".

### M6 — Sin PWA manifest ni Service Worker
ADR 0006 menciona "puede seguir siendo PWA". `index.html` sólo tiene `<meta theme-color>`; no hay `manifest.webmanifest`, no hay `@angular/service-worker`. Fase de retiro Next no se puede cerrar sin esto si se quiere paridad.

### M7 — `experimentalDecorators: true` en `tsconfig.angular.json`
Angular 16+ usa decoradores TC39 estándar. La bandera funciona pero arrastra el modo legacy heredado del tsconfig Next. A revisar tras retirar Next.

---

## 6. Hallazgos — Menores

- **m1** `angular.json` declara assets desde `public/` pero no existe esa carpeta a nivel root → no se copian favicon/manifest. Crear carpeta o ajustar input.
- **m2** Sidebar Angular usa círculos vacíos donde el legacy usaba iconos `lucide-react`. Falta decisión: portar a `lucide-angular` (libre), ng-icons, o SVGs in-house.
- **m3** `app.config.ts` usa `provideZoneChangeDetection`. Con la app Angular 100% basada en signals, conviene evaluar `provideExperimentalZonelessChangeDetection`.
- **m4** `placeholder.page.ts` lee `route.snapshot.data` con `string` sin fallback; si una ruta olvida `data.title` el título queda `undefined`.
- **m5** Cart store usa `productId` como `key`, así que un mismo producto con distintos descuentos colapsa en una sola línea (igual al legacy Zustand).
- **m6** `package.json.scripts.lint` aún ejecuta `next lint` (deprecated por Next 16).
- **m7** `next.config.ts`, `tailwind.config.ts`, `postcss.config.mjs` siguen en root junto con `.postcssrc.json` Angular: doble configuración, fácil de tocar la equivocada.
- **m8** `pos.page.ts:456` declara `readonly String = String` para usar el global en plantilla — ok funcional, pero huele; mejor un pipe o método dedicado.
- **m9** El catálogo no muestra stock disponible en la tarjeta (regresión vs Next): el operador no ve si un producto está agotado antes de tocarlo.
- **m10** `signOut` en shell no captura errores; si Supabase falla, el usuario queda en estado inconsistente.

---

## 7. Riesgos para la migración

| Riesgo | Impacto | Mitigación propuesta |
|---|---|---|
| Convivencia Next + Angular indefinida | Bundle, lint, deploy, lock duplicados | Fijar deadline de fase 5 y bloquear features nuevas en Next |
| Vercel rompe en próximo push (C1) | App caída en preview/prod | Decidir hosting Angular antes del próximo deploy |
| RLS policies pensadas para Server Actions | Llamadas browser pueden fallar permisos | Auditar RLS por tabla con cliente browser real (sesión 04-30 pendiente) |
| Edge Functions / facturación aún Next-only | Imposible migrar billing sin replantear | Mover a Edge Functions Supabase para que Angular las invoque |
| Tests Angular ausentes | Regresiones invisibles | Setup vitest+`@analogjs/vitest-angular` o Karma; bloquear PRs sin spec |
| Service-role en cliente | Por ahora **no detectado** en `apps/pos-angular` ✅ | Mantener guard manual + revisar en futuros módulos |

---

## 8. Próximos pasos priorizados

**Bloqueantes antes de seguir migrando:**
1. Resolver C1: actualizar `vercel.json` o crear proyecto separado para Angular y validar deploy preview.
2. Resolver C2: cargar `environment.ts` real (idealmente runtime config) y probar login + venta E2E con caja abierta.
3. Resolver C3: mover generación de `idempotency_key` al apertura del checkout (`openCheckout()`), persistirla en el store, regenerar sólo al `clearCart()` exitoso.
4. Resolver C4: migrar lint a ESLint flat-config con `@angular-eslint` y cubrir `apps/pos-angular` + dejar `next lint` sólo mientras viva el legacy.

**Antes de portar el siguiente módulo (Productos):**
5. Setup de tests Angular y escribir specs para `LoginFormPresenter`, `PosCartStore`, `authGuard`, `PosSaleService`.
6. Aislar dev-defaults del login (M1) inyectando defaults vía token Angular.
7. Tipar `rpc('create_sale_atomic', …)` con un wrapper que reemplace el `as unknown` (M3).

**Continuación de fases:**
8. Fase 2: portar `productos` + `productos/categorias` siguiendo factory + mapper + presenter.
9. Fase 3: portar `caja` (apertura/cierre/reporte) y `inventario`.
10. Fase 4: portar `clientes` y `reportes`.
11. Fase 5: PWA + retiro completo de Next/React/RHF/Zustand/lucide-react/@hookform/resolvers/@tanstack/react-query.

---

## 9. Decisiones tomadas en esta sesión

| Decisión | Razón |
|---|---|
| Marcar la migración como ~25 % del MVP, no 80 % | El plan indica "fase 1 completada", pero ticket/historial/anulación faltan y no se ha probado contra Supabase real. |
| Promover a "crítico" el problema de idempotencia | `create_sale_atomic` valida por `idempotency_key`; el cliente actual lo invalida por usar `Date.now()`. |
| No tocar código en esta sesión | El usuario pidió **auditoría**. Cualquier fix entra como sesión propia. |

---

## 10. ADRs creados o actualizados

- (ninguno — auditoría sólo)

---

## 11. Tests

- [x] `corepack pnpm typecheck` — pasó
- [x] `corepack pnpm lint` — pasó (sólo legacy Next)
- [x] `corepack pnpm test` — 116/116 verde (sólo dominio + legacy)
- [x] `corepack pnpm build` — Angular producción ok

---

## 12. Bloqueos y preguntas pendientes

- ¿Vercel mantiene un único proyecto durante la convivencia o se separa Angular en otro?
- ¿La PWA es requisito de v1.0 o se difiere a v1.1?
- ¿Mantener `lucide-react` o migrar a una librería de iconos compatible con Angular antes de portar productos/inventario?
- ¿Quién valida con Supabase real el flujo de venta (operador o equipo técnico)?

---

## 13. Notas adicionales

- La auditoría no modificó código fuente, sólo documentación de sesión.
- El próximo agente debería abrir, en orden, los issues C1→C4 antes de aceptar PRs nuevos en Angular.
- Mantener `pnpm dev:next` y `pnpm build:next` operativos hasta que la fase 5 esté lista — son la red de seguridad del POS actual.
