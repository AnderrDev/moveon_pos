# Spec de Sesión — 2026-07-10 — Separar catálogo público en app `landing-web`

> Registro de trabajo de la sesión. Fuente de continuidad para el próximo agente.

---

## Metadatos

| Campo | Valor |
|---|---|
| Fecha | 2026-07-10 |
| Sprint | Post-Sprint 3 |
| Agente | Claude Code |
| HUs trabajadas | Separación arquitectónica del catálogo público (landing de clientes) del POS |
| Estado | Completada (código); pendiente paso manual en Netlify |

---

## 1. Objetivo de la sesión

Separar por completo `/catalogo` (landing pública para clientes: productos, batidos, café, snacks, combos, ubicación) del sistema POS, de modo que sea un producto independiente con su propio build y deploy, sin código del POS en el bundle que ve el cliente.

Decisiones tomadas con el usuario antes de implementar (ver plan aprobado):
- Segundo proyecto Angular en el mismo workspace pnpm, no un repo separado.
- Nombre del proyecto: `landing-web` (no `catalogo-web` — corrección explícita del usuario).
- Hosting: Netlify (no Vercel), por ahora en el mismo dominio vía proxy, no subdominio nuevo.

---

## 2. Lo que se implementó

### 2.1 Archivos creados
- `apps/landing-web/**` — nueva app Angular standalone: `main.ts` (bootstrapea `CatalogoPage` directo, sin Router), `app.config.ts` (zoneless: `provideBrowserGlobalErrorListeners` + `provideAppInitializer` para config/Sentry), `index.html` (título, favicon real, fonts de Google movidas aquí desde el template), `styles.css` (reset mínimo, sin Tailwind — deliberado), `tsconfig.app.json`.
- `apps/landing-web/src/app/features/catalog/{catalogo.page.ts,catalogo.service.ts}` — movidos desde `pos-angular` (`git mv`, historial preservado).
- `apps/landing-web/src/app/core/{config,supabase,observability}/*` — copias de `AppConfigService`, `SupabaseClientService` y el wrapper de Sentry (no compartidas, ver ADR 0012).
- `apps/landing-web/public/assets/catalog/*` — copia de los 7 assets del catálogo.
- `apps/landing-web/public/runtime-config.example.json`.
- `netlify.landing.toml` — config de build/publish/redirect para el segundo sitio Netlify.
- `docs/adr/0012-separar-landing-en-app-independiente.md`.
- `docs/modules/catalogo.md`.

### 2.2 Archivos modificados
- `angular.json` — nuevo proyecto `landing-web` (build/serve/lint targets, budgets calibrados con el build real: 450kB/600kB inicial, 24kB/48kB por componente).
- `package.json` — scripts `dev:landing`, `build:landing`, `lint:landing`, `typecheck:landing` + hooks `pre*:landing`.
- `scripts/generate-runtime-config.mjs` — ahora escribe `runtime-config.json` para **ambas** apps desde el mismo `.env.local`.
- `.env.example` — documenta `LANDING_APP_NAME` (opcional).
- `.gitignore` — agrega `apps/landing-web/public/runtime-config.json`.
- `netlify.toml` — agrega redirects de proxy `/catalogo` y `/catalogo/*` hacia el sitio de `landing-web` (placeholder `<landing-site>` pendiente de reemplazar).
- `tsconfig.json` (raíz) — se removió un `references` que el schematic de `ng generate application` agregó automáticamente (rompía `tsc --noEmit` por faltar `composite: true`; `pos-angular` nunca lo tuvo y se type-checkea vía `ng build`, no vía project references).
- `docs/02-architecture.md` — corrige la fila "Hosting frontend | TBD" (obsoleta desde ADR 0009) para reflejar Netlify + el split en dos apps.
- `apps/pos-angular/src/app/app.routes.ts` — se removió la ruta `catalogo`.

### 2.3 Archivos eliminados
- `apps/pos-angular/src/app/features/catalog/` (movido a `landing-web`).
- `apps/pos-angular/public/assets/catalog/*` (copiado a `landing-web`, ya no se usa en el POS).

---

## 3. Decisiones tomadas

| Decisión | Alternativa descartada | Razón |
|---|---|---|
| Segundo proyecto Angular en el mismo workspace, nombrado `landing-web` | Repo Git separado | Reutiliza ~900 líneas de UI ya verificadas (marca v4, filtros, paginación) sin reescribir; el nombre `landing-web` refleja que es la vitrina completa, no solo "el catálogo" (corrección del usuario sobre `catalogo-web`) |
| Sin Router de Angular en `landing-web` | Mantener `provideRouter` como en pos-angular | El catálogo navega por anclas (`#seccion`), nunca usó rutas Angular — Router hubiera sido peso muerto |
| Zoneless (`provideBrowserGlobalErrorListeners`, sin `zone.js`) | Mirror exacto de `provideZoneChangeDetection` de pos-angular | El componente ya es 100% signals + `OnPush`; es el default del scaffold de Angular 21 y reduce el bundle sin riesgo |
| Sin Tailwind en `landing-web/styles.css` | Importar Tailwind igual que pos-angular por consistencia | El componente no usa ni una clase Tailwind (todo es CSS propio embebido); importar el framework completo solo agregaría peso sin beneficio |
| Copiar `AppConfigService`/`SupabaseClientService`/`sentry.ts` en vez de compartir vía lib Angular | Extraer una librería Angular compartida | Son ~25-40 líneas cada uno; una lib es over-engineering para 2 apps. Regla de tres: si aparece una tercera app, ahí sí se justifica |
| Netlify: segundo sitio + proxy `/catalogo` desde el sitio principal | Un solo sitio Netlify con build combinado (copiar dist de landing-web dentro de pos-angular) | El build combinado acopla los pipelines de deploy, justo lo que se quería evitar. El proxy mantiene "mismo dominio" sin acoplar releases |
| Remover `references` auto-agregado en `tsconfig.json` raíz | Agregar `composite: true` a `landing-web/tsconfig.app.json` | `pos-angular` nunca usó project references y se type-checkea vía `ng build --configuration development`; agregar composite hubiera sido una excepción sin precedente para "arreglar" algo que no se necesitaba |

---

## 4. ADRs creados o actualizados

- `docs/adr/0012-separar-landing-en-app-independiente.md` — nuevo. Documenta la decisión completa (arquitectura de la app, hosting, alternativas consideradas).

---

## 5. Tests

- [x] `pnpm typecheck` (pos-angular) — pasó tras remover el `references` inválido del tsconfig raíz
- [x] `pnpm typecheck:landing` (`ng build landing-web --configuration development`) — pasó
- [x] `pnpm lint` (pos-angular) — falla por issues preexistentes fuera de este cambio (`auditoria.page.ts`, `product-form.dialog.ts`, `productos.page.ts`, `products.repository.ts`, `reportes.page.ts`) — no relacionados con esta sesión
- [x] `pnpm lint:landing` — "All files pass linting"
- [x] `pnpm build` (pos-angular, producción) — pasó; confirma que el chunk `catalogo-page` ya no existe en el build
- [x] `pnpm build:landing` (producción) — pasó limpio tras calibrar budgets (399.35 kB raw / 98.78 kB transfer estimado, sin warnings)
- [x] `pnpm test` — 52 archivos, 446 tests pasaron (antes y después de remover el catálogo de pos-angular)

Detalle de fallos (si los hay):
- Se validó `landing-web` con `ng serve landing-web --port 4300` en Chrome headless (desktop 1440px): todas las secciones renderizan igual que antes (Hero, Catálogo con 74 productos reales de Supabase, Batidos, Café/Snacks/Combos, Confianza, Ubicación con mapa embebido, Footer), sin errores de consola, título de pestaña "Move On Nutrition — Catálogo" correcto.
- No se pudo validar visualmente el viewport mobile en esta sesión (la herramienta de resize de ventana del navegador no reflejó el cambio de tamaño en las capturas, mismo problema reportado en la sesión anterior) — el CSS de `catalogo.page.ts` no se modificó (solo se movió el archivo), así que la validación mobile previa (sesión `2026-07-10-catalogo-ubicacion.md`) sigue siendo válida.

---

## 6. Bloqueos y preguntas pendientes (resueltos en esta misma sesión)

- **Deploy inicial sirvió el build equivocado.** El primer sitio Netlify creado (`moveon-catalogo-web`) leyó el `netlify.toml` de la raíz (POS) en vez de la config de la landing — el título de la página mostraba "MOVEONAPP POS". Causa: el campo "Package directory" (qué `netlify.toml` usa un sitio en un monorepo) **solo es configurable desde el dashboard de Netlify**, no vía API. Se probaron `build_settings.config_path`, `build_settings.configuration_file_path` y `repo.config_path` por API — todos se guardaban sin error pero sin efecto real en el build.
- **Fix:** usuario configuró "Package directory" = `apps/landing-web` en el dashboard. Con eso, Netlify empezó a leer `apps/landing-web/netlify.toml` — pero ese archivo falló con `"build.publish" ... must be inside the repository root directory"` porque usaba `../../dist/landing-web/browser` (Netlify no permite que `publish` escape del árbol del "package directory" con `..`, aunque la ruta resuelta matemáticamente cayera dentro del repo). Se resolvió cambiando el `outputPath` de `landing-web` en `angular.json` de `dist/landing-web` a `apps/landing-web/dist`, para que el build viva dentro de esa carpeta y `publish` no necesite subir niveles.
- Se eliminó `netlify.landing.toml` de la raíz (nunca se leyó) y se creó `apps/landing-web/netlify.toml` en su lugar.

---

## 7. Próximos pasos

1. Confirmar en el dashboard de Netlify que el redeploy final de `moveon-catalogo-web` (tras el fix de `outputPath`) terminó en estado `ready` y sirve el título correcto.
2. Validar en producción: `https://moveon-client.netlify.app/catalogo` sirve el build de `landing-web`, en desktop y mobile.
3. Validar lecturas anon a Supabase desde el nuevo origen (Network tab, sin errores CORS) en producción real (ya validado en local/dev).
4. Considerar, a futuro, un subdominio propio para la landing en vez de servirla por proxy bajo `/catalogo`.

---

## 8. Notas adicionales

- El usuario pidió explícitamente "planear" antes de implementar — se usó `EnterPlanMode`/`ExitPlanMode` con investigación previa (incluyendo un agente Explore) antes de tocar código.
- El usuario corrigió el nombre propuesto (`catalogo-web` → `landing-web`) al aprobar el plan; se aplicó el rename completo (proyecto, scripts, archivos Netlify, ADR) antes de implementar.
- Esta sesión no incluyó commit de los cambios — se dejó pendiente de que el usuario lo solicite explícitamente, siguiendo la política del repo de no commitear sin pedido explícito.
