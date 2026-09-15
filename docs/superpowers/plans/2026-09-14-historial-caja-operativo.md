# Historial Operativo de Caja Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Crear una pantalla administrativa, filtrable y paginada para encontrar cierres de caja, identificar quién los cerró y revisar sus ventas y movimientos completos.

**Architecture:** La feature `cash-register` conserva Clean Architecture feature-first. PostgreSQL guarda un snapshot legible del responsable y expone una consulta RLS-safe de responsables; el repositorio aplica filtros y paginación en servidor. La nueva página `/caja/historial` coordina componentes de filtros, tabla y detalle bajo demanda, mientras `/caja` vuelve a enfocarse solo en el turno activo.

**Tech Stack:** Angular 21 standalone, TypeScript estricto, Reactive Forms + Zod, Tailwind CSS 4, Supabase PostgreSQL/Auth/RLS/RPC, Vitest, pgTAP y Playwright.

**Spec:** `docs/superpowers/specs/2026-09-14-historial-caja-operativo-design.md`

## Global Constraints

- Código en inglés; interfaz y documentación en español.
- Toda consulta incluye `tienda_id` y conserva RLS como defensa de datos.
- `closed_by_email` es evidencia visual, nunca una fuente de autorización.
- Las escrituras de cierre continúan exclusivamente por `close_cash_session_atomic`.
- Página, entrada de menú y ruta de historial son solo para `admin`.
- Fechas se filtran por `closed_at` usando la zona horaria IANA de la tienda y rangos UTC semiabiertos.
- Tabla paginada en servidor con 20 filas, orden `closed_at DESC, id DESC`.
- Componentes standalone, `ChangeDetectionStrategy.OnPush`, signal inputs/outputs y design system existente.
- No se añaden dependencias.

---

## Mapa de archivos

- `supabase/migrations/20260914000100_cash_history_responsibility.sql`: snapshot de correo, backfill, índices y función RLS-safe de responsables.
- `supabase/tests/cash-history-responsibility.test.sql`: invariantes, permisos y aislamiento por tienda.
- `supabase/snippets/seed-cash-history-volume.sql`: completa el snapshot en los 100 cierres locales.
- `src/infrastructure/supabase/database.types.ts`: tipos regenerados.
- `apps/pos-angular/src/app/features/cash-register/domain/entities/cash-session.entity.ts`: entidad y tipos paginados.
- `apps/pos-angular/src/app/features/cash-register/domain/repositories/cash-register.repository.ts`: contratos de consulta.
- `apps/pos-angular/src/app/features/cash-register/domain/services/cash-history.ts`: presets, rango, paginación y resumen de pagos puros.
- `apps/pos-angular/src/app/features/cash-register/data/models/cash-register.mapper.ts`: mapea `closed_by_email`.
- `apps/pos-angular/src/app/features/cash-register/data/models/cash-history-query.ts`: aplica filtros a un query builder testeable.
- `apps/pos-angular/src/app/features/cash-register/data/repositories/cash-register.repository.ts`: consulta paginada y responsables.
- `apps/pos-angular/src/app/features/cash-register/presentation/forms/cash-history-form.factory.ts`: Zod y defaults de filtros.
- `apps/pos-angular/src/app/features/cash-register/presentation/forms/cash-history-form.mapper.ts`: filtros a consulta de dominio.
- `apps/pos-angular/src/app/features/cash-register/presentation/presenters/cash-history-form.presenter.ts`: FormGroup y errores.
- `apps/pos-angular/src/app/features/cash-register/presentation/services/cash-history-request-state.ts`: evita respuestas fuera de orden.
- `apps/pos-angular/src/app/features/cash-register/presentation/components/cash-history-filters.component.ts`: barra de filtros.
- `apps/pos-angular/src/app/features/cash-register/presentation/components/cash-history-table.component.ts`: tabla responsive y paginación.
- `apps/pos-angular/src/app/features/cash-register/presentation/components/cash-session-detail.drawer.ts`: cierre, ventas y movimientos.
- `apps/pos-angular/src/app/features/cash-register/presentation/pages/cash-history.page.ts`: orquestación de la pantalla.
- `apps/pos-angular/src/app/features/cash-register/presentation/pages/caja.page.ts`: elimina lista embebida y añade acceso contextual.
- `apps/pos-angular/src/app/core/layout/shell.component.ts`: entrada administrativa de menú.
- `apps/pos-angular/src/app/app.routes.ts`: ruta protegida.
- `tests/e2e/caja-history.spec.ts`: navegación, filtros, paginación y detalle.
- `tests/e2e/cash-history-page.spec.ts`: comportamiento de la nueva pantalla y drawer.

---

### Task 1: Persistir y proteger el responsable legible del cierre

**Files:**
- Create via `pnpm exec supabase migration new cash_history_responsibility`, then normalize the filename: `supabase/migrations/20260914000100_cash_history_responsibility.sql`
- Create: `supabase/tests/cash-history-responsibility.test.sql`
- Modify: `supabase/snippets/seed-cash-history-volume.sql`
- Modify: `src/infrastructure/supabase/database.types.ts`

**Interfaces:**
- Consumes: `close_cash_session_atomic(uuid, uuid, uuid, numeric, numeric, jsonb, text)` y RLS de `cash_sessions`.
- Produces: `cash_sessions.closed_by_email text`, `list_cash_session_closers(uuid)` → filas `{ user_id uuid, email text }`.

- [ ] **Step 1: Crear la migración vacía con el CLI**

Run:

```bash
pnpm exec supabase migration new cash_history_responsibility
mv supabase/migrations/*_cash_history_responsibility.sql supabase/migrations/20260914000100_cash_history_responsibility.sql
```

Expected: existe exactamente `supabase/migrations/20260914000100_cash_history_responsibility.sql`.

- [ ] **Step 2: Escribir primero las pruebas pgTAP**

Crear fixtures de dos tiendas y dos usuarios siguiendo las transacciones aisladas del resto de `supabase/tests`. Probar como mínimo:

```sql
select plan(12);

select has_column('public', 'cash_sessions', 'closed_by_email');
select col_type_is('public', 'cash_sessions', 'closed_by_email', 'text');
select results_eq(
  $$ select closed_by_email from public.cash_sessions where id = '91000000-0000-0000-0000-000000000001' $$,
  $$ values ('closer@moveon.test'::text) $$,
  'el cierre guarda el correo autenticado'
);
select function_privs_are(
  'public',
  'list_cash_session_closers',
  array['uuid'],
  'authenticated',
  array['EXECUTE']
);
select function_privs_are(
  'public',
  'list_cash_session_closers',
  array['uuid'],
  'anon',
  array[]::text[]
);
select results_eq(
  $$ select email from public.list_cash_session_closers('00000000-0000-0000-0000-000000000001') $$,
  $$ values ('closer@moveon.test'::text) $$,
  'solo devuelve responsables de la tienda autorizada'
);
```

- [ ] **Step 3: Ejecutar la prueba y observar RED**

Run:

```bash
pnpm exec supabase test db --file supabase/tests/cash-history-responsibility.test.sql
```

Expected: FAIL porque `closed_by_email` y `list_cash_session_closers` todavía no existen.

- [ ] **Step 4: Implementar la migración mínima**

La migración debe contener estas operaciones exactas:

```sql
alter table public.cash_sessions
  add column closed_by_email text;

update public.cash_sessions cs
set closed_by_email = u.email
from auth.users u
where cs.closed_by = u.id
  and cs.closed_by_email is null;

create index cash_sessions_history_idx
  on public.cash_sessions (tienda_id, closed_at desc, id desc)
  where status = 'closed';

create index cash_sessions_closer_history_idx
  on public.cash_sessions (tienda_id, closed_by, closed_at desc)
  where status = 'closed';
```

En la nueva definición completa de `close_cash_session_atomic`, conservar todas las validaciones y cálculos vigentes y agregar:

```sql
declare
  v_closed_by_email text;
begin
  v_closed_by_email := nullif(auth.jwt() ->> 'email', '');
  if v_closed_by_email is null then
    select email into v_closed_by_email
    from auth.users
    where id = p_closed_by;
  end if;

  -- Dentro del UPDATE existente:
  -- closed_by_email = v_closed_by_email
end;
```

Crear la función invoker y sus grants explícitos:

```sql
create function public.list_cash_session_closers(p_tienda_id uuid)
returns table(user_id uuid, email text)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select distinct cs.closed_by, cs.closed_by_email
  from public.cash_sessions cs
  where cs.tienda_id = p_tienda_id
    and cs.status = 'closed'
    and cs.closed_by is not null
    and cs.closed_by_email is not null
  order by cs.closed_by_email, cs.closed_by;
$$;

revoke execute on function public.list_cash_session_closers(uuid) from public, anon;
grant execute on function public.list_cash_session_closers(uuid) to authenticated;
```

- [ ] **Step 5: Adaptar el seed de volumen**

Añadir `closed_by_email` al `INSERT`, al `SELECT` y al `ON CONFLICT DO UPDATE`:

```sql
'admin@moveon.local' as closed_by_email
```

- [ ] **Step 6: Reiniciar/verificar esquema y regenerar tipos**

Run:

```bash
pnpm exec supabase migration up --local
pnpm exec supabase test db --file supabase/tests/cash-history-responsibility.test.sql
pnpm exec supabase gen types typescript --local > src/infrastructure/supabase/database.types.ts
```

Expected: pgTAP PASS; `database.types.ts` contiene `closed_by_email` y `list_cash_session_closers`.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations supabase/tests/cash-history-responsibility.test.sql supabase/snippets/seed-cash-history-volume.sql src/infrastructure/supabase/database.types.ts
git commit -m "feat(cash): persist closure responsibility"
```

---

### Task 2: Definir contratos y lógica pura del historial

**Files:**
- Modify: `apps/pos-angular/src/app/features/cash-register/domain/entities/cash-session.entity.ts`
- Modify: `apps/pos-angular/src/app/features/cash-register/domain/repositories/cash-register.repository.ts`
- Create: `apps/pos-angular/src/app/features/cash-register/domain/services/cash-history.ts`
- Create: `apps/pos-angular/src/app/features/cash-register/domain/services/cash-history.test.ts`

**Interfaces:**
- Consumes: `getStoreRangeUtc(fromIso, toIso, timezone)` de reports.
- Produces: `CashHistoryPreset`, `CashBalanceStatus`, `CashHistoryQuery`, `CashHistoryPage`, `CashCloser`, `resolveCashHistoryPreset()`, `getClosedPaymentSummary()`.

- [ ] **Step 1: Escribir las pruebas unitarias RED**

```typescript
expect(resolveCashHistoryPreset('2026-09-14', 'today')).toEqual({ from: '2026-09-14', to: '2026-09-14' })
expect(resolveCashHistoryPreset('2026-09-14', 'yesterday')).toEqual({ from: '2026-09-13', to: '2026-09-13' })
expect(resolveCashHistoryPreset('2026-09-14', 'week')).toEqual({ from: '2026-09-08', to: '2026-09-14' })
expect(resolveCashHistoryPreset('2026-09-14', 'month')).toEqual({ from: '2026-08-16', to: '2026-09-14' })

expect(getClosedPaymentSummary({
  expected: [
    { metodo: 'cash', count: 7, total: 350000 },
    { metodo: 'transfer', count: 3, total: 180000 },
  ],
})).toEqual({
  cash: { count: 7, total: 350000 },
  transfer: { count: 3, total: 180000 },
})

expect(getClosedPaymentSummary(null)).toEqual({
  cash: { count: 0, total: 0 },
  transfer: { count: 0, total: 0 },
})
```

- [ ] **Step 2: Ejecutar RED**

Run:

```bash
pnpm exec vitest run apps/pos-angular/src/app/features/cash-register/domain/services/cash-history.test.ts
```

Expected: FAIL porque el servicio y los tipos no existen.

- [ ] **Step 3: Implementar contratos y helpers mínimos**

```typescript
export type CashHistoryPreset = 'today' | 'yesterday' | 'week' | 'month' | 'custom'
export type CashBalanceStatus = 'all' | 'balanced' | 'difference'

export interface CashHistoryQuery {
  tiendaId: string
  start: Date
  endExclusive: Date
  closedBy: string | null
  balanceStatus: CashBalanceStatus
  page: number
  pageSize: 20
}

export interface CashHistoryPage {
  items: CashSession[]
  total: number
  page: number
  pageSize: number
}

export interface CashCloser {
  userId: string
  email: string
}
```

Añadir `closedByEmail: string | null` a `CashSession` y estos métodos al contrato:

```typescript
abstract listClosedSessionsPage(query: CashHistoryQuery): Promise<CashHistoryPage>
abstract listCashClosers(tiendaId: string): Promise<CashCloser[]>
```

`resolveCashHistoryPreset` debe restar 0, 1, 6 o 29 días calendario con aritmética UTC sobre `YYYY-MM-DD`. `getClosedPaymentSummary` debe aceptar `unknown`, ignorar estructuras inválidas y devolver siempre ambos métodos primarios.

- [ ] **Step 4: Ejecutar GREEN y suite de Caja**

```bash
pnpm exec vitest run apps/pos-angular/src/app/features/cash-register/domain/services/cash-history.test.ts tests/unit/features/cash-register
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/pos-angular/src/app/features/cash-register/domain
git commit -m "feat(cash): define history query contracts"
```

---

### Task 3: Implementar mapeo y consulta paginada en Supabase

**Files:**
- Modify: `apps/pos-angular/src/app/features/cash-register/data/models/cash-register.mapper.ts`
- Create: `apps/pos-angular/src/app/features/cash-register/data/models/cash-history-query.ts`
- Modify: `apps/pos-angular/src/app/features/cash-register/data/repositories/cash-register.repository.ts`
- Modify: `tests/unit/features/cash-register/cash-register-mapper.test.ts`
- Create: `tests/unit/features/cash-register/cash-history-page.test.ts`

**Interfaces:**
- Consumes: `CashHistoryQuery`, `CashHistoryPage`, `CashCloser` de Task 2.
- Produces: implementación de `listClosedSessionsPage()` y `listCashClosers()`.

- [ ] **Step 1: Escribir pruebas RED del mapper y límites de página**

```typescript
expect(rowToCashSession({ ...closedRow, closed_by_email: 'cierre@moveon.co' }).closedByEmail)
  .toBe('cierre@moveon.co')
expect(rowToCashSession({ ...closedRow, closed_by_email: null }).closedByEmail).toBeNull()

expect(getCashHistoryRange(1, 20)).toEqual({ from: 0, to: 19 })
expect(getCashHistoryRange(3, 20)).toEqual({ from: 40, to: 59 })

const query = new RecordingQuery()
applyCashHistoryFilters(query, {
  closedBy: 'closer-1',
  balanceStatus: 'difference',
})
expect(query.calls).toEqual([
  ['eq', 'closed_by', 'closer-1'],
  ['or', 'difference.neq.0,sales_difference.neq.0'],
])
```

El fake del test registra cada operación sin simular Supabase:

```typescript
class RecordingQuery {
  readonly calls: unknown[][] = []
  eq(column: string, value: unknown): this {
    this.calls.push(['eq', column, value])
    return this
  }
  or(expression: string): this {
    this.calls.push(['or', expression])
    return this
  }
}
```

- [ ] **Step 2: Ejecutar RED**

```bash
pnpm exec vitest run tests/unit/features/cash-register/cash-register-mapper.test.ts tests/unit/features/cash-register/cash-history-page.test.ts
```

Expected: FAIL por propiedad/helper ausentes.

- [ ] **Step 3: Implementar el mapper y rango**

Extender `SESSION_COLS` y `CashSessionRow` con `closed_by_email`. Crear helper puro:

```typescript
export function getCashHistoryRange(page: number, pageSize: number): { from: number; to: number } {
  const from = (page - 1) * pageSize
  return { from, to: from + pageSize - 1 }
}
```

El helper de filtros usa una interfaz mínima y devuelve el mismo builder encadenable:

```typescript
interface CashHistoryFilterQuery<T> {
  eq(column: string, value: unknown): T
  or(expression: string): T
}

export function applyCashHistoryFilters<T extends CashHistoryFilterQuery<T>>(
  query: T,
  filters: Pick<CashHistoryQuery, 'closedBy' | 'balanceStatus'>,
): T
```

- [ ] **Step 4: Implementar consultas Supabase**

La consulta base debe ser:

```typescript
let query = this.supabaseClient.supabase
  .from('cash_sessions')
  .select(SESSION_COLS, { count: 'exact' })
  .eq('tienda_id', input.tiendaId)
  .eq('status', 'closed')
  .gte('closed_at', input.start.toISOString())
  .lt('closed_at', input.endExclusive.toISOString())
  .order('closed_at', { ascending: false })
  .order('id', { ascending: false })

if (input.closedBy) query = query.eq('closed_by', input.closedBy)
if (input.balanceStatus === 'balanced') {
  query = query.eq('difference', 0).eq('sales_difference', 0)
}
if (input.balanceStatus === 'difference') {
  query = query.or('difference.neq.0,sales_difference.neq.0')
}

const { from, to } = getCashHistoryRange(input.page, input.pageSize)
const { data, error, count } = await query.range(from, to).returns<CashSessionRow[]>()
```

`listCashClosers` invoca `list_cash_session_closers` con `p_tienda_id` y mapea `user_id`/`email`.
La implementación debe pasar el query base por `applyCashHistoryFilters`; así la prueba anterior
cubre que los filtros opcionales usados por el repositorio son exactamente los requeridos.

- [ ] **Step 5: Ejecutar pruebas, typecheck y commit**

```bash
pnpm exec vitest run tests/unit/features/cash-register/cash-register-mapper.test.ts tests/unit/features/cash-register/cash-history-page.test.ts
CI=1 pnpm typecheck
git add apps/pos-angular/src/app/features/cash-register/data tests/unit/features/cash-register
git commit -m "feat(cash): query paginated closure history"
```

Expected: pruebas y typecheck PASS.

---

### Task 4: Crear formulario de filtros y control de concurrencia

**Files:**
- Create: `apps/pos-angular/src/app/features/cash-register/presentation/forms/cash-history-form.factory.ts`
- Create: `apps/pos-angular/src/app/features/cash-register/presentation/forms/cash-history-form.mapper.ts`
- Create: `apps/pos-angular/src/app/features/cash-register/presentation/presenters/cash-history-form.presenter.ts`
- Create: `apps/pos-angular/src/app/features/cash-register/presentation/services/cash-history-request-state.ts`
- Create: `tests/unit/features/cash-register/cash-history-form.test.ts`
- Create: `tests/unit/features/cash-register/cash-history-request-state.test.ts`

**Interfaces:**
- Consumes: `CashHistoryPreset`, `CashBalanceStatus`, `CashHistoryQuery` y `getStoreRangeUtc()`.
- Produces: `CashHistoryFormValue`, `CashHistoryFormPresenter`, `toCashHistoryQuery()`, `LatestRequest`.

- [ ] **Step 1: Escribir pruebas RED de validación y mapeo**

```typescript
expect(cashHistoryFormSchema.safeParse({
  preset: 'custom', from: '2026-09-15', to: '2026-09-14', closedBy: '', balanceStatus: 'all',
}).success).toBe(false)

const query = toCashHistoryQuery(
  { preset: 'custom', from: '2026-09-13', to: '2026-09-14', closedBy: '', balanceStatus: 'difference' },
  { tiendaId: 'store-1', timezone: 'America/Bogota', page: 2 },
)
expect(query.start.toISOString()).toBe('2026-09-13T05:00:00.000Z')
expect(query.endExclusive.toISOString()).toBe('2026-09-15T05:00:00.000Z')
expect(query.closedBy).toBeNull()
expect(query.pageSize).toBe(20)
```

- [ ] **Step 2: Escribir prueba RED de respuestas fuera de orden**

```typescript
const latest = new LatestRequest()
const first = latest.begin()
const second = latest.begin()
expect(latest.isCurrent(first)).toBe(false)
expect(latest.isCurrent(second)).toBe(true)
```

- [ ] **Step 3: Ejecutar RED**

```bash
pnpm exec vitest run tests/unit/features/cash-register/cash-history-form.test.ts tests/unit/features/cash-register/cash-history-request-state.test.ts
```

Expected: FAIL por archivos ausentes.

- [ ] **Step 4: Implementar factory, mapper, presenter y token**

El schema y defaults deben ser:

```typescript
export const cashHistoryFormSchema = z.object({
  preset: z.enum(['today', 'yesterday', 'week', 'month', 'custom']),
  from: z.string().date(),
  to: z.string().date(),
  closedBy: z.string(),
  balanceStatus: z.enum(['all', 'balanced', 'difference']),
}).refine((value) => value.from <= value.to, {
  path: ['to'],
  message: 'La fecha final debe ser igual o posterior a la inicial',
})
```

`CashHistoryFormPresenter` usa `NonNullableFormBuilder`, `validate()` con Zod y `reset()` a últimos 7 días. `LatestRequest.begin()` incrementa un contador privado y `isCurrent(token)` compara contra el último contador.

- [ ] **Step 5: Ejecutar GREEN y commit**

```bash
pnpm exec vitest run tests/unit/features/cash-register/cash-history-form.test.ts tests/unit/features/cash-register/cash-history-request-state.test.ts
git add apps/pos-angular/src/app/features/cash-register/presentation/forms apps/pos-angular/src/app/features/cash-register/presentation/presenters apps/pos-angular/src/app/features/cash-register/presentation/services tests/unit/features/cash-register
git commit -m "feat(cash): add history filter model"
```

---

### Task 5: Construir filtros, tabla paginada y página

**Files:**
- Create: `apps/pos-angular/src/app/features/cash-register/presentation/components/cash-history-filters.component.ts`
- Create: `apps/pos-angular/src/app/features/cash-register/presentation/components/cash-history-table.component.ts`
- Create: `apps/pos-angular/src/app/features/cash-register/presentation/pages/cash-history.page.ts`
- Create: `tests/e2e/cash-history-page.spec.ts`

**Interfaces:**
- Consumes: presenter y mapper de Task 4; repositorio de Task 3; `CashHistoryPage`/`CashCloser`.
- Produces: `CashHistoryPageComponent`, eventos `filtersChanged`, `pageChanged`, `sessionSelected`.

- [ ] **Step 1: Escribir y ejecutar un E2E RED de la pantalla**

```typescript
await page.goto('/caja/historial')
await expect(page.getByRole('heading', { name: 'Historial de caja' })).toBeVisible()
await expect(page.getByLabel('Desde')).toBeVisible()
await expect(page.getByLabel('Hasta')).toBeVisible()
await expect(page.getByLabel('Responsable')).toBeVisible()
await expect(page.getByLabel('Estado del cuadre')).toBeVisible()
await expect(page.getByText(/20 de 102 turnos/)).toBeVisible()
```

Run:

```bash
E2E_BASE_URL=http://127.0.0.1:4201 E2E_BROWSER_CHANNEL=chrome E2E_EMAIL=admin@moveon.local E2E_PASSWORD='Test1234!' pnpm exec playwright test tests/e2e/cash-history-page.spec.ts --project=chromium --reporter=line
```

Expected: FAIL porque la página todavía no existe.

- [ ] **Step 2: Crear la barra de filtros como componente standalone**

Usar `ReactiveFormsModule`, `mo-form-select`, inputs date nativos con `mo-field-wrapper`, presets como botones y eventos tipados:

```typescript
readonly presenter = input.required<CashHistoryFormPresenter>()
readonly closers = input.required<CashCloser[]>()
readonly applied = output<void>()
readonly cleared = output<void>()
```

Cada control debe tener label visible. `Aplicar filtros` valida antes de emitir y `Limpiar` llama `presenter.reset()`.

- [ ] **Step 3: Crear tabla responsive y paginación**

```typescript
readonly page = input.required<CashHistoryPage>()
readonly selected = output<CashSession>()
readonly pageChanged = output<number>()

readonly totalPages = computed(() => Math.max(1, Math.ceil(this.page().total / this.page().pageSize)))
```

En escritorio usar `mo-table-shell`/`MO_TABLE`; en móvil, tarjetas compactas. Mostrar `Con diferencia` mediante badge además del color. Botones anterior/siguiente quedan deshabilitados en límites.
Cada fila obtiene conteos y valores de efectivo/transferencia mediante `getClosedPaymentSummary(session.paymentClosure)`; no vuelve a consultar ventas para construir la tabla.

- [ ] **Step 4: Crear la página orquestadora**

La página inyecta únicamente abstracciones de dominio y servicios de contexto:

```typescript
private readonly repo = inject(CashRegisterRepository)
private readonly session = inject(SessionService)
private readonly tiendaInfo = inject(TiendaInfoService)
readonly presenter = inject(CashHistoryFormPresenter)

readonly result = signal<CashHistoryPage>({ items: [], total: 0, page: 1, pageSize: 20 })
readonly loading = signal(true)
readonly loadError = signal<string | null>(null)
readonly selectedSession = signal<CashSession | null>(null)
```

`load(page)` obtiene contexto/tienda, valida filtros, crea un token `LatestRequest`, consulta página y solo actualiza signals si el token sigue vigente. Aplicar o limpiar filtros llama `load(1)`; paginar llama `load(targetPage)`.

- [ ] **Step 5: Ejecutar GREEN, compilación y accesibilidad estática**

```bash
E2E_BASE_URL=http://127.0.0.1:4201 E2E_BROWSER_CHANNEL=chrome E2E_EMAIL=admin@moveon.local E2E_PASSWORD='Test1234!' pnpm exec playwright test tests/e2e/cash-history-page.spec.ts --project=chromium --reporter=line
CI=1 pnpm typecheck
pnpm lint
```

Expected: PASS sin imports desde `data/` en presentación, sin labels faltantes y sin errores de template.

- [ ] **Step 6: Commit**

```bash
git add apps/pos-angular/src/app/features/cash-register/presentation tests/e2e/cash-history-page.spec.ts
git commit -m "feat(cash): build searchable history page"
```

---

### Task 6: Añadir detalle completo bajo demanda

**Files:**
- Create: `apps/pos-angular/src/app/features/cash-register/presentation/components/cash-session-detail.drawer.ts`
- Modify: `apps/pos-angular/src/app/features/cash-register/presentation/pages/cash-history.page.ts`
- Modify: `apps/pos-angular/src/app/shared/services/export/turn-sales-export.ts`
- Modify: `tests/unit/features/cash-register/turn-sales-export.test.ts`
- Modify: `tests/e2e/cash-history-page.spec.ts`

**Interfaces:**
- Consumes: `CashSession`, `CashMovement[]`, `Sale[]`, `SaleRepository.listBySession()`, `CashRegisterRepository.listMovements()` y exportador existente.
- Produces: drawer accesible con `closed`, `saleToggled` y `exportRequested`.

- [ ] **Step 1: Extender pruebas RED del Excel y drawer**

```typescript
const workbook = buildTurnSalesWorkbook(
  { ...closedSession, closedByEmail: 'responsable@moveon.co' },
  sales,
  movements,
)
const summary = workbook.sheets.find((sheet) => sheet.name === 'Resumen')
expect(summary?.rows).toEqual(expect.arrayContaining([
  ['Caja', 'Responsable del cierre', null, 'responsable@moveon.co'],
]))

await page.getByRole('row', { name: /admin@moveon\.local/ }).first().click()
await expect(page.getByRole('dialog', { name: /Detalle del turno/ })).toBeVisible()
await expect(page.getByText('Responsable del cierre')).toBeVisible()
```

- [ ] **Step 2: Ejecutar RED**

```bash
pnpm exec vitest run tests/unit/features/cash-register/turn-sales-export.test.ts
E2E_BASE_URL=http://127.0.0.1:4201 E2E_BROWSER_CHANNEL=chrome E2E_EMAIL=admin@moveon.local E2E_PASSWORD='Test1234!' pnpm exec playwright test tests/e2e/cash-history-page.spec.ts --project=chromium --reporter=line
```

Expected: FAIL porque el Excel todavía no muestra responsable y el drawer no existe.

- [ ] **Step 3: Implementar drawer y carga lazy**

El componente recibe estado, no consulta Supabase:

```typescript
readonly open = input(false)
readonly session = input<CashSession | null>(null)
readonly sales = input.required<Sale[]>()
readonly movements = input.required<CashMovement[]>()
readonly loading = input(false)
readonly error = input<string | null>(null)
readonly closed = output<void>()
readonly exportRequested = output<void>()
```

Debe renderizar `role="dialog"`, `aria-modal="true"`, overlay cerrable, botón con `aria-label="Cerrar detalle"`, Escape, foco visible y ancho `min(44rem, 100vw)` en escritorio / ancho completo en móvil. Reutilizar `mo-sale-detail-list`; mostrar estados vacíos explícitos para ventas y movimientos.

En `selectSession(session)`, la página abre el drawer, limpia detalle anterior y carga en paralelo:

```typescript
const [movements, sales] = await Promise.all([
  this.repo.listMovements(session.id),
  this.salesRepo.listBySession(session.id, auth.tiendaId),
])
```

Un token por selección evita que el detalle de una fila anterior reemplace el actual.

- [ ] **Step 4: Añadir responsable al Excel y verificar**

Usar `cashSession.closedByEmail ?? cashSession.closedBy?.slice(0, 8) ?? 'No disponible'`. Ejecutar:

```bash
pnpm exec vitest run tests/unit/features/cash-register/turn-sales-export.test.ts
E2E_BASE_URL=http://127.0.0.1:4201 E2E_BROWSER_CHANNEL=chrome E2E_EMAIL=admin@moveon.local E2E_PASSWORD='Test1234!' pnpm exec playwright test tests/e2e/cash-history-page.spec.ts --project=chromium --reporter=line
CI=1 pnpm typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/pos-angular/src/app/features/cash-register/presentation/components/cash-session-detail.drawer.ts apps/pos-angular/src/app/features/cash-register/presentation/pages/cash-history.page.ts apps/pos-angular/src/app/shared/services/export/turn-sales-export.ts tests/unit/features/cash-register/turn-sales-export.test.ts tests/e2e/cash-history-page.spec.ts
git commit -m "feat(cash): show closure sales and movements"
```

---

### Task 7: Integrar navegación y retirar el historial embebido

**Files:**
- Modify: `apps/pos-angular/src/app/app.routes.ts`
- Modify: `apps/pos-angular/src/app/core/layout/shell.component.ts`
- Modify: `apps/pos-angular/src/app/features/cash-register/presentation/pages/caja.page.ts`
- Delete: `apps/pos-angular/src/app/features/cash-register/presentation/components/closed-sessions-list.component.ts`
- Modify: `tests/e2e/caja-history.spec.ts`

**Interfaces:**
- Consumes: `CashHistoryPageComponent` de Task 5 y `roleGuard('admin')`.
- Produces: navegación `/caja/historial` desde menú y encabezado; `/caja` sin lista extensa.

- [ ] **Step 1: Escribir/ajustar E2E RED de navegación**

```typescript
await page.goto('/caja')
await expect(page.getByRole('heading', { name: 'Turnos anteriores' })).toHaveCount(0)
await page.getByRole('link', { name: 'Historial de cajas' }).click()
await expect(page).toHaveURL(/\/caja\/historial$/)
await expect(page.getByRole('heading', { name: 'Historial de caja' })).toBeVisible()
```

- [ ] **Step 2: Ejecutar RED**

```bash
E2E_BASE_URL=http://127.0.0.1:4201 E2E_BROWSER_CHANNEL=chrome E2E_EMAIL=admin@moveon.local E2E_PASSWORD='Test1234!' pnpm exec playwright test tests/e2e/caja-history.spec.ts --project=chromium --reporter=line
```

Expected: FAIL porque `/caja` todavía contiene la lista y no existe la ruta nueva.

- [ ] **Step 3: Registrar ruta y menú con permisos**

Añadir antes de la ruta `caja`:

```typescript
{
  path: 'caja/historial',
  canActivate: [roleGuard('admin')],
  loadComponent: () =>
    import('@angular-app/features/cash-register/presentation/pages/cash-history.page')
      .then((m) => m.CashHistoryPageComponent),
},
```

Añadir al menú:

```typescript
{ label: 'Historial de caja', short: 'Hist', href: '/caja/historial', adminOnly: true },
```

En `CajaPage`, eliminar import/render de `ClosedSessionsListComponent`, eliminar `canViewHistory` y añadir un `mo-button`/`routerLink="/caja/historial"` visible para admin con texto `Historial de cajas`.

- [ ] **Step 4: Ejecutar GREEN y comprobar guard de cajero**

```bash
E2E_BASE_URL=http://127.0.0.1:4201 E2E_BROWSER_CHANNEL=chrome E2E_EMAIL=admin@moveon.local E2E_PASSWORD='Test1234!' pnpm exec playwright test tests/e2e/caja-history.spec.ts --project=chromium --reporter=line
CI=1 pnpm typecheck
pnpm lint
```

Expected: E2E, typecheck y lint PASS. Añadir al E2E un caso con credenciales de cajero cuando `E2E_CASHIER_EMAIL`/`E2E_CASHIER_PASSWORD` estén definidos; debe redirigir a `/pos` y no mostrar el menú.

- [ ] **Step 5: Commit**

```bash
git add apps/pos-angular/src/app/app.routes.ts apps/pos-angular/src/app/core/layout/shell.component.ts apps/pos-angular/src/app/features/cash-register/presentation tests/e2e/caja-history.spec.ts
git commit -m "feat(cash): route admins to closure history"
```

---

### Task 8: Verificar filtros, paginación, detalle y documentación

**Files:**
- Modify: `tests/e2e/caja-history.spec.ts`
- Modify: `docs/modules/cash-register.md`
- Modify: `docs/sessions/2026-09-14-rediseno-historial-caja.md`

**Interfaces:**
- Consumes: todas las entregas anteriores y seed de 100 cierres.
- Produces: historia E2E completa y documentación final.

- [ ] **Step 1: Extender E2E con los comportamientos de aceptación**

```typescript
await page.goto('/caja/historial')
await expect(page.getByText(/20 de 102 turnos/)).toBeVisible()
await page.getByRole('button', { name: 'Siguiente' }).click()
await expect(page.getByText('Página 2')).toBeVisible()

await page.getByRole('button', { name: 'Hoy' }).click()
await page.getByRole('button', { name: 'Aplicar filtros' }).click()
await expect(page.getByText(/turnos encontrados/)).toBeVisible()

await page.getByRole('row', { name: /admin@moveon\.local/ }).first().click()
await expect(page.getByRole('dialog', { name: /Detalle del turno/ })).toBeVisible()
await expect(page.getByText('Responsable del cierre')).toBeVisible()
await expect(page.getByText(/admin@moveon\.local/)).toBeVisible()
```

Para el fixture con venta relacionada, comprobar que aparecen el número de venta, producto, forma de pago y total. Para cierres sintéticos, comprobar `Sin ventas registradas en este turno`.

- [ ] **Step 2: Ejecutar E2E y corregir solo defectos observados**

```bash
E2E_BASE_URL=http://127.0.0.1:4201 E2E_BROWSER_CHANNEL=chrome E2E_EMAIL=admin@moveon.local E2E_PASSWORD='Test1234!' pnpm exec playwright test tests/e2e/caja-history.spec.ts --project=chromium --reporter=line
```

Expected: todos los casos PASS con los 100 registros del seed.

- [ ] **Step 3: Actualizar documentación**

En `docs/modules/cash-register.md`, reemplazar RN-C15 con la ruta independiente, filtros, paginación, detalle y responsabilidad. En el spec de sesión registrar archivos, decisiones, comandos y resultados reales.

- [ ] **Step 4: Ejecutar verificación final completa**

```bash
CI=1 pnpm typecheck
CI=1 pnpm lint
CI=1 pnpm test
pnpm exec supabase test db --file supabase/tests/cash-history-responsibility.test.sql
git diff --check
```

Expected: todos con exit code 0; ninguna prueba fallida.

- [ ] **Step 5: Revisión visual manual**

En 1440×900 y 390×844 confirmar:

- `/caja` no muestra la lista histórica.
- Filtros tienen labels y foco visible.
- La tabla no crea scroll horizontal en móvil; usa tarjetas.
- El drawer ocupa lateral en escritorio y ancho completo en móvil.
- Diferencias se entienden por texto/badge además del color.
- Cerrar con Escape y botón funciona.
- Volver del detalle conserva filtros y página.

- [ ] **Step 6: Commit de cierre**

```bash
git add tests/e2e/caja-history.spec.ts docs/modules/cash-register.md docs/sessions/2026-09-14-rediseno-historial-caja.md
git commit -m "test(cash): verify searchable closure history"
```
