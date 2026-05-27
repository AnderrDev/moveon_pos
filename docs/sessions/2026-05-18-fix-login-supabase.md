# Spec de Sesión — 2026-05-18 — Fix login Supabase (Failed to fetch)

---

## Metadatos

| Campo | Valor |
|---|---|
| Fecha | 2026-05-18 |
| Sprint | Mantenimiento / post-migración Angular |
| Agente | Claude Code |
| HUs trabajadas | N/A (bugfix runtime) |
| Estado | En progreso |

---

## 1. Objetivo de la sesión

Resolver el error de login en la app Angular: `Failed to fetch` al llamar
`https://rmaieqyscchtxxkgxgik.supabase.co/auth/v1/token?grant_type=password`.

---

## 2. Lo que se implementó

### 2.1 Archivos creados
- _pendiente_

### 2.2 Archivos modificados
- _pendiente_

---

## 3. Decisiones tomadas

| Decisión | Alternativa descartada | Razón |
|---|---|---|
| | | |

---

## 4. ADRs creados o actualizados

- _pendiente_

---

## 5. Tests

- [ ] `pnpm typecheck`
- [ ] `pnpm lint`
- [ ] `pnpm test`

---

## 6. Bloqueos y preguntas pendientes

- [ ] _pendiente_

---

## 7. Próximos pasos

1. _pendiente_

---

## 8. Notas adicionales

- Error reportado por el usuario:
  `Failed to fetch — https://rmaieqyscchtxxkgxgik.supabase.co/auth/v1/token?grant_type=password`
- "Failed to fetch" típicamente indica: CORS, DNS no resuelto, red sin conexión, URL/anon key incorrecta, o proyecto Supabase pausado.
