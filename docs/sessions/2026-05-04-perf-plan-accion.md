# Plan de Acción — Performance de carga de pantallas

> Complementa la sesión `2026-05-04-perf-carga-pantallas.md`. El fix base (cache del `AuthContext`) ya está aplicado. Este plan ordena el resto del trabajo en fases ejecutables, priorizadas por impacto/esfuerzo.

---

## Contexto

**Síntoma:** las pantallas tardan en cargar.

**Línea base (antes del fix de hoy)** — cada navegación:
1. `authGuard` → `getSession()` (rápido si está en localStorage).
2. `getAuthContext()` → `auth.getSession()` + **`SELECT FROM user_tiendas`** (siempre red).
3. Queries de la feature (productos, ventas, etc.).

Total: **2–3 round-trips secuenciales antes de mostrar datos**.

**Después del fix de hoy:** el contexto se cachea en memoria → solo queda 1 round-trip (el de los datos de la feature) tras la primera navegación.

**Cuello de botella restante esperado:** Reportes (agrega muchas ventas en cliente) y Productos/POS (cargan el catálogo entero cada vez).

---

## Cómo medir (línea base y verificación)

Antes y después de cada fase, repetir:

1. `corepack pnpm dev` y abrir DevTools.
2. Login → navegar **POS → Productos → Inventario → Caja → Clientes → Reportes → POS** una vez.
3. **Network panel:** filtrar por `supabase.co/rest`. Anotar:
   - Cantidad de requests por navegación.
   - Tiempo total de cada request.
4. **Performance panel:** grabar la navegación. Anotar **FCP** y **time to interactive** por pantalla.
5. **Percepción:** ¿se siente "instantáneo" (<300 ms desde click en sidebar hasta datos en pantalla)?

Documentar números antes/después en este archivo (sección **Resultados**, al final).

---

## Fase 0 — Validar el fix actual (15 min) — **HACER PRIMERO**

**Objetivo:** confirmar que el cache del `AuthContext` ya redujo round-trips.

- [ ] `corepack pnpm dev` y login.
- [ ] Navegar entre las 6 pantallas.
- [ ] En Network panel: confirmar que `user_tiendas` se consulta **solo una vez** durante toda la sesión (no en cada navegación/diálogo).
- [ ] Si el cambio es perceptible → continuar con Fase 1.
- [ ] Si NO es perceptible → la causa está en otro lado; ir directo a Fase 4 (Reportes / queries pesadas).

**Riesgo:** ninguno. Solo lectura/observación.

---

## Fase 1 — Cache de datos referenciales compartidos (1–2 h) — **ALTO IMPACTO**

**Problema:** `productos` y `categorias` cambian pocas veces al día, pero se vuelven a pedir cada vez que entras a POS, Productos o Categorías. Son las queries más grandes (200 filas + JOIN implícito por categoría).

**Solución:** un store reactivo en `core/data/` que mantenga `products` y `categorias` en memoria con TTL/invalidación manual.

### Tareas

- [ ] Crear `apps/pos-angular/src/app/core/data/reference-data.store.ts`:
  - `@Injectable({ providedIn: 'root' })`.
  - Signals: `products`, `categorias`, `loading`, `lastLoadedAt`.
  - Métodos: `ensureLoaded()`, `invalidate()`, `replaceProduct(p)`, `replaceCategoria(c)`, `removeProduct(id)`.
  - Coalescing de llamadas concurrentes (mismo patrón que `SessionService.contextPromise`).
  - TTL opcional (5–10 min) por si la app queda abierta todo el día y otro operador edita el catálogo desde otro dispositivo.
- [ ] Refactorizar consumidores:
  - `pos-data.service.ts` → leer del store en vez de pegarle a Supabase.
  - `productos.page.ts` → idem; en `onSaved`, `confirmDeactivate` invalidar/actualizar el store.
  - `categorias.page.ts` → idem.
- [ ] Tests unitarios del store (`vitest`): hit/miss del cache, coalescing, invalidación.

**Criterio de éxito:** entrar al POS por segunda vez no dispara queries a `productos` ni `categorias`.

**Riesgos:**
- Datos viejos si otro operador edita el catálogo. Mitigación: invalidar en cualquier mutación local + TTL corto (5 min).
- Race conditions entre invalidación y re-fetch. Mitigación: el coalescing del `contextPromise` ya está probado en `SessionService`; reutilizar el patrón.

---

## Fase 2 — Optimizaciones de Angular (30 min) — **BAJO ESFUERZO, IMPACTO MEDIO**

### 2.1 OnPush en componentes que aún no lo usan

Hoy `ProductosPage`, `InventarioPage`, `CajaPage`, `ClientesPage`, `CategoriasPage` y los diálogos ya usan `ChangeDetectionStrategy.OnPush`. Faltan:

- [ ] `apps/pos-angular/src/app/core/layout/shell.component.ts`
- [ ] `apps/pos-angular/src/app/features/pos/pos.page.ts`
- [ ] `apps/pos-angular/src/app/features/auth/login.page.ts`
- [ ] `apps/pos-angular/src/app/features/reports/reportes.page.ts` (verificar)

> Como todo lo nuevo usa signals, el costo de migrar es trivial: agregar `changeDetection: ChangeDetectionStrategy.OnPush` y verificar que no haya bindings imperativos (`Date.now()` en template, etc.).

### 2.2 Preloading de rutas lazy

Hoy las rutas son `loadComponent`, así que el chunk se descarga **al hacer click**. Para tiendas con conexión estable, precargar todo después de cargar la primera vista da navegaciones instantáneas.

- [ ] En `app.config.ts`:
  ```ts
  import { provideRouter, withComponentInputBinding, withPreloading, PreloadAllModules } from '@angular/router'
  // ...
  provideRouter(routes, withComponentInputBinding(), withPreloading(PreloadAllModules)),
  ```
- [ ] Verificar en Network que los chunks se cargan ~2 s después del login (idle time), no al click.

**Criterio de éxito:** segunda navegación a cualquier feature sin descarga de chunk visible.

**Riesgo:** suma ~500–700 kB al uso de red en la primera carga. Aceptable para una PWA usada en tienda con WiFi.

---

## Fase 3 — Hygiene de índices en Supabase (15 min) — **BAJO IMPACTO HOY, IMPRESCINDIBLE EN PROD**

`user_tiendas` y otras tablas referenciales no tienen índices declarados explícitamente más allá de la PK. Con pocas filas no se nota; con datos reales sí.

- [ ] Crear migración `supabase/migrations/<timestamp>_perf_indexes.sql`:
  ```sql
  create index if not exists ix_user_tiendas_user_active
    on user_tiendas (user_id, is_active);

  create index if not exists ix_productos_tienda_active_nombre
    on productos (tienda_id, is_active, nombre);

  create index if not exists ix_categorias_tienda_active
    on categorias (tienda_id, is_active);
  ```
- [ ] `corepack pnpm db:migrate`.
- [ ] Validar con `EXPLAIN ANALYZE` en Supabase Studio que las queries del POS usan los nuevos índices.

**Criterio de éxito:** plan de ejecución usa Index Scan, no Seq Scan, en las queries top.

---

## Fase 4 — Reportes (1–2 h) — **SOLO SI SIGUE LENTO TRAS FASES 0–3**

`reports.service.ts:getDailyReport` hace dos cosas potencialmente costosas:

1. `salesRepo.listByDate(tiendaId, date)` → trae **todas las ventas del día con items y pagos**.
2. Agrega en cliente: `paymentBreakdown`, `topProducts`, `salesDetail`.

Para 50–100 ventas/día está bien. Si crece o se siente lento:

- [ ] Medir: `console.time` en `getDailyReport`. Anotar cuántas ventas trae y cuánto tarda cada bloque.
- [ ] Si la query a Supabase es el problema → revisar índices en `sales (tienda_id, created_at)` y `sale_items (sale_id)`.
- [ ] Si la agregación cliente es el problema → mover a una **función SQL** `get_daily_report(p_tienda_id uuid, p_date date)` que devuelve JSON. Una sola roundtrip, agregaciones en Postgres (mucho más rápido).
- [ ] Cachear resultado del día en `ReferenceDataStore` (TTL 30 s) para que cambios de filtro no re-disparen el fetch.

**Decisión:** no migrar a RPC ahora. Solo si las mediciones muestran >800 ms en datos reales.

---

## Fase 5 — PWA / Service Worker (3–4 h) — **POST-MVP**

Una vez estabilizadas las fases 1–4, agregar PWA da:
- Cache de assets estáticos (HTML, JS, CSS, fonts).
- Funcionamiento offline (al menos lectura del catálogo).
- Instalación como app en el dispositivo del operador.

- [ ] `ng add @angular/pwa --project pos-angular`.
- [ ] Configurar `ngsw-config.json`:
  - `assetGroups`: `prefetch` para shell + lazy chunks.
  - `dataGroups`: cache de `productos`/`categorias` con `freshness` strategy y maxAge 5 min.
- [ ] Verificar que el flujo de venta funciona con la red caída (al menos hasta el punto de "guardar en cola").

**Riesgo:** SW puede servir versiones viejas si el deploy no invalida. Mitigación: política `freshness` para datos, `prefetch` con hash en assets.

**Decisión:** no priorizar hasta tener datos reales en producción.

---

## Fase 6 — Bundle (30 min) — **REVISIÓN**

- [ ] `corepack pnpm build` (production).
- [ ] Anotar tamaño de cada chunk del output. Comparar con budgets en `angular.json` (warning 650 kB, error 1 MB).
- [ ] Si algún chunk es excesivo, identificar dependencias gordas (`source-map-explorer dist/pos-angular/browser/main.js` o el equivalente).
- [ ] Si `supabase-js` aparece en main: confirmar que está en chunk lazy. Hoy debería estarlo porque solo se usa en services Angular.

**Criterio de éxito:** todos los lazy chunks <120 kB; main inicial <300 kB en producción.

---

## Criterios de éxito globales

- [ ] Navegación entre pantallas <300 ms (perceptual instant) tras Fase 0–2.
- [ ] Pantallas POS y Productos cargan sin spinner perceptible tras Fase 1 (cache caliente).
- [ ] Reportes con día normal (<100 ventas) responde <1 s.
- [ ] Bundle inicial dentro de budgets configurados.

---

## Comandos clave

```bash
corepack pnpm dev          # http://localhost:4200
corepack pnpm typecheck    # tsc + ng build dev
corepack pnpm lint
corepack pnpm test
corepack pnpm build        # producción
corepack pnpm db:migrate   # aplica migrations a Supabase local
```

> En esta máquina `pnpm` se invoca vía `corepack pnpm` (no hay binario `pnpm` directo).

---

## Resultados (llenar al ejecutar)

### Fase 0 — Validación
- Antes: ___ requests Supabase por navegación / ___ ms FCP promedio.
- Después fix `AuthContext`: ___ / ___ .

### Fase 1 — Cache de datos
- Antes: ___ ms al entrar al POS la 2ª vez.
- Después: ___ ms.

### Fase 2 — OnPush + preloading
- Antes: chunk descargado al click en sidebar (___ ms).
- Después: ___ ms.

### Fase 3 — Índices
- `EXPLAIN ANALYZE` antes/después: ___.

### Fase 4 — Reportes (si aplica)
- ___ ventas en el día → ___ ms.

---

## Orden recomendado de ejecución

1. **Hoy mismo:** Fase 0 (validar) → si OK, parar y monitorear.
2. **Próxima sesión:** Fase 1 + Fase 2 (en un solo PR mental: ambas son cliente-only).
3. **Cuando se prepare deploy a Supabase real con datos:** Fase 3.
4. **Si Reportes se siente lento con datos reales:** Fase 4.
5. **Después del MVP estable:** Fase 5 (PWA) + Fase 6 (bundle audit).
