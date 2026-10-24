# Spec de Sesión — 2026-08-08 — Auditoría de arquitectura de `apps/landing-web`

> Copia este archivo como `YYYY-MM-DD-<tema-kebab-case>.md` al inicio de cada sesión de trabajo.
> Llénalo durante y al final de la sesión. Es el registro de lo que pasó.

---

## Metadatos

| Campo | Valor |
|---|---|
| Fecha | 2026-08-08 |
| Sprint | — (auditoría, no HU) |
| Agente | Claude Code |
| HUs trabajadas | Ninguna — auditoría de solo lectura |
| Estado | Completada |

---

## 1. Objetivo de la sesión

Auditar `apps/landing-web` (catálogo público) en arquitectura, buenas prácticas, principios SOLID y patrones de diseño, contrastando contra ADR 0012 (app independiente) y los estándares del repo. Solo diagnóstico; no se aplicaron fixes.

---

## 2. Lo que se implementó

### 2.1 Archivos creados
- `docs/sessions/2026-08-08-auditoria-landing.md` — este spec.

### 2.2 Archivos modificados
- Ninguno (auditoría de solo lectura).

### 2.3 Archivos eliminados
- Ninguno.

---

## 3. Decisiones tomadas

Ninguna decisión de implementación; la auditoría respeta las excepciones deliberadas del ADR 0012 (sin Router, sin Tailwind, sin capas domain/data, core duplicado por regla de tres) y no las cuenta como hallazgos.

---

## 4. ADRs creados o actualizados

- Ninguno.

---

## 5. Tests

No se corrieron (sin cambios de código). Hallazgo relevante: `landing-web` no tiene tests y no está incluida en `vitest.config.ts` ni en CI.

---

## 6. Bloqueos y preguntas pendientes

- [ ] Decidir cuáles hallazgos de la auditoría se convierten en tareas PLAN-XX.

---

## 7. Próximos pasos (hallazgos priorizados de la auditoría)

1. **CI no cubre landing-web**: `.github/workflows/ci.yml` solo corre `pnpm typecheck/lint/build` (pos-angular). Agregar `lint:landing` + `typecheck:landing`/`build:landing`. Además CI dispara en `main`/`develop` pero la rama de trabajo es `dev` → CI posiblemente nunca corre en `dev`.
2. **Descomponer `catalogo.page.ts` (968 líneas, god component)**: extraer contenido estático (menús/precios de batidos, café, snacks, combos) a un módulo de datos, secciones a subcomponentes, y helper compartido para links de WhatsApp (duplicado con `offers-carousel`).
3. **Config de auth de Supabase innecesaria** en `SupabaseClientService` de landing (`persistSession/autoRefreshToken/detectSessionInUrl: true` en una app 100% anónima) → poner en `false`.
4. **Casts estructurales** (`ContactClient`, `RpcClient`) por tipos generados desactualizados → regenerar `database.types.ts` (`pnpm db:types`) y eliminar los casts.
5. **Errores capturados no llegan a Sentry**: el `catch` de `ngOnInit` en `catalogo.page.ts` y el de `consultar()` en club no llaman `reportError()`.
6. Tests unitarios para la lógica de filtrado/paginación/normalización (extraer funciones puras primero) e incluir `apps/landing-web` en `vitest.config.ts`.

---

## 8. Notas adicionales

Veredicto general: app sana y proporcionada a su tamaño (~2.2k líneas, 10 archivos). Buenos patrones: runtime-config, wrapper Sentry con import dinámico, mapeo snake_case→camelCase en el borde (anti-corrupción), signals+computed+OnPush+zoneless, accesibilidad cuidada. El informe completo quedó en la conversación de esta sesión.
