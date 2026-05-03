# Spec de Sesión — 2026-04-28 — Deploy Vercel

---

## Metadatos

| Campo | Valor |
|---|---|
| Fecha | 2026-04-28 |
| Sprint | Preparación producción |
| Agente | Codex |
| HUs trabajadas | N/A — guía operativa |
| Estado | Actualizada |

---

## 1. Objetivo de la sesión

Definir el procedimiento para desplegar MOVEONAPP POS en Vercel con variables de Supabase, migraciones y validación previa.

---

## 2. Lo que se implementó

### 2.1 Archivos creados
- `docs/sessions/2026-04-28-deploy-vercel.md` — registro de la sesión.
- `vercel.json` — configuración explícita para Vercel con Next.js, pnpm y build command.
- `.vercelignore` — exclusiones de archivos locales/secrets/cache para el deploy.
- `pnpm-lock.yaml` — lockfile requerido para instalaciones reproducibles con pnpm.
- `src/infrastructure/supabase/env.ts` — helper centralizado para validar variables de Supabase y aceptar fallbacks server-side.
- `tests/unit/infrastructure/supabase-env.test.ts` — cobertura del helper de variables.

### 2.2 Archivos modificados
- `next.config.ts` — `typedRoutes` movido a la opción estable de Next 15.
- `package.json` — agregado `engines.node >=20.19.0` para Vercel/desarrollo local.
- `.env.example` — notas de variables mínimas para Vercel.
- `src/infrastructure/supabase/client.ts`, `server.ts`, `service-role.ts` y `src/middleware.ts` — uso del helper central de env.

### 2.3 Archivos eliminados
- (si aplica)

---

## 3. Decisiones tomadas

| Decisión | Alternativa descartada | Razón |
|---|---|---|
| Usar despliegue Git en Vercel como camino principal | CLI manual como único flujo | Git da preview por PR/commit y producción automática desde la rama principal. |
| No subir `SUPABASE_DB_URL` a Vercel salvo necesidad explícita | Copiar todas las variables locales | La URL directa de DB solo se usa para migraciones locales/operativas, no por la app en runtime. |
| Mantener Node como `>=20.19.0` en vez de fijar `22.x` | Forzar Node 22 exacto | Vercel soporta Node moderno y el entorno local actual usa Node 20.19.6; para desarrollo no conviene bloquear por una versión exacta. |
| Aceptar `SUPABASE_URL`/`SUPABASE_ANON_KEY` como fallback server-side | Depender solo de `NEXT_PUBLIC_*` | Algunas integraciones/plugins pueden inyectar variables sin prefijo público; el middleware/server puede usarlas sin afectar seguridad. |

---

## 4. ADRs creados o actualizados

- Ninguno.

---

## 5. Tests

- `corepack pnpm install --frozen-lockfile` — OK.
- `corepack pnpm typecheck` — OK.
- `corepack pnpm lint` — OK, con aviso de deprecación de `next lint`.
- `corepack pnpm test` — OK, 17 archivos / 116 tests.
- `corepack pnpm build` — OK.

---

## 6. Bloqueos y preguntas pendientes

- [ ] Falta conectar el repositorio real a Vercel si aún no está importado.
- [ ] Falta definir dominio final y configurar `NEXT_PUBLIC_APP_URL` de producción.
- [ ] Si aparece `Your project's URL and Key are required to create a Supabase client`, revisar que Vercel tenga `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` configuradas para el ambiente exacto del deploy (Preview o Production).

---

## 7. Próximos pasos

1. Commit y push del árbol actual antes del deploy por Git.
2. Configurar variables de entorno en Vercel para Preview y Production.
3. Ejecutar primer preview y revisar `/login`, `/pos`, `/caja`, `/reportes`.
4. Promover a producción y configurar dominio.

---

## 8. Notas adicionales

Variables requeridas por la app:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` cuando se usen acciones server-side con service role.
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_APP_NAME`
- feature flags `NEXT_PUBLIC_FEATURE_*` si se usan.
