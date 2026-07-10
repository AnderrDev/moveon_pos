# Módulo: Catálogo público (landing de clientes)

> Ver ADR 0012 para el contexto completo de por qué esta app quedó separada del POS.

## Qué es

La landing pública que se muestra a clientes finales (no staff): catálogo de productos, batidos preparados, café + snacks proteicos + combos, ubicación de la tienda y contacto. Es la vitrina de Move On Nutrition, no una herramienta operativa.

## Dónde vive

- **App:** `apps/landing-web` (proyecto Angular independiente, mismo workspace pnpm que `pos-angular`, no comparte bundle ni deploy).
- **Página raíz:** `apps/landing-web/src/app/features/catalog/catalogo.page.ts` (se bootstrapea directo como componente raíz en `main.ts`, sin Router).
- **Servicio de datos:** `apps/landing-web/src/app/features/catalog/catalogo.service.ts`.
- **Core duplicado (no compartido con pos-angular):** `apps/landing-web/src/app/core/{config,supabase,observability}` — copias deliberadamente pequeñas (~25-40 líneas c/u), ver ADR 0012.
- **URL pública:** `/catalogo` (se sirve a través de un proxy desde el sitio Netlify del POS — ver sección Hosting).

## Fuentes de datos (Supabase, solo lectura anon)

- `productos` + `categorias`: catálogo de suplementos, filtrado por `is_active = true`, `deleted_at is null`, `tipo != 'ingredient'`. La categoría `Ingredientes para batidos` se oculta explícitamente en el frontend (`HIDDEN_CATEGORIES`).
- `storefront_contact_settings`: WhatsApp e Instagram públicos, editable sin recompilar (RLS: `anon` lee solo filas `is_active`; solo `admin` inserta/actualiza). Fallback local en el componente si la tabla no responde.
- Menús de Batidos, Café, Snacks Proteicos y Combos están **hardcodeados** en `catalogo.page.ts` (no vienen de la tabla `productos`) — son secciones de diseño fijo, no inventario dinámico.

## Comandos

```bash
pnpm dev:landing         # ng serve landing-web (puerto por defecto de Angular CLI)
pnpm build:landing       # ng build landing-web (producción) -> apps/landing-web/dist/browser
pnpm lint:landing        # ng lint landing-web
pnpm typecheck:landing   # ng build landing-web --configuration development
```

`pnpm predev`/`prebuild`/`pretypecheck` de `pos-angular` y sus equivalentes `:landing` corren `scripts/generate-runtime-config.mjs`, que escribe `runtime-config.json` para **ambas** apps a partir del mismo `.env.local` (mismo proyecto Supabase, misma anon key).

Nota: el `outputPath` de `landing-web` en `angular.json` es `apps/landing-web/dist` (no `dist/landing-web` como pos-angular) — el artefacto de la landing vive junto a su app. Ojo con Netlify: `publish` en `apps/landing-web/netlify.toml` se resuelve **relativo a la raíz del repo**, no a esa carpeta, por eso es la ruta completa `apps/landing-web/dist/browser`. Ver ADR 0012.

## Hosting (Netlify)

Dos sitios Netlify sobre el mismo repo (`AnderrDev/moveon_pos`, rama `main`):

| Sitio | netlify.toml | Build | Publish | Package directory (dashboard) |
|---|---|---|---|---|
| POS (`pos-angular`) — `moveon-client` | `/netlify.toml` (raíz) | `pnpm build` | `dist/pos-angular/browser` | (sin usar) |
| Landing (`landing-web`) — `moveon-catalogo-web` | `apps/landing-web/netlify.toml` | `pnpm build:landing` | `apps/landing-web/dist/browser` (relativo a la raíz) | `apps/landing-web` |

El campo "Package directory" (qué `netlify.toml` lee cada sitio en un monorepo) **solo se configura desde el dashboard de Netlify**, no hay campo equivalente en la API. Sin eso seteado, cualquier sitio nuevo cae por defecto al `netlify.toml` de la raíz del repo (le pasó al primer intento de este sitio — sirvió el build del POS hasta corregirlo). El sitio del POS tiene reglas de redirect/proxy que reenvían `/catalogo` y `/catalogo/*` hacia `moveon-catalogo-web.netlify.app`, para que el cliente vea todo bajo el mismo dominio. Ver ADR 0012 para el detalle completo.

## Qué NO hacer

- No agregar rutas, guards ni imports de `pos-angular` a `landing-web` — el objetivo del split es que este bundle no tenga nada del POS.
- No agregar `@import 'tailwindcss'` a `landing-web/src/styles.css` — el componente no usa clases de utilidad, es una excepción deliberada (ver ADR 0012).
- No mover los menús de Batidos/Café/Snacks/Combos a la tabla `productos` sin discutirlo antes — hoy son secciones de diseño fijo a propósito.
