# ADR 0003 — Multi-sede preparado en datos

**Fecha:** 2026-04-25
**Estado:** Aceptado
**Decisores:** Equipo MOVEONAPP

## Contexto

El negocio tiene 1 sede hoy, pero planea abrir más. Hay dos enfoques:

1. Construir el MVP solo para 1 sede, luego refactorizar cuando abran la segunda.
2. Modelar multi-sede desde el inicio en datos, aunque la UI no lo exponga aún.

## Decisión

**Modelamos multi-sede en datos desde el día 1.** La UI no expone selector de tienda en MVP v1.0 (siempre opera con la única tienda activa), pero todas las tablas operativas llevan `tienda_id NOT NULL` y las políticas RLS filtran por tienda.

## Consecuencias

### Positivas
- Costo de implementación adicional en MVP es bajo (un campo más por tabla).
- Cuando abran segunda sede, el cambio es solo de UI (selector de tienda) y configuración de usuarios.
- Reportes ya están preparados para filtrar por tienda.

### Negativas
- Migrations un poco más complejas.
- Cada query incluye join o filtro por `tienda_id`.

### Comparativa de costo
- Hacerlo ahora: ~10% extra en sprint 0–1.
- Hacerlo después: refactor masivo de DB, RLS, código y tests. Estimado: 2–3 sprints completos.

La decisión es claramente económica.

### Reglas derivadas
- Cualquier nueva tabla operativa **debe** llevar `tienda_id`.
- Excepciones: `auth.users` (de Supabase), `audit_logs` global.
- La tabla `user_tiendas` mapea usuarios con tiendas y rol — un usuario puede pertenecer a varias tiendas (futuro).
- En v1.0, el `tienda_id` activo se obtiene de `user_tiendas` del usuario logueado (debe haber exactamente 1 activa).
