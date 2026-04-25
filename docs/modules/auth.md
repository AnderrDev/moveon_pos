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
