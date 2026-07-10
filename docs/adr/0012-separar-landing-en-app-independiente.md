# ADR 0012 — Separar la landing pública (`/catalogo`) en una app Angular independiente

**Fecha:** 2026-07-10
**Estado:** Aceptado
**Decisores:** Dueño del negocio + equipo MOVEONAPP

## Contexto

`/catalogo` vivía como una ruta pública dentro de `apps/pos-angular` (`app.routes.ts`, sin `authGuard`), pensada como landing/menú para mostrar a clientes: catálogo de productos, batidos, café, snacks proteicos y combos. Conceptualmente es otro producto — audiencia distinta (clientes finales, no staff), ritmo de cambio distinto (precios de menú vs. lógica de ventas/caja) — y el objetivo es mostrarla a clientes de forma independiente del software operativo de la tienda.

Nota honesta sobre el motivo: `catalogo-page` ya era un chunk lazy-loaded (`loadComponent`) antes de este cambio, así que el ahorro de bytes para el staff que usa el POS ya existía. El valor real de esta separación es:
- Cero código/rutas/guards del POS en el origen que ve el cliente.
- Deploys independientes: cambiar un precio del menú no reconstruye ni redeploya el POS, y un release del POS no arriesga tumbar la landing.
- Libertad futura: la landing puede evolucionar su propio stack/CSS (o dominio propio) sin arrastrar al POS.

## Decisión

Crear un segundo proyecto Angular dentro del **mismo workspace pnpm**, `apps/landing-web`, en vez de un repositorio separado. Se reutiliza el código ya verificado (`catalogo.page.ts`/`catalogo.service.ts`, ~900 líneas de template, filtros, paginación, diseño de marca v4) en vez de reescribirlo en otro stack.

La URL pública sigue siendo `/catalogo` — solo cambia el nombre del proyecto/app por dentro. El nombre `landing-web` (no `catalogo-web`) refleja que es la vitrina completa para clientes, no solo el listado de productos.

### Arquitectura de la nueva app

- **Sin Router de Angular:** el catálogo navega por anclas (`href="#seccion"`), no por rutas Angular. `main.ts` bootstrapea `CatalogoPage` directamente, sin `AppComponent`/`router-outlet` intermedio.
- **Zoneless:** `landing-web` usa `provideBrowserGlobalErrorListeners()` (default del scaffold de Angular 21) en vez de `provideZoneChangeDetection` + polyfill `zone.js`. El componente ya usaba `ChangeDetectionStrategy.OnPush` y signals para todo su estado, así que es 100% compatible sin zona — bundle más liviano.
- **Sin Tailwind:** `catalogo.page.ts` no usa ninguna clase Tailwind (todo su CSS vive en un `<style>` propio embebido, sistema `mo3-*`). `landing-web/src/styles.css` lleva un reset mínimo, no `@import 'tailwindcss'`, para no inflar el bundle con un framework que no se usa. Esto es una excepción deliberada al stack por defecto del proyecto (Tailwind v4), documentada aquí.
- **Servicios core duplicados, no compartidos:** `AppConfigService`, `SupabaseClientService` y el wrapper de Sentry se copiaron (no se extrajeron a una lib Angular) porque son ~25-40 líneas cada uno. Si en el futuro aparece una tercera app, ahí sí vale la pena extraer una lib compartida (regla de tres).
- **`scripts/generate-runtime-config.mjs`** ahora escribe `runtime-config.json` para ambas apps (`pos-angular` y `landing-web`) a partir del mismo `.env.local` — mismo proyecto Supabase, misma anon key.

### Hosting: Netlify, un sitio → dos sitios + proxy

Ya vigente desde ADR 0009 (Netlify, no Vercel). Se agrega:

- Un **segundo sitio Netlify** (`moveon-catalogo-web`, https://moveon-catalogo-web.netlify.app) apuntando al mismo repo (`AnderrDev/moveon_pos`, rama `main`).
- En el sitio principal (`netlify.toml`, POS), se agregan reglas de redirect/proxy **antes** del catch-all SPA existente:
  ```toml
  [[redirects]]
    from = "/catalogo"
    to = "https://moveon-catalogo-web.netlify.app/:splat"
    status = 200
    force = true
  [[redirects]]
    from = "/catalogo/*"
    to = "https://moveon-catalogo-web.netlify.app/:splat"
    status = 200
    force = true
  ```
  El orden importa: Netlify evalúa redirects en orden y usa el primer match.
- Por ahora la landing sigue en el **mismo dominio** que el POS (vía este proxy) — no se provisiona un subdominio custom todavía. Es la topología más simple que logra "cero código POS en el bundle del cliente" sin tocar DNS.

**Cómo hacer que el segundo sitio lea un `netlify.toml` distinto (lección aprendida):**

Un mismo repo con dos sitios Netlify, cada uno con su propio `netlify.toml`, requiere el campo **"Package directory"** en *Build & deploy → Continuous deployment → Build settings* del sitio. Esto **solo se puede configurar desde el dashboard** — no existe un campo equivalente en la API clásica (`PATCH /api/v1/sites/:id`); se probó `build_settings.config_path`, `build_settings.configuration_file_path` y el objeto `repo.config_path` sin éxito (se guardaban sin error pero no tenían efecto en el build real). Mientras ese campo quede sin configurar, el sitio lee el `netlify.toml` de la **raíz del repo** sin importar qué `cmd`/`dir` se haya seteado por API o dashboard.

Configuración final que funcionó:
- **Package directory** del sitio `moveon-catalogo-web`: `apps/landing-web` (dashboard, manual).
- `apps/landing-web/netlify.toml` propio (no uno en la raíz) con `publish = "dist/browser"`.
- **outputPath de `landing-web` en `angular.json` cambiado de `dist/landing-web` a `apps/landing-web/dist`** — necesario porque Netlify valida que `publish` no pueda usar `../` para salir del árbol del "package directory" (aunque la ruta resuelta matemáticamente cayera dentro del repo, el build falló con `Configuration property "build.publish" ... must be inside the repository root directory`). Manteniendo la salida del build dentro de `apps/landing-web/`, `publish` no necesita subir ningún nivel.
- `_redirects`/`_headers` en `apps/landing-web/public/` (se mantienen como refuerzo, no dependen de qué `netlify.toml` se lea).

## Plan de Implementación

1. `ng generate application landing-web --prefix=mo --style=css --skip-tests --routing=false`.
2. Mover `features/catalog/{catalogo.page.ts,catalogo.service.ts}` y copiar `core/{config,supabase,observability}` manteniendo el mismo layout relativo (cero cambios de imports).
3. `main.ts`/`app.config.ts` minimalistas (sin Router, sin zone.js).
4. Copiar assets de `public/assets/catalog/*`; actualizar `generate-runtime-config.mjs` para escribir ambos `runtime-config.json`.
5. Scripts nuevos en `package.json`: `dev:landing`, `build:landing`, `lint:landing`, `typecheck:landing` (+ hooks `pre*`).
6. `netlify.landing.toml` nuevo; `netlify.toml` con los redirects de proxy hacia `/catalogo`.
7. Crear el segundo sitio Netlify en el dashboard (paso manual, fuera del repo) y reemplazar `<landing-site>` en `netlify.toml` por el subdominio real asignado.
8. Remover `apps/pos-angular/src/app/features/catalog/`, la ruta `catalogo` en `app.routes.ts` y `apps/pos-angular/public/assets/catalog/*` una vez validada la app nueva.

Estado 2026-07-10:
- Pasos 1-6 completados. `pnpm build:landing` y `pnpm lint:landing` pasan limpios; verificado visualmente con `ng serve landing-web` (desktop, datos reales de Supabase, sin errores de consola).
- Paso 7 pendiente — requiere acceso al dashboard de Netlify (fuera del repo).
- Paso 8: catálogo removido de `pos-angular` en esta misma sesión, con typecheck/tests/build re-verificados.

## Consecuencias

### Positivas
- El bundle que descarga un cliente en `/catalogo` no contiene ninguna ruta, guard ni lógica del POS.
- Un cambio de precio en el menú (`landing-web`) no requiere rebuild/redeploy del POS, y viceversa.
- Bundle de `landing-web` más liviano al no cargar zone.js ni Tailwind (~99kB de transferencia inicial estimada en el build de producción).

### Riesgos y mitigaciones
- **Dos sitios Netlify que mantener:** más superficie operativa que un solo sitio. Mitigación: ambos usan el mismo repo y el mismo `.env.local`/variables públicas, solo cambia el archivo de configuración de build.
- **Redirect mal ordenado en `netlify.toml`:** si el catch-all `/* -> /index.html` quedara antes que el proxy de `/catalogo`, el proxy nunca se activaría. Mitigación: el proxy queda explícitamente arriba, y este ADR lo documenta.
- **Origen distinto para las lecturas anon a Supabase:** `landing-web` corre en un origen/subdominio distinto al de `pos-angular`. Mitigación: las políticas RLS de Supabase no dependen del origen/CORS del navegador, solo del rol/JWT; se verificó en desarrollo que las lecturas anon (productos, categorías, `storefront_contact_settings`) funcionan sin cambios.
- **Excepción a Tailwind v4 como stack por defecto:** documentada explícitamente aquí para que no se interprete como una desviación accidental.

## Alternativas Consideradas

| Alternativa | Razón para no elegirla |
|---|---|
| Repositorio Git completamente separado | Aislamiento total, pero implica reescribir/duplicar `catalogo.page.ts` (846+ líneas ya verificadas), tipos de Supabase y tokens de marca, y mantener dos repos sincronizados. El costo no se justifica todavía. |
| Mantener `/catalogo` dentro de `pos-angular` (solo optimizar el lazy-loading actual) | No logra el objetivo real: seguiría existiendo un solo deploy/release para ambos productos, y el origen del cliente seguiría compartiendo `app.routes.ts`, guards y el resto del código del POS aunque no se descargue. |
| Subdominio propio desde ya (ej. `catalogo.moveonapp.com`) | Requiere gestión de DNS que el negocio no tiene lista todavía; se deja como paso futuro una vez exista el dominio propio. El proxy resuelve "mismo dominio" sin bloquear esa migración después. |

## Referencias

- ADR 0009 — Hosting frontend en Netlify.
- ADR 0006 — Migración de Next a Angular.
- Netlify redirects (proxy con `force = true`): https://docs.netlify.com/manage/routing/redirects/overview/
- `docs/modules/catalogo.md`.
