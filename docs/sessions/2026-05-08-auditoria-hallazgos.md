# Auditoría Arquitectónica — 2026-05-08

> Reporte completo y priorizado. Origen: petición del dueño de producto para
> auditar todo el proyecto, foco en Supabase y testing.
> Sesión asociada: `2026-05-08-auditoria-arquitectura.md`.

---

## TL;DR

**Estado general: SANO con deuda técnica focalizada.**

- **Build/Lint/Tests:** verde. 117 tests pasan, lint limpio, typecheck OK.
- **Arquitectura:** Clean Architecture aplicada de forma razonable; existen incongruencias entre estándar (`02-architecture.md`) y código real que conviene cerrar.
- **Supabase:** RLS activo en todo lo operativo, RPCs atómicas para venta y anulación, índices Fase 3 aplicados. Hay 7 hallazgos del Database Linter (3 seguridad WARN, 1 seguridad WARN auth, 10 FK sin índice INFO, 3 RLS subóptimos WARN). Ninguno bloquea producción pero sí merecen cierre antes del go-live.
- **Testing:** unitarios sólidos en dominio. **Cero tests de integración**, **cero tests Angular de componentes**, **cero tests SQL/RPC**. Es el gap más grande de cara al MVP.
- **CI:** workflow `.github/workflows/ci.yml` está **roto / desactualizado** (variables Next.js que ya no existen).
- **Observability:** Sentry y `audit_logs` operativos parciales; no hay alertas ni `pg_cron` aún.

Severidad usada: 🔴 alta (bloqueante para producción) · 🟠 media (cerrar antes del MVP v1.0) · 🟢 baja / mejora futura.

---

## 1. Resultados de validación local

| Comando | Resultado |
|---|---|
| `corepack pnpm typecheck` | ✅ Pasó (`tsc --noEmit` + `ng build dev`, ~2.3 s) |
| `corepack pnpm lint` | ✅ Pasó (`All files pass linting`) |
| `corepack pnpm test` | ✅ 16 archivos · 117 tests · 0 fallos |
| `corepack pnpm test:e2e` | ⚠️ No ejecutado en esta sesión (Playwright requiere dev server) |
| `corepack pnpm build` | ✅ Bundle generado (último build conocido OK) |

> **Cobertura no se midió.** El script `test:coverage` existe pero no hay umbrales declarados ni reporte en CI.

---

## 2. Hallazgos por área

### 2.1 Seguridad de Supabase

#### 🔴 S1 — Funciones `SECURITY DEFINER` ejecutables por `anon`
**Detalle:** `get_user_tiendas()` y `void_sale_atomic(...)` son `SECURITY DEFINER` y `anon` tiene `EXECUTE`. Internamente `void_sale_atomic` valida `auth.uid()` y rechaza, pero la superficie expuesta no debería existir.

**Ubicación:**
- `supabase/migrations/20240101000000_initial_schema.sql:102-106` (`get_user_tiendas`).
- `supabase/migrations/20260427_002_harden_sales_cash_logic.sql:174-250` (`void_sale_atomic`).

**Acción:**
```sql
revoke execute on function public.get_user_tiendas() from anon, public;
revoke execute on function public.void_sale_atomic(uuid, uuid, uuid, text) from anon, public;
grant   execute on function public.get_user_tiendas() to authenticated;
grant   execute on function public.void_sale_atomic(uuid, uuid, uuid, text) to authenticated;
```

Aplicar en una migración `20260508_001_revoke_definer_anon.sql` y volver a correr `get_advisors`.

#### 🟠 S2 — `function_search_path_mutable` en 3 funciones
**Detalle:** `update_updated_at`, `get_user_tiendas`, `get_stock` no fijan `search_path`. Riesgo: schema-injection si el rol llamador define un schema con tipos del mismo nombre. (`create_sale_atomic` y `void_sale_atomic` sí lo tienen — bien.)

**Acción:** misma migración, recrear las 3 funciones con `set search_path = public, pg_temp` (o `''`).

#### 🟠 S3 — RLS activado pero policies con rol `{public}`
**Detalle:** Todas las policies se crearon sin `TO authenticated`, por lo que aplican a `public` (incluye `anon`). Funcionalmente las queries fallan para `anon` porque `auth.uid()` es `null` y no hay coincidencias, pero la práctica recomendada es restringir.

**Acción:** en futura migración, recrear policies con `to authenticated`. No bloquea el MVP pero suma defensa en profundidad.

#### 🟠 S4 — Leaked-Password Protection deshabilitado
**Detalle:** Auth no está cruzando contraseñas con HaveIBeenPwned.

**Acción:** activar en Supabase Dashboard → Authentication → Password security → Enable leaked password protection. Recomendación adicional: subir `min_password_length` a 12.

#### 🟢 S5 — Sin MFA / 2FA para `admin`
Sólo email/password (alineado con MVP). Cuando el dueño esté listo, activar TOTP de Supabase Auth para el rol admin.

#### 🟠 S6 — Tablas operativas sin `tienda_id` directo
**Detalle:** `payments`, `sale_items`, `cash_movements`, `billing_events` usan RLS por subquery a su padre. CLAUDE.md §2.2 dice "Toda tabla operativa lleva `tienda_id` desde el día uno". Hay desviación.

**Trade-off:** denormalizar `tienda_id` mejora performance de RLS y de queries cross-tienda futuras, a costa de coherencia (debe replicarse desde `sales`/`cash_sessions`/`billing_documents`). Hoy con volumen bajo no duele.

**Acción:** decidir vía ADR. Recomendación: agregar `tienda_id` en una migración nueva con `default` calculado desde la FK y trigger de propagación. Si se descarta, actualizar CLAUDE.md y `02-architecture.md` para que la doc no mienta.

---

### 2.2 Performance de Supabase

#### 🟠 P1 — `auth_rls_initplan` en 3 policies
**Detalle:** `tiendas.tenant_select`, `user_tiendas.own_rows_select`, `audit_logs.tenant_select` usan `auth.uid()` directo en vez de `(select auth.uid())`. Postgres re-evalúa por fila.

**Acción:** recrear con `(select auth.uid())`. Mismo PR/migración que S1–S3.

```sql
-- ejemplo
drop policy "own_rows_select" on user_tiendas;
create policy "own_rows_select" on user_tiendas
  for select to authenticated
  using (user_id = (select auth.uid()));
```

#### 🟠 P2 — 10 FKs sin índice
`audit_logs.user_id`, `cash_movements.created_by`, `cash_sessions.closed_by`, `inventory_movements.created_by`, `inventory_movements.producto_id`, `productos.categoria_id`, `sales.billing_document_id`, `sales.cashier_id`, `sales.voided_by`, `user_tiendas.tienda_id`.

Con datos reales algunos serán hot path (`inventory_movements.producto_id` para kardex; `sales.cashier_id` para reportes por cajero). Otros son cold (`voided_by`, `closed_by`).

**Acción:** una migración `20260508_002_perf_indexes_fks.sql` con índices `if not exists` para los hot, y dejar comentados los cold con justificación. Volver a correr el advisor a las 24 h y revisar `unused_index`.

#### 🟢 P3 — Índices marcados como nunca usados
Son los que el advisor ya señala. La mayoría es ruido (DB con datos de demo). No tocar hasta tener tráfico real.

#### 🟢 P4 — `closeSession` no es atómico
**Detalle:** `cash-register.repository.ts:207-275` ejecuta varias queries secuenciales (movimientos, breakdown, update) sin transacción. Aunque `unique index ux_one_open_session_per_user` evita doble cierre, el cálculo de `expected_*` puede leer ventas en vuelo.

**Acción:** mover a un RPC `close_cash_session_atomic(p_session_id, ...)` análogo al de `create_sale_atomic`. Ganancia: atomicidad y una sola roundtrip. Esfuerzo: ~1 h.

#### 🟢 P5 — `pg_advisory_xact_lock(hashtextextended(producto_id))` en `create_sale_atomic`
Hash colisiones (~1 en 2^64) — riesgo despreciable. Documentar en el SQL como _decisión consciente_ y no aplicar lock por fila completa, que sería más caro.

---

### 2.3 Testing

#### 🔴 T1 — CI roto
**Detalle:** `.github/workflows/ci.yml` define `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` en el step `Build`. Esos vars desaparecieron con la migración a Angular (sesión `2026-05-02-cleanup-next-vercel`). El job pasa porque el build Angular usa `scripts/generate-runtime-config.mjs` con valores por defecto, pero la intención no se cumple y un futuro PR puede romper sin que CI lo note.

**Acción:** reemplazar las vars por las que consume `generate-runtime-config.mjs`:
```yaml
env:
  SUPABASE_URL: ${{ secrets.SUPABASE_URL || 'https://placeholder.supabase.co' }}
  SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY || 'placeholder' }}
```
Y validar que `corepack pnpm` esté disponible en el runner.

#### 🔴 T2 — Cero tests de integración
**Detalle:** `tests/integration/.gitkeep` y `tests/e2e/.gitkeep` están vacíos. El criterio de cierre del MVP (`01-mvp-scope.md` §"Criterios de cierre") dice **explícitamente**: "Existen tests de integración para los flujos: crear venta, cerrar caja, ajustar inventario." No están.

**Acción:** crear `tests/integration/` con suite que llame a Supabase local (`supabase start`) y ejecute:
- `create_sale_atomic` + verificación de stock descontado.
- `void_sale_atomic` + verificación de reposición.
- Cierre de caja con `closeSession()` (cuando sea RPC).

Stack sugerido: Vitest con un cliente Supabase configurado a `http://127.0.0.1:54321`. Esfuerzo: ~3 h.

#### 🟠 T3 — Cero tests Angular
**Detalle:** la doc declara "Tests Angular pendientes de setup" hace ~2 semanas. Ningún componente, presenter o servicio Angular tiene tests. El form presenter es lógica testable sin DOM.

**Acción:** instalar `@analogjs/vitest-angular` (mantenida, recomendada en docs). Empezar por presenters (`*-form.presenter.ts`) y `ProductsCacheStore`. Esfuerzo: ~2 h setup + 30 min por presenter.

#### 🟠 T4 — Cero tests SQL/RPC
**Detalle:** `pgtap` está disponible como extensión pero no se usa. Las RPCs críticas (`create_sale_atomic`, `void_sale_atomic`, `get_stock`) no tienen prueba en su lenguaje nativo.

**Acción:** instalar pgTAP y agregar `supabase/tests/sale.test.sql` con casos: idempotencia, falla de pagos < total, stock insuficiente, prepared no descuenta.

#### 🟠 T5 — Cobertura sin umbral en CI
`vitest.config.ts` no define `coverage.thresholds`. `pnpm test:coverage` corre, pero nadie falla.

**Acción:** agregar umbral mínimo (dominio 80 %, use-cases 70 %, según `02-architecture.md §8.2`) y `--coverage` en CI.

#### 🟢 T6 — `tests/unit/` no cubre repositorios Angular
Esperable hasta T3 (no se pueden testear sin Angular DI). Una vez exista vitest-angular se cubren naturalmente.

---

### 2.4 Arquitectura y código

#### 🟠 A1 — Tipos Supabase desactualizados
**Síntoma:** repositorios casean a `as unknown as UntypedClient` (productos, inventario, cash-register, ventas). Eso es _siempre_ una señal de que `database.types.ts` no refleja la realidad para `insert/update`.

**Acción:** `pnpm db:types` cuando estén las migraciones de hoy. Si los tipos generados siguen sin satisfacer `update(values)`, definir helpers `Insert<T>`/`Update<T>` en `src/infrastructure/supabase/` y eliminar los casts uno a uno.

#### 🟠 A2 — Repositorios `throw` para errores de negocio
`02-architecture.md §2.3` exige `Result<T, E>` para errores de dominio y `throw` solo para fallos técnicos. Hoy todo es `throw new Error(...)` (ej. `cash-register.repository.ts:248` "Diferencias mayores a $5.000 requieren nota de cierre" — error de negocio puro).

**Acción:** introducir `Result` en presenters y use-cases (`src/modules/.../application/use-cases/`). El repositorio puede seguir lanzando `RepositoryError`; el use-case lo convierte a `Result.error('insufficient_difference_note')`. Aplicar gradualmente, empezando por flujos ya cubiertos por tests.

#### 🟠 A3 — Interfaces de repositorio en `domain` no implementadas
`src/modules/products/domain/repositories/product.repository.ts` define una interfaz que `apps/.../products.repository.ts` **no** implementa formalmente. Funciona porque el shape coincide, pero el contrato no se hace cumplir.

**Acción:** `implements ProductRepository` en cada clase Angular. Si la interfaz ya no refleja la realidad, redefinirla en el dominio antes de implementar.

#### 🟠 A4 — Capa de infraestructura mezclada
`02-architecture.md` define `apps/.../<feature>/infrastructure/<feature>.repository.ts`. La realidad: vive en `apps/.../<feature>/<feature>.repository.ts` (sin subcarpeta `infrastructure/`). Funciona, pero la doc miente.

**Acción:** elegir uno y unificar. Recomendación: dejar como está (evita over-engineering para 1 archivo por módulo) y actualizar `02-architecture.md`.

#### 🟢 A5 — `pos-data.service.ts` y `products-cache.store.ts` cubren overlap
`PosDataService.listProducts` y `listCategories` solo proxean al `ProductsCacheStore`. Es una capa de adaptación útil (mapea al type del POS), pero podría simplificarse a un `computed` del store.

**Acción:** opcional. No tocar hasta que duela.

#### 🟢 A6 — `audit_logs` solo se escribe desde `void_sale_atomic`
Mutaciones de productos, precios, costos, sesiones de caja no quedan auditadas. CLAUDE.md y la doc de billing v1.1 mencionan compliance.

**Acción:** triggers genéricos `tg_audit_*` que escriban `audit_logs` en `productos UPDATE` (precio/costo), `cash_sessions UPDATE` (cierre) y `inventory_movements INSERT` (con tipo `adjustment`). Esfuerzo: ~1 h.

#### 🟢 A7 — Sesión Supabase en `localStorage` en POS compartido
El `SupabaseClient` usa `persistSession: true`. Si un cajero olvida cerrar sesión, otra persona accede. CLAUDE.md menciona "1 operador, 1 sede".

**Acción:** valorar `persistSession: false` + auto-logout por inactividad (30 min). No bloquea MVP.

---

### 2.5 Validación / Zod

#### 🟠 V1 — Sin `zodSchema.parse(...)` antes de invocar Supabase
Los presenters validan el form, pero los repositorios no re-validan los DTOs antes del `insert/update/rpc`. Defensa en profundidad falta.

**Acción:** en cada repo, antes de armar el payload del RPC/insert, `dto.parse(input)` (o `dtoSchema.safeParse`). Útil sobre todo en `pos-sale.service.ts:38-77` donde el RPC tiene 12 parámetros.

---

### 2.6 CI/CD y Despliegue

#### 🔴 C1 — `ci.yml` con vars Next inexistentes
Ver T1.

#### 🟠 C2 — Sin gate de tests de integración / e2e en CI
Cuando T2 quede listo, debe correr en CI con `supabase start`. Plantilla disponible en docs Supabase.

#### 🟠 C3 — Sin deploy automático
El cleanup dejó `Hosting frontend: TBD`. Decidir target (Cloudflare Pages parece encajar mejor por costo + edge cache + Workers para futuro). Decisión vía ADR.

#### 🟢 C4 — Sin Supabase Branches en PRs
Plan free de Supabase incluye `branches`. Cada PR podría correr migraciones en una rama efímera. No urgente.

---

### 2.7 Observabilidad e infraestructura

#### 🟠 O1 — Sentry no integrado
`02-architecture.md §10` lo lista. No hay `@sentry/angular` instalado.

**Acción:** instalar Sentry, capturar errores no controlados desde `main.ts:6` (hoy `console.error`) y los `throw` de los presenters. Esfuerzo: ~1 h.

#### 🟠 O2 — Sin Logflare / Logs centralizados
Hoy los logs viven en Supabase Dashboard. Suficiente en MVP. Cuando exista hosting frontend, agregar logs estructurados de cliente (`logRocket`, `Sentry breadcrumbs` o `Better Stack`).

#### 🟢 O3 — `pg_cron` y `pgmq` instalables
Disponibles en la lista de extensiones. Útiles para v1.1 (sync billing) y para retry queue. Documentar en `04-roadmap.md`.

#### 🟢 O4 — `pgaudit` no habilitado
Para auditar a nivel DB (DDL, role grants). Activar cuando entren múltiples desarrolladores o para compliance fiscal.

#### 🟢 O5 — Vault disponible y sin uso
`supabase_vault 0.3.1` instalado. Cuando lleguen llaves de Factus / billing v1.1, guardarlas en Vault y no en Edge Function env.

---

### 2.8 MVP scope vs realidad

| Módulo MVP | Estado real |
|---|---|
| M1 Auth + roles | ✅ Login + roles en `user_tiendas`. Falta: recuperación de contraseña UI. |
| M2 Catálogo | ✅ CRUD + tipo + búsqueda. |
| M3 Inventario | ✅ Movimientos, kardex, ajustes, stock_min. Falta: alerta visual unificada. |
| M4 POS | ✅ Carrito, búsqueda, pagos mixtos. **Falta: descuentos manuales con permiso por rol** (M4 lo exige y no se vio en `pos.page.ts`). |
| M5 Pagos | ✅ 5 métodos + mixtos + cambio. |
| M6 Caja | 🟠 Apertura/movimientos/cierre OK. **Cierre no es atómico (P4)**. |
| M7 Tickets internos | ⚠️ No revisado en este audit; verificar CSS 80 mm. |
| M8 Reportes básicos | ✅ Diario + stock. Detalle por cajero falta. |
| M9 Migración Siigo | ❌ Importador CSV no implementado. |
| M10 Multi-sede en datos | ✅ `tienda_id` en tablas con dueño directo (con desviación S6). |

---

## 3. Plan de acción recomendado

### Sprint corto — "preparar el go-live" (1–2 semanas)

1. **🔴 Fix CI** (T1) — 30 min.
2. **🔴 Migración seguridad** (S1, S2) — 1 h.
3. **🟠 Tests de integración mínimos** (T2): create_sale + void_sale + close_session — 3 h.
4. **🟠 RLS auth_rls_initplan** (P1) y políticas `to authenticated` (S3) — 1 h.
5. **🟠 Cerrar caja con RPC atómico** (P4) — 1 h.
6. **🟠 Sentry + leaked-password protection** (S4, O1) — 1 h.
7. **🟠 Descuentos con permiso por rol en POS** (gap M4) — 2 h.
8. **🟠 Importador CSV Siigo** (M9) — 4 h.

Total ~14 h para cerrar el gap real frente a `01-mvp-scope.md` §"Criterios de cierre".

### Sprint medio — "hardening" (2–4 semanas)

9. Tests Angular con vitest-angular (T3).
10. Tests pgTAP de RPCs (T4).
11. Cobertura con umbral en CI (T5).
12. Tipos Supabase regenerados + cleanup `as unknown as` (A1).
13. `Result<T, E>` en presenters/use-cases (A2).
14. Audit logs por triggers (A6).
15. Decidir hosting + ADR (C3).

### Backlog post-MVP

- Vault para credenciales billing v1.1 (O5).
- Supabase Branches en PRs (C4).
- pg_cron + pgmq para queue billing (O3).
- pgaudit (O4).
- PWA / Service Worker (Fase 5 del plan perf existente).
- MFA admin (S5).

---

## 4. Tabla resumen priorizada

| ID | Severidad | Tema | Esfuerzo |
|---|---|---|---|
| T1 | 🔴 | CI con vars Next inexistentes | 30 min |
| S1 | 🔴 | `SECURITY DEFINER` ejecutable por anon | 30 min |
| T2 | 🔴 | Sin tests de integración (gap MVP) | 3 h |
| S2 | 🟠 | `function_search_path_mutable` | 15 min |
| S3 | 🟠 | Policies con rol public | 30 min |
| S4 | 🟠 | Leaked-password protection | 5 min |
| S6 | 🟠 | Tablas sin `tienda_id` directo | 2 h o ADR |
| P1 | 🟠 | `auth_rls_initplan` | 30 min |
| P2 | 🟠 | FKs sin índice (los hot) | 30 min |
| P4 | 🟠 | Cierre de caja no atómico | 1 h |
| T3 | 🟠 | Sin tests Angular | 2 h setup |
| T4 | 🟠 | Sin tests pgTAP | 1 h por RPC |
| T5 | 🟠 | Sin umbral cobertura | 15 min |
| A1 | 🟠 | Tipos Supabase + casts | 1–2 h |
| A2 | 🟠 | Errores de negocio con `throw` | 2 h |
| A3 | 🟠 | Interfaces domain sin `implements` | 30 min |
| A4 | 🟠 | Doc vs realidad infraestructura | 15 min |
| C1 | 🔴 | (= T1) | — |
| C3 | 🟠 | Sin deploy decidido | ADR |
| O1 | 🟠 | Sentry no integrado | 1 h |
| V1 | 🟠 | Zod en bordes faltante | 1 h |
| Otros 🟢 | 🟢 | Mejoras post-MVP | ver §3 |

---

## 5. Apéndice — qué se verificó

- 8 migraciones SQL leídas íntegras.
- `get_advisors` security + performance corridos.
- `list_tables`, `list_extensions`, `list_edge_functions`, `list_migrations`.
- 3 queries SQL: funciones definer, grants, policies.
- Repositorios Angular: products, sales, inventory, cash-register.
- Servicios POS, reports, session, supabase-client, app-config.
- App config + routing + preloading.
- ProductsCacheStore + TtlCache.
- Estándares de forms y arquitectura.
- CI workflow `.github/workflows/ci.yml`.
- `package.json`, `angular.json`, `vitest.config.ts`.

Lo que **no** se verificó (y debería en un sprint de QA):
- Estilos del ticket 80 mm (M7).
- Flujo end-to-end en navegador real.
- Edge cases en pagos mixtos con cambio.
- Recuperación de contraseña.
