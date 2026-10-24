# Spec de Sesión — 2026-09-25 — Verificar Netlify

## Metadatos

| Campo | Valor |
|---|---|
| Fecha | 2026-09-25 |
| Sprint | N/A |
| Agente | Codex |
| HUs trabajadas | N/A |
| Estado | Completada |

## 1. Objetivo de la sesión

Verificar si la aplicación `links-web` está desplegada y alojada en Netlify.

## 2. Lo que se implementó

### 2.1 Archivos creados

- `docs/sessions/2026-09-25-verificar-netlify.md` — registro de esta revisión.

### 2.2 Archivos modificados

- `docs/sessions/2026-09-25-verificar-netlify.md` — conclusión de la revisión.

### 2.3 Archivos eliminados

- Ninguno.

## 3. Decisiones tomadas

| Decisión | Alternativa descartada | Razón |
|---|---|---|
| Considerar `links-web` pendiente de despliegue | Inferir que el archivo `netlify.toml` prueba un despliegue activo | La configuración prepara el build, pero no existe vínculo local del sitio ni URL pública registrada; el spec original deja explícitamente pendiente crear el tercer sitio. |

## 4. ADRs creados o actualizados

- Ninguno.

## 5. Tests

- [ ] `pnpm typecheck` — no aplica
- [ ] `pnpm lint` — no aplica
- [ ] `pnpm test` — no aplica

## 6. Bloqueos y preguntas pendientes

- [ ] Para comprobar un posible despliegue externo posterior se necesita la URL exacta o acceso al dashboard de Netlify.

## 7. Próximos pasos

1. Crear y vincular el tercer sitio de Netlify si aún no existe.
2. Registrar su URL pública en la documentación y validar los cuatro destinos en producción.

## 8. Notas adicionales

La app incluye `apps/links-web/netlify.toml`, pero eso solo define cómo desplegarla. `docs/sessions/2026-08-20-linktree-redes.md` y ADR 0020 registran que la creación del sitio y la URL pública quedaron pendientes. La búsqueda pública tampoco encontró una instancia identificable de esta app. El remoto del proyecto es `https://github.com/AnderrDev/moveon_pos.git`, pero `apps/links-web/` aparece actualmente como directorio no rastreado (`??`), por lo que todavía no está publicado en ese repositorio remoto.
