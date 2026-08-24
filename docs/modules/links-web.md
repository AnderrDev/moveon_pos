# Módulo: Enlaces públicos

## Qué es

Micrositio móvil tipo Linktree de Move On Nutrition. Concentra los accesos oficiales a WhatsApp, catálogo web, Instagram y Google Maps para usarse desde la biografía de redes sociales o un código QR.

## Dónde vive

- **App:** `apps/links-web`, proyecto Angular standalone independiente.
- **Página raíz:** `apps/links-web/src/app/links.page.ts`.
- **Contenido editable:** `apps/links-web/src/app/links-content.ts`.
- **Assets de marca:** durante el build reutiliza `apps/landing-web/public/assets/catalog/`; no duplica archivos binarios.
- **Datos:** completamente estáticos. No carga Supabase, runtime config, Router ni Tailwind.

## Sistema visual

Hereda el lenguaje de la landing: fondo negro, amarillo `#F9D128`, Montserrat, bordes rectos, mayúsculas y composición editorial industrial. Los accesos tienen un target táctil mínimo de 84 px, foco visible y animaciones desactivadas con `prefers-reduced-motion`.

## Comandos

```bash
pnpm dev:links
pnpm build:links
pnpm build:links:docker
pnpm lint:links
pnpm typecheck:links
```

La imagen Docker usa `build:links:docker` para generar el `baseHref` `/links/` y servir la app en esa ruta. El build Netlify conserva `baseHref` `/` porque vive en un tercer sitio independiente; la creación y el dominio del sitio se hacen fuera del repositorio.

## Cómo agregar otra red

Agregar una entrada a `SOCIAL_LINKS` en `links-content.ts`, ampliar el tipo `LinkIcon` y añadir el SVG correspondiente al `@switch` de `links.page.html`. Solo deben publicarse URLs oficiales confirmadas.
