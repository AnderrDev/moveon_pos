# Spec de Sesión — 2026-08-15 — Modelo de datos consumido por la landing

---

## Metadatos

| Campo | Valor |
|---|---|
| Fecha | 2026-08-15 |
| Sprint | N/A (auditoría de solo lectura) |
| Agente | Codex |
| HUs trabajadas | Ninguna |
| Estado | Completada |

---

## 1. Objetivo de la sesión

Identificar los objetos Supabase y el modelo de datos que consume realmente
`apps/landing-web`, diferenciando el esquema versionado del estado remoto actual.

---

## 2. Lo que se implementó

### 2.1 Archivos creados

- Este spec de sesión; no se creó código de producto.

### 2.2 Archivos modificados

- Ninguno.

### 2.3 Archivos eliminados

- Ninguno.

---

## 3. Decisiones tomadas

| Decisión | Alternativa descartada | Razón |
|---|---|---|
| Reportar por separado consumo directo, tablas base y contenido estático | Llamar "tablas" a todos los datos visibles | La landing consume una vista y un RPC; varias secciones no vienen de Supabase |
| No atribuir al MCP el estado remoto | Presentar datos locales como resultado MCP | El MCP respondió `Unauthorized` por ausencia de `SUPABASE_ACCESS_TOKEN` |

---

## 4. ADRs creados o actualizados

- Ninguno.

---

## 5. Tests

- No aplican: auditoría de solo lectura, sin cambios de código.
- Verificación REST anónima contra producción:
  - `storefront_productos_publicos`: HTTP 200.
  - `storefront_contact_settings`: HTTP 404 / `PGRST205`.
  - `storefront_club_progress`: HTTP 404 / `PGRST202`.

---

## 6. Bloqueos y preguntas pendientes

- [ ] Configurar `SUPABASE_ACCESS_TOKEN` en el servidor MCP para permitir introspección remota autenticada.
- [ ] Decidir si se aplican las migraciones pendientes de contacto público y MOVE ON Club.

---

## 7. Próximos pasos

1. Autenticar el MCP de Supabase y repetir `list_tables(verbose: true)`.
2. Si el dueño lo autoriza, aplicar primero en una rama las migraciones pendientes y verificar RLS.
3. Regenerar `database.types.ts` después de alinear el remoto.

---

## 8. Notas adicionales

La vitrina de suplementos consulta `storefront_productos_publicos`, una vista sobre
`productos` y `categorias`. Batidos, toppings, café, snacks y combos visibles están
hardcodeados en `catalog-content.ts` y no son filas de esas tablas.
