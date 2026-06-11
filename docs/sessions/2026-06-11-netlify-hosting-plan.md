# Spec de Sesión — 2026-06-11 — Netlify hosting plan

> Copia este archivo como `YYYY-MM-DD-<tema-kebab-case>.md` al inicio de cada sesión de trabajo.
> Llénalo durante y al final de la sesión. Es el registro de lo que pasó.

---

## Metadatos

| Campo | Valor |
|---|---|
| Fecha | 2026-06-11 |
| Sprint | Cierre MVP / CI-CD |
| Agente | Codex |
| HUs trabajadas | Infra frontend |
| Estado | Completada |

---

## 1. Objetivo de la sesión

Limpiar el árbol de Git preservando el trabajo acumulado y documentar una planeación para hospedar el frontend Angular estático en Netlify.

---

## 2. Lo que se implementó

### 2.1 Archivos creados
- `docs/adr/0009-hosting-frontend-netlify.md` — ADR propuesto para Netlify como hosting frontend.
- `docs/deploy/netlify.md` — guia operativa para configurar Netlify y validar el primer deploy.
- `netlify.toml` — build command, publish directory, redirect SPA y header de runtime config.
- `docs/sessions/2026-06-11-netlify-hosting-plan.md` — registro de esta sesión.

### 2.2 Archivos modificados
- `README.md` — elimina referencias legacy a Next/Vercel y refleja Angular + Supabase + propuesta Netlify.
- `docs/02-architecture.md` — actualiza la sección de deploy para apuntar a ADR 0009.
- `docs/04-roadmap.md` — limpia entregables legacy de Vercel/Next/shadcn.
- `docs/adr/0009-hosting-frontend-netlify.md` — pasa de propuesto a aceptado y registra la configuracion creada.

### 2.3 Archivos eliminados
- No aplica.

---

## 3. Decisiones tomadas

_Decisiones que no quedaron en ADR pero son relevantes para el contexto._

| Decisión | Alternativa descartada | Razón |
|---|---|---|
| Aceptar Netlify como hosting frontend | Firebase Hosting, Cloudflare Pages, GitHub Pages, Supabase Storage, Vercel | La app Angular es estática, Supabase ya cubre backend y Netlify ofrece setup directo para Angular/SPA y deploy previews. |

---

## 4. ADRs creados o actualizados

- `docs/adr/0009-hosting-frontend-netlify.md` — Netlify como hosting frontend aceptado.

---

## 5. Tests

- [x] `pnpm typecheck` — pasó.
- [x] `pnpm lint` — pasó.
- [x] `pnpm test` — 34 archivos, 299 tests pasaron.
- [x] `pnpm build` — pasó.

Detalle de fallos (si los hay):

---

## 6. Bloqueos y preguntas pendientes

- [ ] Pendiente configurar variables en Netlify.
- [ ] Pendiente configurar Redirect URLs en Supabase Auth.
- [ ] Pendiente ejecutar primer deploy preview.

---

## 7. Próximos pasos

_Qué debe hacer el próximo agente o sesión para continuar._

1. Configurar Netlify env vars.
2. Configurar Supabase Auth Redirect URLs.
3. Ejecutar primer deploy preview y validar login/rutas.
4. Agregar dominio propio cuando el negocio lo defina.

---

## 8. Notas adicionales

- `pnpm typecheck` requiere ejecutar el build Angular fuera del sandbox en este entorno; dentro del sandbox puede abortar con `SIGABRT`.
- Árbol de Git limpiado en tres commits locales: inventario por ubicación, stock en cards POS y planeación Netlify.
