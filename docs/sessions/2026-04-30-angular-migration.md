# Spec de Sesión — 2026-04-30 — Migración a Angular

---

## Metadatos

| Campo          | Valor                             |
| -------------- | --------------------------------- |
| Fecha          | 2026-04-30                        |
| Sprint         | Migración técnica                 |
| Agente         | Codex                             |
| HUs trabajadas | Base Angular, HU-13, HU-14, HU-17 |
| Estado         | Completada (fase inicial)         |

---

## 1. Objetivo de la sesión

Iniciar la migración del POS desde Next.js/React a Angular, conservando Clean Architecture, formularios con Zod/factory/mapper, diseño responsive, lógica de dominio y funcionamiento del POS.

---

## 2. Lo que se implementó

### 2.1 Archivos creados

- `angular.json` — workspace Angular con aplicación `pos-angular`.
- `tsconfig.angular.json` — configuración TypeScript/Angular estricta.
- `.postcssrc.json` — PostCSS compatible con Angular CLI y Tailwind CSS 4.
- `apps/pos-angular/` — aplicación Angular standalone.
- `apps/pos-angular/src/app/core/` — shell, auth guard, session service y cliente Supabase browser.
- `apps/pos-angular/src/app/features/auth/` — login Angular con Reactive Forms, Zod factory y mapper existentes.
- `apps/pos-angular/src/app/features/pos/` — POS Angular inicial con catálogo, carrito, cobro y venta vía RPC.
- `docs/adr/0006-migracion-next-a-angular.md` — decisión arquitectónica de migración.
- `docs/migration/angular-migration-plan.md` — plan por fases.

### 2.2 Archivos modificados

- `package.json` — scripts principales migrados a Angular (`dev`, `build`) y scripts legacy Next (`dev:next`, `build:next`).
- `tsconfig.json` — habilitado `experimentalDecorators` para convivencia temporal.
- `src/modules/auth/forms/login-form.factory.ts` — defaults compatibles con browser/Angular.
- `docs/02-architecture.md` — stack actualizado a Angular y flujo de datos nuevo.
- `docs/standards/forms.md` — patrón Angular: factory + mapper + presenter.
- `docs/standards/ui-components.md` — ubicación de componentes Angular.
- `.env.example` — nota de configuración para Angular.

### 2.3 Archivos eliminados

- Ninguno.

---

## 3. Decisiones tomadas

| Decisión                                      | Alternativa descartada                      | Razón                                                                         |
| --------------------------------------------- | ------------------------------------------- | ----------------------------------------------------------------------------- |
| Crear Angular en `apps/pos-angular`           | Sobrescribir `src/app` de Next directamente | Permite migración verificable por módulo sin dejar el POS inoperable.         |
| Mantener dominio y factories en `src/modules` | Duplicar reglas en Angular                  | Evita divergencia y conserva tests existentes.                                |
| Usar Angular signals para carrito             | Instalar un state manager externo           | Estado local pequeño, explícito y suficiente para POS.                        |
| Crear venta Angular vía `create_sale_atomic`  | Rehacer secuencia de inserts desde browser  | Las ventas requieren transacción, validación de stock y consistencia de caja. |
| Mantener scripts Next con sufijo `:next`      | Eliminar Next en esta sesión                | Falta portar productos, inventario, caja, clientes y reportes.                |

---

## 4. ADRs creados o actualizados

- `docs/adr/0006-migracion-next-a-angular.md` — Angular standalone reemplaza Next/React como framework principal.

---

## 5. Tests

- [x] `corepack pnpm build` — Angular build pasó.
- [x] `corepack pnpm typecheck` — `tsc --noEmit` + Angular development build pasaron.
- [x] `corepack pnpm lint` — pasó con lint legacy de Next.
- [x] `corepack pnpm test` — 17 archivos, 116 tests pasaron.
- [x] `corepack pnpm build:next` — puente legacy Next sigue compilando.

Notas:

- Angular CLI 21 requiere `.postcssrc.json`; no lee `postcss.config.mjs` para esta ruta.
- Queda warning de peer dependency: `@angular/build` espera `vitest@^4.0.8`, el repo sigue en `vitest@2.1.9`. No bloquea build porque aún no hay target Angular de tests.
- Dev server Angular levantado en `http://localhost:4201/` porque `4200` estaba ocupado.

---

## 6. Bloqueos y preguntas pendientes

- Configurar valores reales de Supabase en `apps/pos-angular/src/environments/environment.ts`.
- Probar venta real en Angular con caja abierta.
- Decidir cuándo migrar ESLint a configuración Angular y retirar `next lint`.

---

## 7. Próximos pasos

1. Portar ticket imprimible y modal de éxito al POS Angular.
2. Portar historial/anulación de ventas.
3. Portar módulo Productos con el patrón `product-form.presenter.ts`.
4. Añadir runtime environment para Angular en lugar de editar `environment.ts`.
5. Cuando todos los módulos pasen, eliminar Next/React/RHF/Zustand.

---

## 8. Notas adicionales

- Se consultaron docs oficiales de Angular CLI, Angular standalone/application builder y Tailwind con Angular para ajustar la base.
- El worktree ya tenía cambios previos no relacionados en Supabase/env/middleware antes de esta sesión; no se revirtieron.
