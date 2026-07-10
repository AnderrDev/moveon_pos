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
pnpm build:landing       # ng build landing-web (producción) -> dist/landing-web/browser
pnpm lint:landing        # ng lint landing-web
pnpm typecheck:landing   # ng build landing-web --configuration development
```

`pnpm predev`/`prebuild`/`pretypecheck` de `pos-angular` y sus equivalentes `:landing` corren `scripts/generate-runtime-config.mjs`, que escribe `runtime-config.json` para **ambas** apps a partir del mismo `.env.local` (mismo proyecto Supabase, misma anon key).

## Hosting (Netlify)

Dos sitios Netlify sobre el mismo repo:

| Sitio | Config file | Build | Publish |
|---|---|---|---|
| POS (`pos-angular`) | `netlify.toml` | `pnpm build` | `dist/pos-angular/browser` |
| Landing (`landing-web`) | `netlify.landing.toml` | `pnpm build:landing` | `dist/landing-web/browser` |

El sitio del POS tiene reglas de redirect/proxy que reenvían `/catalogo` y `/catalogo/*` hacia el sitio de la landing, para que el cliente vea todo bajo el mismo dominio. Ver ADR 0012 para el detalle y el estado pendiente de conectar el segundo sitio en el dashboard de Netlify.

## Qué NO hacer

- No agregar rutas, guards ni imports de `pos-angular` a `landing-web` — el objetivo del split es que este bundle no tenga nada del POS.
- No agregar `@import 'tailwindcss'` a `landing-web/src/styles.css` — el componente no usa clases de utilidad, es una excepción deliberada (ver ADR 0012).
- No mover los menús de Batidos/Café/Snacks/Combos a la tabla `productos` sin discutirlo antes — hoy son secciones de diseño fijo a propósito.
