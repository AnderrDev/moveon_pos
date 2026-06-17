# Spec de Sesión — 2026-06-17 — Configuración del MCP de Supabase

> Copia este archivo como `YYYY-MM-DD-<tema-kebab-case>.md` al inicio de cada sesión de trabajo.
> Llénalo durante y al final de la sesión. Es el registro de lo que pasó.

---

## Metadatos

| Campo | Valor |
|---|---|
| Fecha | 2026-06-17 |
| Sprint | N/A (tarea de tooling/config) |
| Agente | Claude Code |
| HUs trabajadas | N/A |
| Estado | Completada |

---

## 1. Objetivo de la sesión

Configurar/reparar el servidor MCP de Supabase para que Claude Code pueda usar las herramientas `mcp__supabase__*` (list_tables, execute_sql, get_advisors, etc.) en este repo.

---

## 2. Lo que se implementó

### 2.1 Diagnóstico inicial
- `.mcp.json` (gitignored, no se commitea) ya tenía configurado el server `supabase` vía `npx @supabase/mcp-server-supabase@latest --access-token <token-hardcodeado>`.
- Se probó `mcp__supabase__list_projects` → respondió `Unauthorized`: el token hardcodeado en `.mcp.json` estaba vencido/revocado.
- Se detectó un **segundo token distinto** en `.claude/settings.local.json` (`env.SUPABASE_ACCESS_TOKEN`) que no estaba siendo usado por `.mcp.json` (no había referencia `${...}`).

### 2.2 Archivos modificados
- `.mcp.json` — el arg `--access-token` pasó de tener el token hardcodeado a `${SUPABASE_ACCESS_TOKEN}` (se resuelve desde el env de Claude Code).
- `.claude/settings.local.json` — `env.SUPABASE_ACCESS_TOKEN` actualizado con un Personal Access Token nuevo generado por el usuario en https://supabase.com/dashboard/account/tokens (nombre sugerido: `mcp-moveonapp-pos-local`).

Resultado: un solo token, gestionado en un solo lugar (`settings.local.json`), referenciado por `.mcp.json`. Ninguno de los dos archivos se commitea (`.mcp.json` y `.claude/settings.local.json` están en `.gitignore` / son locales).

### 2.3 Archivos eliminados
- (ninguno)

---

## 3. Decisiones tomadas

| Decisión | Alternativa descartada | Razón |
|---|---|---|
| Generar un Personal Access Token nuevo en vez de reutilizar el que estaba en `settings.local.json` | Probar primero el token existente en `settings.local.json` | El usuario prefirió empezar limpio con un token nuevo en vez de adivinar si el viejo seguía vigente |
| `.mcp.json` referencia el token vía `${SUPABASE_ACCESS_TOKEN}` en vez de hardcodearlo | Dejar el token hardcodeado directamente en `.mcp.json` | Evita tener el secreto duplicado en dos archivos distintos; una sola fuente de verdad |

---

## 4. ADRs creados o actualizados

- (ninguno — es config de tooling local, no decisión arquitectónica del producto)

---

## 5. Tests

- [x] `mcp__supabase__list_projects` — verificado en sesión nueva, responde correctamente y lista el proyecto `POS` (`rmaieqyscchtxxkgxgik`, status `ACTIVE_HEALTHY`), coincide con `.env.local`.

---

## 6. Bloqueos y preguntas pendientes

- (ninguno — verificación completada)

---

## 7. Próximos pasos

1. Opcional: revocar los tokens viejos (`sbp_c9e3b1...` y `sbp_b43c21...`) desde https://supabase.com/dashboard/account/tokens si siguen activos, ya que quedaron reemplazados por el nuevo token funcional.

---

## 8. Notas adicionales

- `.mcp.json` y `.claude/settings.local.json` están en `.gitignore`, por lo que ninguno de los tokens (viejo ni nuevo) llegó a git. Aun así, conviene revocar los tokens viejos desde el dashboard de Supabase para no dejar credenciales huérfanas activas.
