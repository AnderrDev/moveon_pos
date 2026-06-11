# ADR 0009 — Hosting frontend en Netlify

**Fecha:** 2026-06-11
**Estado:** Aceptado
**Decisores:** Dueño del negocio + equipo MOVEONAPP

## Contexto

El cleanup de Next/Vercel dejó el frontend como una app Angular standalone estática. Supabase sigue siendo el backend del MVP: Auth, PostgreSQL, RLS, RPC y Edge Functions cuando aplique.

La arquitectura registra que el hosting frontend quedó pendiente. La app se puede publicar como archivos estáticos generados por `pnpm build` en `dist/pos-angular/browser`.

## Decisión

Usar **Netlify** para hospedar el frontend estático de Angular y mantener **Supabase** como backend.

Configuración prevista:

- Build command: `pnpm build`.
- Publish directory: `dist/pos-angular/browser`.
- Runtime/build env vars públicas:
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `APP_NAME`
  - `APP_ENV=production`
  - `SENTRY_DSN` si se activa Sentry.
- Variables que NO deben configurarse en Netlify para el bundle del navegador:
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `SUPABASE_DB_URL`
- Redirect SPA:
  - `/*` → `/index.html` con status `200`.
- Configuración versionada:
  - `netlify.toml`.

## Plan de Implementación

1. Crear `netlify.toml` en la raíz con build, publish directory y redirect SPA.
2. Configurar variables de entorno en Netlify para Production y Deploy Previews.
3. Conectar el repo a Netlify y limitar producción a la rama `main`.
4. Agregar en Supabase Auth las Redirect URLs de Netlify:
   - `https://<site>.netlify.app/restablecer-contrasena`
   - dominio custom futuro cuando exista.
5. Ejecutar pipeline local antes del primer deploy:
   - `pnpm typecheck`
   - `pnpm lint`
   - `pnpm test`
   - `pnpm build`
6. Validar primer deploy:
   - Login.
   - POS con caja abierta.
   - Recuperación de contraseña.
   - Refresh directo en rutas internas (`/pos`, `/inventario`, `/restablecer-contrasena`).
   - Conexión a Supabase usando anon key y RLS.

Estado 2026-06-11:

- `netlify.toml` creado.
- Guia operativa creada en `docs/deploy/netlify.md`.
- Queda pendiente configurar Netlify y Supabase Auth en los dashboards externos.

## Consecuencias

### Positivas

- Deploy simple para Angular estático.
- Deploy previews por PR sin reintroducir Next/Vercel.
- Mantiene separación limpia: frontend en Netlify, backend en Supabase.

### Riesgos y mitigaciones

- **Rutas Angular 404 al refrescar:** mitigar con redirect `/* /index.html 200`.
- **Variables faltantes en build:** Netlify no lee `.env.local`; configurar env vars en Netlify.
- **Reset password no vuelve a la app:** agregar Redirect URLs en Supabase Auth para cada dominio.
- **Service role expuesta por error:** no cargar secretos privados en Netlify; solo anon/public config.

## Alternativas Consideradas

| Alternativa | Razón para no elegirla ahora |
|---|---|
| Firebase Hosting | Funciona para estáticos, pero no aporta integración relevante porque el backend ya es Supabase. |
| Cloudflare Pages | Buena opción, pero Netlify tiene setup Angular/SPA muy directo y deploy previews simples. |
| GitHub Pages | Más limitado para variables, dominios y flujos de preview. |
| Supabase Storage + CDN | Menos conveniente para CI/CD frontend y previews. |
| Vercel | Se retiró con Next/React; reintroducirlo no aporta ventaja clara para Angular estático. |

## Referencias

- Netlify Angular framework guide: https://docs.netlify.com/build/frameworks/framework-setup-guides/angular/
- Netlify redirects: https://docs.netlify.com/manage/routing/redirects/overview/
- Netlify build environment variables: https://docs.netlify.com/build/configure-builds/environment-variables/
