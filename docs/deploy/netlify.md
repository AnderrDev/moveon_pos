# Deploy frontend en Netlify

## Objetivo

Hospedar el frontend Angular estatico en Netlify y mantener Supabase como backend.

## Configuracion del sitio

Crear/importar el sitio en Netlify desde el repositorio Git.

| Campo | Valor |
|---|---|
| Branch de produccion | `main` |
| Build command | `pnpm build` |
| Publish directory | `dist/pos-angular/browser` |
| Node | `20.19.0` |
| pnpm | `9.0.0` |

La configuracion vive en `netlify.toml`.

## Variables de entorno

Configurar estas variables en Netlify para Production y Deploy Previews:

| Variable | Tipo | Nota |
|---|---|---|
| `SUPABASE_URL` | Publica | URL del proyecto Supabase. |
| `SUPABASE_ANON_KEY` | Publica | Anon key, segura para cliente con RLS. |
| `APP_NAME` | Publica | `MOVEONAPP POS`. |
| `APP_ENV` | Publica | `production` en produccion. |
| `SENTRY_DSN` | Publica | Opcional, solo si Sentry esta activo. |

No configurar en Netlify:

- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_DB_URL`

Esas variables son privadas y solo deben usarse en scripts locales, Supabase Edge Functions o tareas operativas controladas.

## Supabase Auth

Agregar a Supabase Auth Redirect URLs:

- `https://<site>.netlify.app/restablecer-contrasena`
- `https://<custom-domain>/restablecer-contrasena` cuando exista dominio propio.

Mantener tambien los origenes locales necesarios:

- `http://localhost:4200/restablecer-contrasena`

## Validacion antes del primer deploy

Ejecutar localmente:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

## Validacion del primer deploy

1. Abrir la URL de Netlify.
2. Confirmar login con usuario admin/cajero.
3. Refrescar rutas internas: `/pos`, `/inventario`, `/reportes`.
4. Confirmar que el reset de contrasena vuelve a `/restablecer-contrasena`.
5. Confirmar que POS lee productos y stock desde Supabase.
6. Confirmar que no hay `SUPABASE_SERVICE_ROLE_KEY` ni `SUPABASE_DB_URL` en el bundle.

