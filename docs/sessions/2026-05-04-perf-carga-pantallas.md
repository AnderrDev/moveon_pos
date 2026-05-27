# Spec de Sesión — 2026-05-04 — Perf: carga lenta de pantallas

---

## Metadatos

| Campo | Valor |
|---|---|
| Fecha | 2026-05-04 |
| Sprint | Sprint 4 (paralelo) |
| Agente | Claude Code |
| HUs trabajadas | N/A (issue de performance) |
| Estado | Completada (fix base aplicado, falta validar en navegador) |

---

## 1. Objetivo de la sesión

El usuario reporta que las pantallas tardan bastante en cargar en la app Angular. Diagnosticar el origen (bundle, lazy-loading, llamadas iniciales a Supabase, change-detection, dev-server, etc.) y proponer/aplicar mejoras concretas.

---

## 2. Lo que se implementó

### 2.1 Archivos creados
- Ninguno.

### 2.2 Archivos modificados
- `apps/pos-angular/src/app/core/auth/session.service.ts` — se cachea `AngularAuthContext` después de la primera carga. Ahora `getAuthContext()` reusa el cache y solo invalida cuando cambia el `user` (vía `onAuthStateChange`, `signIn`, `signOut`). Antes, cada llamada hacía un roundtrip a Supabase contra `user_tiendas`.

### 2.3 Archivos eliminados
- Ninguno.

---

## 3. Decisiones tomadas

| Decisión | Alternativa descartada | Razón |
|---|---|---|
| Cachear `AuthContext` en memoria dentro de `SessionService` | Usar localStorage / un signal global con `effect` | El cache vive lo que viva el SPA; la cookie/token de Supabase ya gestiona persistencia. No hace falta otro storage. |
| Invalidar solo en eventos de auth (`signIn`, `signOut`, `onAuthStateChange`) | Invalidar en cada `getSession()` | `getSession()` se llama desde `authGuard` en cada navegación. Invalidar ahí derrotaría el cache. El `tienda_id`/rol no cambian sin que cambie el `user`. |
| Coalescer llamadas concurrentes con `contextPromise` | Permitir múltiples queries simultáneas | Al cargar el POS varios componentes piden contexto a la vez. Sin coalescing pegaríamos N queries a `user_tiendas` en paralelo. |

---

## 4. ADRs creados o actualizados

- Ninguno (cambio de implementación, no decisión arquitectónica nueva).

---

## 5. Tests

- [x] `pnpm typecheck` — pasó.
- [x] `pnpm lint` — pasó (All files pass linting).
- [ ] `pnpm test` — sin specs nuevos para `session.service`; el módulo actual no tiene cobertura unitaria.

---

## 6. Bloqueos y preguntas pendientes

- [ ] Validar en navegador que la mejora se siente perceptible (ideal: medir Network panel — antes había 1 query a `user_tiendas` por navegación + por cada acción/diálogo).
- [ ] Si la lentitud persiste en pantallas concretas (Reportes, Caja), revisar las queries propias de cada feature (faltan índices, SELECTs sin paginar, etc.).

---

## 7. Próximos pasos

1. Probar en navegador (`pnpm dev`) y confirmar que las navegaciones entre POS / Productos / Inventario / Caja / Clientes / Reportes son visiblemente más rápidas.
2. Si Reportes sigue lento: revisar `reports.service.ts` — agregaciones grandes pueden necesitar RPC con índices o caché por turno.
3. Considerar precarga de rutas con `withPreloading(PreloadAllModules)` en `provideRouter` si se quieren navegaciones aún más rápidas a costa de descargar todos los chunks al inicio.
4. Considerar `ChangeDetectionStrategy.OnPush` en `ShellComponent` y `PosPage` (ya está aplicado en `ProductosPage` e `InventarioPage`).
5. Migrar a Angular **zoneless** (`provideZonelessChangeDetection`) cuando exista cobertura de tests; rinde mejor con apps basadas en signals.

---

## 8. Notas adicionales

**Diagnóstico del cuello de botella:**
- 24+ call sites llamaban `session.getAuthContext()` (cada page + cada diálogo + cada acción de eliminación/desactivación).
- `getAuthContext()` hacía siempre 2 round-trips: `auth.getSession()` (rápido si está en localStorage) + `SELECT FROM user_tiendas` (siempre red, ~100-300 ms cada uno).
- Adicionalmente `authGuard` corre en cada navegación → `getSession()` adicional.
- El POS además dispara 3 queries de datos en paralelo después de obtener el contexto, haciendo que la cascada total fuera: guard → context (2 RTT) → datos (3 RTT en paralelo) → render. Con el cache, queda: guard → context (cache, 0 RTT) → datos.

**Stack confirmado:** Angular 21 standalone PWA + Tailwind v4 + Supabase. Sin SSR (SPA estática). Build con `@angular-devkit/build-angular:application`. Bundle inicial ~2.19 MB en dev (con source maps); chunks lazy por feature 25–87 kB.
