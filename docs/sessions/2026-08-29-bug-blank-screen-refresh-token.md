# Spec de Sesión — 2026-08-29 — Bug: pantalla en blanco, refresh_token nunca concluye

> Copia este archivo como `YYYY-MM-DD-<tema-kebab-case>.md` al inicio de cada sesión de trabajo.
> Llénalo durante y al final de la sesión. Es el registro de lo que pasó.

---

## Metadatos

| Campo | Valor |
|---|---|
| Fecha | 2026-08-29 |
| Sprint | N/A (bugfix) |
| Agente | Claude Code |
| HUs trabajadas | N/A |
| Estado | Completada |

---

## 1. Objetivo de la sesión

El usuario reporta que al abrir el sitio la pantalla se queda en blanco. La request
`GET/POST https://rmaieqyscchtxxkgxgik.supabase.co/auth/v1/token?grant_type=refresh_token`
se queda cargando indefinidamente (no concluye). Investigar causa raíz y corregir.

**Tarea 2 (misma sesión):** el usuario reporta que el proyecto Supabase aparece
"unhealthy" en el Security Advisor por un hallazgo Critical: `public.storefront_productos_publicos`
está definida con `SECURITY DEFINER` (comportamiento por defecto de las vistas
en Postgres cuando no declaran `security_invoker`). Corregirlo sin romper el
catálogo público.

**Tarea 3 (misma sesión):** tras la Tarea 2 el proyecto seguía "unhealthy" en
el dashboard. Se investigó y quedaban 20 hallazgos WARN (ninguno Critical) en
el Security Advisor. Planear y corregir los que sean corregibles sin romper
nada.

---

## 2. Lo que se implementó

### Diagnóstico (causa raíz)

`authGuard` (`apps/pos-angular/src/app/core/auth/auth.guard.ts`) hace
`await sessionService.getSession()` antes de dejar activar cualquier ruta.
`getSession()` llama a `supabase.auth.getSession()`, que internamente dispara
el refresh automático del token (`POST /auth/v1/token?grant_type=refresh_token`)
cuando hay una sesión guardada en `localStorage` cerca de expirar o expirada.

`@supabase/auth-js` (v2.105.1, instalada) **no aplica ningún timeout/abort al
fetch** de ese endpoint. Si la petición de red se cuelga (blip de red, proxy,
DNS lento, tab suspendido), la promesa de `getSession()` nunca resuelve. Como
`authGuard` la espera, el `CanActivateFn` nunca resuelve, Angular Router nunca
activa ninguna ruta y la app queda en blanco para siempre — exactamente lo
reportado por el usuario (pantalla en blanco + request `refresh_token` sin
concluir en el Network tab).

Se descartó que fuera el backend: el proyecto Supabase `rmaieqyscchtxxkgxgik`
(POS) está `ACTIVE_HEALTHY` (`supabase projects list`). También se descartó
un deadlock del Navigator/Process Lock de `@supabase/auth-js`: la versión
instalada ya tiene protección anti-deadlock (steal-after-timeout) para el
lock; el problema es que el `fetch` en sí no tiene timeout una vez que el
lock fue adquirido.

### 2.1 Archivos creados
- `supabase/migrations/20260829000100_storefront_view_security_invoker.sql`
  — ver Tarea 2 abajo.
- `supabase/migrations/20260829000200_storefront_view_grant_filter_columns.sql`
  — fix de seguimiento de la migración anterior (ver Tarea 2).
- `supabase/migrations/20260829000300_product_options_rls_cleanup.sql` — ver
  Tarea 3.

### 2.2 Archivos modificados
- `apps/pos-angular/src/app/core/auth/session.service.ts` — se agregó
  `GET_SESSION_TIMEOUT_MS = 10_000` y `getSessionWithTimeout()`: envuelve
  `supabase.auth.getSession()` en un `Promise.race` contra un timeout de 10s.
  Si el timeout gana, se trata como "sesión inválida" (`null`), la misma rama
  que ya usa `authGuard` para redirigir a `/login`. Esto evita que un
  `refresh_token` colgado bloquee la app para siempre; en el peor caso el
  usuario ve `/login` a los 10s en vez de una pantalla en blanco indefinida.
- `docs/modules/auth.md` — nota sobre el timeout de `getSession()`.

### 2.3 Archivos eliminados
- (ninguno)

### Tarea 2 — Security Definer View en `storefront_productos_publicos`

**Diagnóstico:** RLS en Postgres solo filtra filas, no columnas. Como
`productos` tiene columnas sensibles (`precio_venta`, `costo`, `sku`,
`codigo_barras`), la migración `20260710000200` había optado por revocarle a
`anon` el `SELECT` directo sobre `productos` y exponer el catálogo público
únicamente a través de la vista `storefront_productos_publicos`. Esa vista,
al no declarar `security_invoker`, corre con los permisos de su dueño
(comportamiento *definer* por defecto de las vistas en Postgres) — de ahí el
hallazgo Critical del Security Advisor: en teoría podría saltarse RLS.

De paso se encontró que `anon` conservaba privilegios de tabla
`INSERT`/`UPDATE`/`REFERENCES` sobre `productos` (heredados de los defaults
iniciales del proyecto) que nunca fueron revocados — bloqueados en la
práctica porque no había ninguna política RLS que se los permitiera a `anon`,
pero es una dependencia innecesaria de "solo RLS" que conviene cerrar
(CLAUDE.md §2.4: "No confiar solo en RLS").

**Fix (2 migraciones, aplicadas directamente al proyecto remoto
`rmaieqyscchtxxkgxgik` vía `supabase db query --linked --file ...`, con
autorización explícita del usuario en el chat):**

1. `20260829000100_storefront_view_security_invoker.sql`:
   - Política RLS `"catalogo: anon puede leer productos publicos"` en
     `productos` para `anon`, que replica el filtro exacto de la vista
     (`is_active = true and deleted_at is null and tipo not in ('ingredient','combo')`).
   - `GRANT SELECT` por columna a `anon` sobre las columnas que la vista
     expone (`id, nombre, tipo, para_que_sirve, image_url, marca, etiqueta, categoria_id`).
   - `REVOKE INSERT, UPDATE, REFERENCES` de `anon` sobre `productos`.
   - `CREATE OR REPLACE VIEW ... WITH (security_invoker = true)` con la misma
     definición que ya tenía la vista (sin cambios de columnas ni filtro).
2. `20260829000200_storefront_view_grant_filter_columns.sql` (fix de
   seguimiento, mismo día): la primera migración dejó la vista rota para
   `anon` (`permission denied for table productos`) porque Postgres exige
   privilegio `SELECT` sobre **cualquier columna referenciada en la consulta**,
   no solo las del `SELECT` de salida — y `is_active`/`deleted_at` (usadas en
   el `WHERE` de la vista) no estaban otorgadas. Se agregó
   `GRANT SELECT (is_active, deleted_at) ON productos TO anon`.

**Verificación (antes de dar el fix por terminado):**
- `supabase db advisors --linked`: el hallazgo `security_definer_view` /
  cualquier mención a `storefront` desapareció de los 20 advisors restantes
  (todos preexistentes, no relacionados: funciones `SECURITY DEFINER`
  llamables por `authenticated`, protección de contraseñas filtradas
  deshabilitada, políticas RLS sin `(select auth.<fn>())`, políticas
  duplicadas en `product_options`).
- `curl` real contra `/rest/v1/storefront_productos_publicos` con el
  `anon key` de `apps/landing-web/public/runtime-config.json`: devuelve
  productos correctamente (catálogo público intacto).
- `curl` contra `/rest/v1/productos?select=precio_venta`: `permission denied`
  (sigue bloqueado, como antes).
- `curl POST /rest/v1/productos` (insert directo como anon): `permission
  denied` (antes del fix este privilegio de tabla sobrante existía, aunque
  RLS ya lo bloqueaba).
- `pnpm test`: 710 tests, 0 fallos (nada en el código Angular depende del
  comportamiento anterior de la vista).

**No se pudo probar en Supabase local primero** (Docker Desktop no estaba
corriendo en la sesión) — se compensó verificando exhaustivamente el estado
real en remoto antes y después con consultas de solo lectura, y probando el
fix con requests reales autenticados como `anon` antes de darlo por bueno.

### Tarea 3 — Resto de hallazgos WARN del Security Advisor

Tras la Tarea 2 el advisor mostraba 20 hallazgos, todos WARN (ninguno
Critical/Error) — el "unhealthy" del dashboard probablemente cuenta también
los WARN, no solo Critical. Se agruparon en 3 frentes:

1. **`product_options` (8 WARN) — corregido.** La migración
   `20260802143900_product_options.sql` había creado `po_read` (`for select`)
   y `po_admin_write` (`for all`) sin `to <rol>` (aplicaban a `public`, todos
   los roles) y ambas cubrían `select` para el mismo rol — la condición de
   `po_admin_write` (admin) es subconjunto de la de `po_read` (cualquier
   miembro activo), así que para `select` era pura redundancia
   ("Multiple Permissive Policies" x6, uno por rol). Además usaban
   `auth.uid()` sin envolver en `(select auth.uid())`
   ("Auth RLS Initialization Plan" x2).

   Fix en `supabase/migrations/20260829000300_product_options_rls_cleanup.sql`:
   se dividió `po_admin_write` en `po_admin_insert`/`po_admin_update`/`po_admin_delete`
   (ya no toca `select`, elimina el solape) y las 4 políticas resultantes
   quedaron `to authenticated` + `(select auth.uid())`. Aplicada al remoto
   con `db query --linked --file` (con autorización explícita del usuario),
   verificada con `pg_policies` y con `pnpm test` (710 tests, 0 fallos).
   Advisor bajó de 20 → 12 hallazgos.

2. **"Leaked Password Protection Disabled" (1 WARN) — bloqueado, no es un
   problema de código.** Se intentó activar `password_hibp_enabled` vía
   `PATCH https://api.supabase.com/v1/projects/{ref}/config/auth` — la API
   respondió `402 Payment Required`: *"Configuring leaked password protection
   via HaveIBeenPwned.org is available on Pro Plans and up."* El proyecto
   está en un plan que no incluye esta función. Requiere que el dueño decida
   si hace upgrade de plan; no se puede resolver de otra forma.

3. **11 funciones `SECURITY DEFINER` ejecutables por `authenticated` — no se
   tocaron, decisión deliberada.** Son los RPCs atómicos del POS
   (`create_sale_atomic`, `void_sale_atomic`, `close_cash_session_atomic`,
   `transfer_stock_atomic`, etc.). Se leyó `create_sale_atomic` completo: ya
   valida `auth.uid()`, rol activo y `tienda_id` a mano dentro de la función
   antes de escribir nada — el patrón correcto para operaciones atómicas
   multi-tabla que necesitan saltarse RLS de forma controlada. Cambiarlas a
   `SECURITY INVOKER` rompería el POS (dejarían de poder escribir en tablas
   donde el cajero no tiene permisos RLS directos). Se presentó esto al
   usuario y se decidió dejarlas así — quedan como excepción aceptada, no
   como pendiente.

**Estado final del advisor:** 12 WARN (11 son la excepción aceptada de
`SECURITY DEFINER`, 1 requiere upgrade de plan). Cero Critical/Error.

---

## 3. Decisiones tomadas

| Decisión | Alternativa descartada | Razón |
|---|---|---|
| Timeout de 10s centralizado en `SessionService.getSession()` | Envolver solo en `authGuard` | `getSession()` también se usa en `refreshUser()` (constructor, corre en cada carga) y en `loadAuthContext()`; centralizarlo cubre los tres call-sites con un solo cambio |
| Tratar timeout como "sin sesión" (mismo camino que sesión ausente) | Reintentar automáticamente o mostrar pantalla de error dedicada | Mínimo cambio que resuelve el bloqueo reportado; el usuario puede reintentar login manualmente. Una UX de error más rica queda como mejora futura si se repite el síntoma |
| Refactor completo (RLS + grants por columna + `security_invoker=true`) en vez de solo documentar el hallazgo como excepción aceptada | Dejar la vista *definer* tal cual y anotar en un ADR por qué es intencional | El usuario eligió explícitamente el refactor completo al preguntársele; además alinea con la regla no negociable "RLS activado en todas las tablas... sin excepción" (CLAUDE.md §2.1) en vez de crear una excepción documentada |
| Aplicar la migración directamente al proyecto remoto vía `supabase db query --linked --file` (no `db push`, no MCP) | `supabase db push` | El historial de migraciones remoto está desalineado del local (ver `[[project_supabase_remote_access]]`); el MCP de Supabase no tiene token válido en este entorno. `db query --linked --file` aplica el SQL directo sin depender de la tabla de historial |
| No tocar las 11 funciones `SECURITY DEFINER` ni intentar habilitar Leaked Password Protection sin plan Pro | Convertir las funciones a `SECURITY INVOKER`; contratar/gestionar upgrade de plan sin preguntar | Las funciones son RPCs atómicos con validación de rol/tienda manual adentro — cambiarlas rompería el POS. El upgrade de plan es una decisión de costo que le corresponde al dueño, no algo que se resuelva con código |

---

## 4. ADRs creados o actualizados

- Ninguno — es un fix defensivo puntual (timeout en una llamada de red a un
  boundary externo), no un cambio arquitectónico.

---

## 5. Tests

- [x] `pnpm typecheck` — pasó
- [x] `pnpm lint` — pasó
- [x] `pnpm test` — 710 tests pasaron (78 archivos), 0 fallaron (corrido tres
      veces: tras el fix del guard, tras la migración de la vista y tras la
      limpieza de RLS de `product_options`)
- [x] `supabase db lint --linked` — sin errores de esquema
- [x] `supabase db advisors --linked` — hallazgo `security_definer_view` de
      `storefront_productos_publicos` ya no aparece; total de hallazgos bajó
      de 20 (post Tarea 2) a 12 (post Tarea 3), todos WARN

No se agregó test unitario nuevo para `session.service.ts`: el proyecto aún
no tiene setup de tests Angular para servicios con `inject()`/Supabase (ver
CLAUDE.md §2.3, "Tests Angular pendientes de setup").

---

## 6. Bloqueos y preguntas pendientes

- [x] Confirmado por el usuario: "Ya funciona" tras el fix.
- [ ] Sigue sin resolverse *por qué* el fetch a `/auth/v1/token` se colgaba en
      el entorno del usuario (red/proxy/extensión del navegador vs. algo del
      lado de Supabase). El fix evita que la app se congele, pero no elimina
      la causa de que la petición de red no concluyera. Si vuelve a pasar con
      frecuencia, vale la pena investigar esa causa de fondo (no se pudo
      reproducir en vivo esta sesión: la extensión Claude in Chrome no estaba
      conectada).

---

## 7. Próximos pasos

1. ~~Pedirle al usuario que recargue el sitio y confirme si ahora llega a
   `/login` en vez de quedarse en blanco~~ — confirmado: "Ya funciona".
2. Si el problema persiste incluso con el timeout (p. ej. la propia carga de
   `runtime-config.json` o el bundle nunca llega), investigar la capa de
   red/despliegue (Docker/nginx, `docker/40-runtime-config.sh`) en vez del
   cliente Supabase.
3. Si el síntoma se repite seguido, considerar: (a) limpiar el
   `localStorage` de la sesión cuando el timeout se dispara, para que el
   próximo intento no vuelva a arrastrar el mismo refresh_token problemático;
   (b) mostrar un mensaje de error visible en vez de redirigir silenciosamente
   a `/login`.
4. Correr `supabase db pull` (o revisar manualmente) para que
   `supabase/migrations/` refleje el estado real del remoto en algún momento
   — el historial de migraciones sigue desalineado (varias migraciones
   locales no aparecen como aplicadas en `supabase migration list --linked`
   aunque el esquema remoto sí las tiene, incluidas las dos nuevas de hoy).
   No es urgente pero conviene resolverlo antes de que alguien corra
   `supabase db reset` localmente y descubra diffs inesperados.
5. ~~Considerar revisar los otros hallazgos WARN del Security Advisor~~ —
   hecho en la Tarea 3: `product_options` corregido, `SECURITY DEFINER`
   aceptado como excepción intencional.
6. Si el dueño decide en algún momento subir a plan Pro de Supabase, activar
   `password_hibp_enabled` con
   `PATCH https://api.supabase.com/v1/projects/rmaieqyscchtxxkgxgik/config/auth`
   (`{"password_hibp_enabled": true}`) — es el único hallazgo que queda
   pendiente y no depende de código.

---

## 8. Notas adicionales

- El repo tiene trabajo en progreso sin commitear para dockerizar el
  despliegue (`Dockerfile`, `docker/`, `.dockerignore`) — se revisó
  `docker/40-runtime-config.sh` y `docker/nginx.conf` como parte del
  diagnóstico y ambos se ven correctos (si faltan `SUPABASE_URL`/
  `SUPABASE_ANON_KEY` el contenedor falla al iniciar, no serviría una
  pantalla en blanco).
