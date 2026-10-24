# Módulo: Catálogo público (landing de clientes)

> Ver ADR 0012 para el contexto completo de por qué esta app quedó separada del POS.

## Qué es

La landing pública que se muestra a clientes finales (no staff): catálogo de productos, batidos preparados, café + snacks proteicos + combos, ubicación de la tienda y contacto. Es la vitrina de Move On Nutrition, no una herramienta operativa.

## Dónde vive

- **App:** `apps/landing-web` (proyecto Angular independiente, mismo workspace pnpm que `pos-angular`, no comparte bundle ni deploy).
- **Página raíz:** `apps/landing-web/src/app/features/catalog/catalogo.page.ts` (se bootstrapea directo como componente raíz en `main.ts`, sin Router). Template y estilos viven aparte en `catalogo.page.html` / `catalogo.page.css` — siguen siendo estilos de componente con encapsulación emulada, igual que cuando estaban embebidos.
- **Servicio de datos:** `apps/landing-web/src/app/features/catalog/catalogo.service.ts`.
- **Contenido estático del menú:** `apps/landing-web/src/app/features/catalog/catalog-content.ts` — batidos, café, snacks, combos, horarios y contacto por defecto. **Aquí se cambian los precios del menú**, no en el componente.
- **Lógica de catálogo:** `apps/landing-web/src/app/features/catalog/catalog-filters.ts` — funciones puras de búsqueda, filtrado, ofertas y paginación, con tests en `catalog-filters.test.ts`.
- **Enlaces de WhatsApp:** `apps/landing-web/src/app/shared/whatsapp.ts` — único lugar donde se arma la URL `wa.me` y se redactan los mensajes.
- **Core duplicado (no compartido con pos-angular):** `apps/landing-web/src/app/core/{config,supabase,observability}` — copias deliberadamente pequeñas (~25-40 líneas c/u), ver ADR 0012.
- **URL pública:** `/catalogo` (se sirve a través de un proxy desde el sitio Netlify del POS — ver sección Hosting).

## Fuentes de datos (Supabase, solo lectura anon)

- `storefront_productos_publicos`: catálogo de suplementos, filtrado en base de datos por `productos.is_active = true`, `deleted_at is null`, `tipo != 'ingredient'` y categorías activas. Esta vista **no expone `precio_venta`, `costo`, SKU ni códigos internos**; la landing no debe consultar `productos` directamente para evitar que esos campos aparezcan en Network o puedan pedirse con la anon key.
- `storefront_contact_settings`: WhatsApp e Instagram públicos, editable sin recompilar (RLS: `anon` lee solo filas `is_active`; solo `admin` inserta/actualiza). Fallback local en `catalog-content.ts` si la tabla no responde.
  > ⚠️ **2026-08-12: esta tabla NO existe en el proyecto Supabase de producción** — su migración (`20260710000100`) nunca se aplicó al remoto. La landing en producción funciona con el fallback hardcodeado. Ver la sección "Migraciones pendientes en producción".
- Menús de Batidos, Café, Snacks Proteicos y Combos están **hardcodeados** en `catalog-content.ts` (no vienen de la tabla `productos`) — son secciones de diseño fijo, no inventario dinámico. Sus precios siguen siendo públicos porque pertenecen al menú fijo, no a la sección 1 de suplementos.

## Migraciones pendientes en producción (detectado 2026-08-12)

`supabase migration list --linked` y sondeos REST contra el proyecto remoto confirman que estas migraciones existen en `supabase/migrations/` pero **nunca se aplicaron al remoto**:

| Migración | Objeto | Efecto hoy en producción |
|---|---|---|
| `20260710000100` | tabla `storefront_contact_settings` | La landing recibe `PGRST205` y cae al contacto por defecto. Editar el contacto desde el POS no tiene efecto en la vitrina. |
| `20260723020000` | RPC `storefront_club_progress` | La landing recibe `PGRST202`: **la sección "Mi Club" muestra el error genérico a todos los visitantes** (ADR 0016 / PLAN-70 no está vivo en producción). |

Otras migraciones locales sin aplicar (`20260624000100/200`, `20260710000200`, `20260723010000`) quedan fuera del alcance de la landing pero deben revisarse con el mismo criterio. Nota: `20260716000100/200` figuran como no aplicadas pero sus objetos sí existen en el remoto — se aplicaron fuera de banda y quedaron registradas con otros timestamps (`20260717224803/819`), que es el origen del historial desalineado.

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
- No volver a exponer `productos.precio_venta` en el catálogo público. Si la sección de suplementos necesita más campos, agregarlos explícitamente a `storefront_productos_publicos` solo si son seguros para clientes anónimos.
- Desde 2026-08-29 la vista corre con `security_invoker = true` (fix del hallazgo Critical "Security Definer View" del Security Advisor; ver `docs/sessions/2026-08-29-bug-blank-screen-refresh-token.md`). Esto significa que **agregar una columna a la vista ya no basta por sí solo**: también hay que otorgarle a `anon` `GRANT SELECT (columna) ON public.productos` (y si la nueva columna se usa en el `WHERE`/`JOIN` de la vista, ese grant es obligatorio aunque la columna no se devuelva, o la vista falla con `permission denied for table productos`). La política RLS `"catalogo: anon puede leer productos publicos"` en `productos` también debe mantenerse en sync con el filtro de la vista.
