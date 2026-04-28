# Spec de Sesión — 2026-04-28 — Deploy Vercel

---

## Metadatos

| Campo | Valor |
|---|---|
| Fecha | 2026-04-28 |
| Sprint | Preparación producción |
| Agente | Codex |
| HUs trabajadas | N/A — guía operativa |
| Estado | Completada |

---

## 1. Objetivo de la sesión

Definir el procedimiento para desplegar MOVEONAPP POS en Vercel con variables de Supabase, migraciones y validación previa.

---

## 2. Lo que se implementó

### 2.1 Archivos creados
- `docs/sessions/2026-04-28-deploy-vercel.md` — registro de la sesión.

### 2.2 Archivos modificados
- No se modificó código de aplicación.

### 2.3 Archivos eliminados
- (si aplica)

---

## 3. Decisiones tomadas

| Decisión | Alternativa descartada | Razón |
|---|---|---|
| Usar despliegue Git en Vercel como camino principal | CLI manual como único flujo | Git da preview por PR/commit y producción automática desde la rama principal. |
| No subir `SUPABASE_DB_URL` a Vercel salvo necesidad explícita | Copiar todas las variables locales | La URL directa de DB solo se usa para migraciones locales/operativas, no por la app en runtime. |

---

## 4. ADRs creados o actualizados

- Ninguno.

---

## 5. Tests

- No se ejecutaron tests; solo se revisó configuración y variables requeridas.

---

## 6. Bloqueos y preguntas pendientes

- [ ] Falta conectar el repositorio real a Vercel si aún no está importado.
- [ ] Falta definir dominio final y configurar `NEXT_PUBLIC_APP_URL` de producción.

---

## 7. Próximos pasos

1. Commit y push del árbol actual antes del deploy por Git.
2. Configurar variables de entorno en Vercel.
3. Ejecutar primer preview y revisar `/login`, `/pos`, `/caja`, `/reportes`.
4. Promover a producción y configurar dominio.

---

## 8. Notas adicionales

Variables requeridas por la app:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_APP_NAME`
- feature flags `NEXT_PUBLIC_FEATURE_*` si se usan.
