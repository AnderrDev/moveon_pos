# Módulo: auth (Autenticación y autorización)

## Responsabilidad

Manejar sesión de usuarios, roles y permisos. Wrapper sobre Supabase Auth.

## Reglas
- Roles: `admin`, `cajero`. Definidos en `user_tiendas.rol`.
- Un usuario puede pertenecer a varias tiendas (futuro). En MVP solo a 1.
- Las páginas chequean rol con un guard server-side antes de renderizar.

## Helpers principales

- `getCurrentUser()` — server-only, devuelve usuario + tienda activa + rol.
- `requireRole(role)` — guard que tira 403 si no cumple.
- `useAuth()` — hook cliente para info de UI (no para autorización).

## Tabla `user_tiendas`
Ver `/docs/03-data-model.md`.

## Reglas de negocio
- RN-A01: solo usuarios `is_active = true` en `user_tiendas` pueden acceder.
- RN-A02: si un usuario tiene múltiples tiendas activas (futuro), debe haber un selector. En v1.0 solo se permite 1.

## Recuperación de contraseña (AUTH-05)

Flujo 100% cliente (sin backend/RPC/migración) sobre Supabase Auth:

1. `/login` muestra el link **"¿Olvidaste tu contraseña?"** → navega a `/recuperar-contrasena`.
2. `/recuperar-contrasena` (`mo-forgot-password-page`, **ruta pública**, fuera del shell/authGuard): valida el email (Zod) y llama `SessionService.requestPasswordReset(email, redirectTo)` → `supabase.auth.resetPasswordForEmail(email, { redirectTo })`. `redirectTo = window.location.origin + '/restablecer-contrasena'`.
3. Supabase envía el correo de "Reset Password". El enlace abre `/restablecer-contrasena` con tokens en el hash; `detectSessionInUrl: true` (ya activo en `supabase-client.service.ts`) crea automáticamente una **sesión de recuperación**.
4. `/restablecer-contrasena` (`mo-reset-password-page`, **ruta pública**): valida `password` + `confirmPassword` (Zod min 6 + coincidencia) y llama `SessionService.updatePassword(password)` → `supabase.auth.updateUser({ password })`. En éxito navega a `/pos` (la sesión de recuperación deja al usuario logueado) y muestra un toast de confirmación en el shell.

### Reglas
- **RN-A03 (no enumeración):** tras `resetPasswordForEmail` el mensaje es SIEMPRE genérico ("Si el correo existe, te enviamos un enlace...") salvo `status === 429` (rate limit) o `status === undefined` (red), que sí se informan mapeados. Nunca se revela si el email existe.
- Las páginas de recuperación son públicas (no las bloquea `authGuard`). Como `mo-toast-host` solo vive en `ShellComponent`, usan **feedback inline** (`mo-form-error` + bloque de éxito). El toast del reset se ve porque la navegación a `/pos` entra al shell.
- Errores mapeados en español por `reset-password-error-mapper.ts` (discrimina por `code`/`status`, nunca imprime `error.message` crudo).

### Archivos
(rutas post-ADR 0015 — todo dentro de `apps/pos-angular/src/app/features/auth/presentation/`)
- Forms (TS puro): `forms/forgot-password-form.{factory,mapper}.ts`, `forms/reset-password-form.{factory,mapper}.ts`.
- Angular: `pages/{forgot,reset}-password.page.ts`, `presenters/{forgot,reset}-password-form.presenter.ts`, `services/reset-password-error-mapper.ts`.
- `SessionService.requestPasswordReset` / `updatePassword`.
- Rutas: `recuperar-contrasena`, `restablecer-contrasena` (hermanas de `login`, fuera del shell).

### Configuración manual requerida en Supabase (NO aplicada por código)

> Hacer en el dashboard del proyecto (Authentication → URL Configuration / Email Templates). Pendiente de aplicar por el usuario.

- **Site URL:** el origen de producción/staging de la app (ej. `https://app.moveonpos.co`).
- **Redirect URLs (allowlist):** agregar `<origin>/restablecer-contrasena` para cada entorno usado, incluido `http://localhost:4200/restablecer-contrasena` para desarrollo. Si el origen no está en la allowlist, Supabase ignora el `redirectTo` y el enlace no funciona.
- **Email template "Reset Password":** confirmar que el enlace de acción apunte al flujo de recuperación (token de tipo `recovery`). Plantilla por defecto sirve; personalizar copy a español si se desea.
