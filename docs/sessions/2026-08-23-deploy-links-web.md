# Spec de Sesión — 2026-08-23 — Deploy de links-web a Netlify

---

## Metadatos

| Campo | Valor |
|---|---|
| Fecha | 2026-08-23 |
| Sprint | N/A |
| Agente | Claude Code |
| HUs trabajadas | ADR 0020 (paso pendiente: tercer sitio Netlify) |
| Estado | En progreso |

---

## 1. Objetivo de la sesión

Subir `apps/links-web` (existía completo en local, sin commitear, en la
rama `dev`) para poder crear el tercer sitio Netlify que menciona el ADR
0020 como configuración operativa pendiente, y exponerlo en un subdominio
de `moveonnutrition.com`.

---

## 2. Lo que se implementó

Esta sesión NO se hizo sobre `dev` directamente: `dev` tiene una cantidad
grande de cambios sin commitear ajenos a links-web (refactor de catálogo,
correcciones de inventario del POS, Docker). Para no arrastrar ese
trabajo sin revisar a `main`, se creó un worktree aislado desde
`origin/main` (rama `claude/deploy-links-web`) y se copiaron ahí
únicamente los archivos de links-web.

### 2.1 Archivos creados
- `apps/links-web/` completo (app, `netlify.toml`, tests) — copiado tal
  cual desde el estado local en `dev`, sin cambios de contenido.
- `docs/adr/0020-app-independiente-enlaces-publicos.md` — copiado desde
  `dev` (ya existía redactado, sin commitear).
- `docs/modules/links-web.md` — copiado desde `dev`.
- `docs/sessions/2026-08-20-linktree-redes.md` — copiado desde `dev`.

### 2.2 Archivos modificados
- `angular.json` — se aplicó (vía patch aislado) únicamente el bloque del
  proyecto `links-web`; diff limpio, no toca `pos-angular` ni
  `landing-web`.
- `package.json` — se aplicó únicamente los scripts `dev:links`,
  `build:links`, `build:links:docker`, `lint:links`, `typecheck:links`.
- `.gitignore` — se agregó `/apps/links-web/dist` (mismo patrón que ya
  existía para `apps/landing-web/dist`).

### 2.3 Archivos eliminados
- (ninguno)

---

## 3. Decisiones tomadas

| Decisión | Alternativa descartada | Razón |
|---|---|---|
| Worktree aislado desde `main` en vez de commitear sobre `dev` | Subir `dev` completo a `main` | `dev` tiene ~20 archivos sin commitear de features no relacionadas (inventario, catálogo, Docker) que no fueron revisados en esta sesión |
| No incluir Docker (`Dockerfile`, `.dockerignore`, `docker/`, sección de README) | Incluirlo porque el ADR 0020 lo menciona | El pedido de esta sesión es el despliegue por Netlify; Docker es un mecanismo de hosting aparte y self-hosted, fuera de alcance hoy |
| No tocar `vitest.config.ts` aunque `links-content.test.ts` no corre en esta rama | Agregar el glob de test | El ajuste de config de tests vive en los cambios pendientes de `dev`, fuera del alcance de esta sesión (no bloquea build/lint) |

---

## 4. ADRs creados o actualizados

- Ninguno nuevo. Se retoma `docs/adr/0020-app-independiente-enlaces-publicos.md` (ya existente, sin commitear en `dev`), que deja explícito que crear el tercer sitio Netlify y su URL final es "configuración operativa posterior" — es justo lo que se ejecuta en esta sesión.

---

## 5. Tests

- [x] `pnpm install --frozen-lockfile` — pasó
- [x] `ng build links-web` — pasó (121.86 kB / 36.56 kB transfer)
- [x] `ng lint links-web` — pasó, sin errores
- [x] `ng build pos-angular` — pasó (verificación de que el resto del workspace no se rompió)
- [x] `ng build landing-web` — pasó
- [ ] `vitest run` para `links-content.test.ts` — no corre en esta rama: `vitest.config.ts` de `main` no incluye el glob de `apps/links-web`, ver sección 3

---

## 6. Bloqueos y preguntas pendientes

- [ ] Definir el subdominio final (propuesta: `links.moveonnutrition.com`) y agregar el registro DNS en Cloudflare.
- [ ] Crear el sitio Netlify y configurar manualmente "Package directory" = `apps/links-web` en el dashboard (ver gotcha documentado en ADR 0012 — no es posible por API).
- [ ] Conectar el sitio Netlify a esta rama/PR y luego a `main` una vez mergeado.
- [ ] `vitest.config.ts` no cubre `apps/links-web` — pendiente de agregar cuando se resuelva el resto de cambios de `dev`.

---

## 7. Próximos pasos

1. Abrir/revisar el PR de `claude/deploy-links-web` → `main`.
2. Una vez mergeado: crear sitio Netlify, configurar Package directory, conectar dominio.
3. Retomar por separado (fuera de esta sesión) el resto del trabajo pendiente en `dev` (inventario, catálogo, Docker) para no perderlo.

---

## 8. Notas adicionales

Esta sesión no tocó la rama `dev` en ningún momento — todo el trabajo sin commitear que ya existía ahí (inventario, refactor de catálogo, Docker, ~20 archivos) sigue intacto en el working directory original, sin combinar con este cambio.
