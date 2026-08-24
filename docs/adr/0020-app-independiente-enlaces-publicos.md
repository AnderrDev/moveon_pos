# ADR 0020 — App independiente para enlaces públicos

**Fecha:** 2026-08-20  
**Estado:** Aceptado  
**Decisor:** Dueño del producto

## Contexto

Move On necesita una página breve para la biografía de redes sociales y códigos QR. Su audiencia y objetivo son distintos del POS y del catálogo: debe abrir rápido en móvil y dirigir a canales externos sin cargar inventario, Supabase ni navegación interna.

## Decisión

Crear `apps/links-web` como tercera aplicación Angular standalone del workspace.

- Bootstrap directo de `LinksPage`, sin Angular Router.
- Contenido estático centralizado en `links-content.ts`.
- Sin Supabase, runtime config, Tailwind ni dependencias nuevas.
- Reutilización de los assets oficiales de `landing-web` mediante la configuración de assets de Angular.
- Identidad visual alineada con el catálogo, pero con layout propio de link hub.
- Build y despliegue independientes mediante `build:links` y `apps/links-web/netlify.toml`.
- La imagen Docker usa un build con `baseHref` `/links/` y la sirve bajo esa ruta; Netlify usa el build raíz normal.

## Consecuencias

La página no incrementa los bundles del POS ni del catálogo y puede desplegarse o cambiarse de forma independiente. Se agrega un tercer artefacto de build, pero no se extrae una librería compartida: esta app no duplica servicios core y solo consume assets de marca estáticos.

La URL pública definitiva en Netlify y cualquier proxy desde el dominio principal quedan como configuración operativa posterior, una vez creado el tercer sitio.
