# Cierre de caja con retiro opcional Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar el cuadre de ventas y efectivo por turno, registrar de forma atómica un retiro opcional al cierre y sugerir el efectivo restante como base del siguiente turno.

**Architecture:** Extender `cash_sessions` y `close_cash_session_atomic` para que el conteo anterior al retiro, el retiro de cierre y el efectivo dejado se persistan en una única transacción. Propagar esos datos por las capas domain/data/presentation de `cash-register`, manteniendo los retiros durante el turno como `cash_out` y usando formularios Zod con presenter Angular.

**Tech Stack:** Angular 21 standalone, TypeScript estricto, Angular Reactive Forms, Zod, Tailwind CSS 4, Supabase PostgreSQL/RLS/RPC, Vitest y pgTAP.

**Spec:** `docs/superpowers/specs/2026-09-13-cierre-caja-retiro-opcional-design.md`

## Global Constraints

- La caja sigue siendo compartida por tienda según ADR 0007; cualquier miembro activo puede cerrar.
- Todos los montos se representan como números no negativos en centavos enteros en TypeScript y `numeric(14,2)` en PostgreSQL.
- `actual_cash_amount` es el efectivo contado antes del retiro de cierre.
- `closing_withdrawal_amount = actual_cash_amount - cash_left_amount` y no se duplica en `cash_movements`.
- Un retiro durante el turno continúa siendo un movimiento `cash_out` activo.
- `difference = expected_cash_amount - actual_cash_amount`; el retiro de cierre no cambia esta diferencia.
- Si no se activa el retiro, `cash_left_amount = actual_cash_amount` y `closing_withdrawal_amount = 0`.
- El efectivo dejado solo se sugiere en la apertura siguiente; el usuario puede editarlo.
- No agregar dependencias ni acceder a Supabase desde componentes Angular.
- Antes de implementar, leer los skills `supabase`, `supabase-postgres-best-practices`, `test-driven-development` y `frontend-design`.
- Preservar todos los cambios no relacionados que ya existen en el worktree.

---

## File map

**Create**

- `supabase/migrations/20260913000100_cash_closing_withdrawal.sql`: columnas, restricciones y nueva firma del RPC atómico.
- `supabase/tests/cash-closing-withdrawal.test.sql`: pruebas de cierre sin retiro, parcial, inválido, permisos y auditoría.
- `apps/pos-angular/src/app/features/cash-register/presentation/forms/close-session-form.factory.ts`: estado y validación Zod del formulario.
- `apps/pos-angular/src/app/features/cash-register/presentation/forms/close-session-form.mapper.ts`: traducción del formulario al input del caso de uso.
- `apps/pos-angular/src/app/features/cash-register/presentation/presenters/close-session-form.presenter.ts`: FormGroup tipado y errores de presentación.
- `tests/unit/features/cash-register/cash-register-mapper.test.ts`: mapeo de las columnas nuevas.
- `tests/unit/features/cash-register/close-session-form.test.ts`: defaults, validación y payload de cierre.
- `tests/unit/features/cash-register/turn-sales-export.test.ts`: resumen exportado del turno.

**Modify**

- `src/infrastructure/supabase/database.types.ts`: tipos generados de tabla y RPC.
- `apps/pos-angular/src/app/features/cash-register/domain/entities/cash-session.entity.ts`: retiro y efectivo dejado.
- `apps/pos-angular/src/app/features/cash-register/domain/dtos/cash-register.dto.ts`: validación cruzada del cierre.
- `apps/pos-angular/src/app/features/cash-register/domain/services/cash-closure.ts`: cálculo puro del retiro y desglose esperado.
- `apps/pos-angular/src/app/features/cash-register/domain/services/cash-closure.test.ts`: pruebas de cálculo.
- `apps/pos-angular/src/app/features/cash-register/domain/repositories/cash-register.repository.ts`: inputs y lectura de base sugerida.
- `apps/pos-angular/src/app/features/cash-register/domain/usecases/close-session.use-case.ts`: envío de `cashLeftAmount`.
- `apps/pos-angular/src/app/features/cash-register/data/models/cash-register.mapper.ts`: columnas nuevas.
- `apps/pos-angular/src/app/features/cash-register/data/repositories/cash-register.repository.ts`: select, RPC y consulta del último cierre.
- `tests/unit/features/cash-register/cash-register-dto.test.ts`: invariantes del cierre.
- `tests/unit/features/cash-register/cash-register-write-use-cases.test.ts`: contrato con el repositorio.
- `apps/pos-angular/src/app/features/cash-register/presentation/dialogs/close-session.dialog.ts`: retiro opcional y confirmación en vivo.
- `apps/pos-angular/src/app/features/cash-register/presentation/dialogs/add-movement.dialog.ts`: tipo inicial configurable.
- `apps/pos-angular/src/app/features/cash-register/presentation/pages/caja.page.ts`: resumen, retiro directo y apertura sugerida.
- `apps/pos-angular/src/app/features/cash-register/presentation/components/closed-sessions-list.component.ts`: valores del cierre histórico.
- `apps/pos-angular/src/app/shared/services/export/turn-sales-export.ts`: sesión y cuadre en el Excel.
- `apps/pos-angular/src/app/features/pos/presentation/dialogs/sales-history.dialog.ts`: adaptar llamada al exportador.
- `docs/modules/cash-register.md`: reglas RN-C17 y RN-C18.
- `docs/sessions/2026-09-13-caja-resumen-turno-efectivo.md`: resultado y verificación.

---

### Task 1: Persistencia y cierre atómico

**Files:**

- Create: `supabase/migrations/20260913000100_cash_closing_withdrawal.sql`
- Create: `supabase/tests/cash-closing-withdrawal.test.sql`
- Modify: `src/infrastructure/supabase/database.types.ts`

**Interfaces:**

- Consumes: firma vigente `close_cash_session_atomic(uuid, uuid, uuid, numeric, jsonb, text)`.
- Produces: `close_cash_session_atomic(uuid, uuid, uuid, numeric, numeric, jsonb, text)`, columnas `closing_withdrawal_amount` y `cash_left_amount`.

- [ ] **Step 1: Escribir las pruebas pgTAP que fallen**

Crear fixtures aislados de tienda, admin, cajero, sesión, venta y pagos siguiendo `supabase/tests/cash-session-shared.test.sql`. Probar explícitamente:

```sql
select plan(13);

-- Cierre sin retiro: contado 150000, dejado 150000.
select is(closing_withdrawal_amount, 0::numeric, 'sin retiro guarda cero');
select is(cash_left_amount, 150000::numeric, 'sin retiro deja todo lo contado');
select is(difference, expected_cash_amount - 150000::numeric, 'diferencia usa conteo previo');

-- Cierre parcial: contado 480000, dejado 150000.
select is(closing_withdrawal_amount, 330000::numeric, 'calcula retiro parcial');
select is(cash_left_amount, 150000::numeric, 'guarda base restante');
select is(difference, expected_cash_amount - 480000::numeric, 'retiro no altera diferencia');

-- Invariantes y atomicidad.
select throws_ok($$ select public.close_cash_session_atomic(
  '22222222-2222-4222-8222-222222222222',
  '11111111-1111-4111-8111-111111111111',
  '33333333-3333-4333-8333-333333333333',
  100000, 100001, '[]'::jsonb, null
) $$,
  'El efectivo dejado no puede superar el efectivo contado');
select throws_ok($$ select public.close_cash_session_atomic(
  '22222222-2222-4222-8222-222222222222',
  '11111111-1111-4111-8111-111111111111',
  '33333333-3333-4333-8333-333333333333',
  100000, -1, '[]'::jsonb, null
) $$,
  'El efectivo dejado no puede ser negativo');
select throws_ok($$ select public.close_cash_session_atomic(
  '44444444-4444-4444-8444-444444444444',
  '11111111-1111-4111-8111-111111111111',
  '33333333-3333-4333-8333-333333333333',
  100000, 100000, '[]'::jsonb, null
) $$,
  'La caja ya esta cerrada');

-- Verificar que los errores anteriores mantienen status='open' y columnas nulas.
-- Verificar cierre por cajero activo, rechazo de usuario externo y metadata de audit_logs.
select * from finish();
```

Los UUID de las llamadas deben corresponder a los fixtures creados al inicio del archivo.

- [ ] **Step 2: Ejecutar las pruebas para confirmar el fallo**

Run: `supabase test db supabase/tests/cash-closing-withdrawal.test.sql`

Expected: FAIL porque las columnas y el parámetro `p_cash_left` todavía no existen.

- [ ] **Step 3: Crear la migración**

Agregar columnas y checks:

```sql
alter table public.cash_sessions
  add column closing_withdrawal_amount numeric(14,2),
  add column cash_left_amount numeric(14,2);

update public.cash_sessions
set closing_withdrawal_amount = 0,
    cash_left_amount = actual_cash_amount
where status = 'closed' and actual_cash_amount is not null;

alter table public.cash_sessions
  add constraint cash_sessions_closing_withdrawal_nonnegative
    check (closing_withdrawal_amount is null or closing_withdrawal_amount >= 0),
  add constraint cash_sessions_cash_left_nonnegative
    check (cash_left_amount is null or cash_left_amount >= 0),
  add constraint cash_sessions_close_cash_consistency
    check (
      status <> 'closed'
      or actual_cash_amount is null
      or (
        closing_withdrawal_amount is not null
        and cash_left_amount is not null
        and cash_left_amount <= actual_cash_amount
        and closing_withdrawal_amount = actual_cash_amount - cash_left_amount
      )
    );
```

Recrear el RPC con `p_cash_left numeric` inmediatamente después de `p_actual_cash numeric`. Mantener todo el cuerpo vigente de `20260619205532_void_cash_movement.sql` y añadir antes de calcular diferencias:

```sql
if p_actual_cash < 0 then
  raise exception 'El efectivo contado no puede ser negativo';
end if;

if p_cash_left < 0 then
  raise exception 'El efectivo dejado no puede ser negativo';
end if;

if p_cash_left > p_actual_cash then
  raise exception 'El efectivo dejado no puede superar el efectivo contado';
end if;
```

En el `update cash_sessions` añadir:

```sql
closing_withdrawal_amount = p_actual_cash - p_cash_left,
cash_left_amount          = p_cash_left,
```

En `audit_logs.metadata` añadir:

```sql
'actual_cash_amount', p_actual_cash,
'closing_withdrawal_amount', p_actual_cash - p_cash_left,
'cash_left_amount', p_cash_left,
```

Revocar la firma anterior para evitar dos overloads y otorgar solo la nueva:

```sql
drop function if exists public.close_cash_session_atomic(uuid, uuid, uuid, numeric, jsonb, text);
revoke execute on function public.close_cash_session_atomic(uuid, uuid, uuid, numeric, numeric, jsonb, text)
  from public, anon;
grant execute on function public.close_cash_session_atomic(uuid, uuid, uuid, numeric, numeric, jsonb, text)
  to authenticated;
```

- [ ] **Step 4: Regenerar tipos y revisar la firma**

Run: `pnpm db:types`

Confirmar en `database.types.ts`:

```ts
closing_withdrawal_amount: number | null
cash_left_amount: number | null
// RPC Args
p_actual_cash: number
p_cash_left: number
```

- [ ] **Step 5: Ejecutar pruebas de base de datos**

Run: `supabase db reset`

Run: `supabase test db supabase/tests/cash-closing-withdrawal.test.sql`

Expected: 13 pruebas PASS y cero errores de migración.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260913000100_cash_closing_withdrawal.sql supabase/tests/cash-closing-withdrawal.test.sql src/infrastructure/supabase/database.types.ts
git commit -m "feat(cash): persist optional closing withdrawal"
```

---

### Task 2: Reglas de dominio y caso de uso de cierre

**Files:**

- Modify: `apps/pos-angular/src/app/features/cash-register/domain/entities/cash-session.entity.ts`
- Modify: `apps/pos-angular/src/app/features/cash-register/domain/dtos/cash-register.dto.ts`
- Modify: `apps/pos-angular/src/app/features/cash-register/domain/services/cash-closure.ts`
- Modify: `apps/pos-angular/src/app/features/cash-register/domain/services/cash-closure.test.ts`
- Modify: `apps/pos-angular/src/app/features/cash-register/domain/repositories/cash-register.repository.ts`
- Modify: `apps/pos-angular/src/app/features/cash-register/domain/usecases/close-session.use-case.ts`
- Modify: `tests/unit/features/cash-register/cash-register-dto.test.ts`
- Modify: `tests/unit/features/cash-register/cash-register-write-use-cases.test.ts`

**Interfaces:**

- Consumes: columnas y parámetro `p_cash_left` de Task 1.
- Produces: `CashSession.closingWithdrawalAmount`, `CashSession.cashLeftAmount`, `CloseSessionInput.cashLeftAmount`, `computeClosingWithdrawal(actualCashAmount, cashLeftAmount)`.

- [ ] **Step 1: Escribir pruebas de reglas puras y DTO**

Agregar a `cash-closure.test.ts`:

```ts
expect(computeClosingWithdrawal(480_000, 150_000)).toBe(330_000)
expect(computeClosingWithdrawal(150_000, 150_000)).toBe(0)
```

Agregar a `cash-register-dto.test.ts`:

```ts
expect(closeSessionSchema.safeParse({
  actualCashAmount: 480_000,
  cashLeftAmount: 150_000,
}).success).toBe(true)

expect(closeSessionSchema.safeParse({
  actualCashAmount: 100_000,
  cashLeftAmount: 100_001,
}).success).toBe(false)
```

Actualizar el fixture `CashSession` de los tests con:

```ts
closingWithdrawalAmount: null,
cashLeftAmount: null,
```

- [ ] **Step 2: Ejecutar tests para verificar que fallen**

Run: `pnpm vitest run apps/pos-angular/src/app/features/cash-register/domain/services/cash-closure.test.ts tests/unit/features/cash-register/cash-register-dto.test.ts tests/unit/features/cash-register/cash-register-write-use-cases.test.ts`

Expected: FAIL por función/campos inexistentes.

- [ ] **Step 3: Implementar entidad, cálculo y validación**

Añadir a `CashSession`:

```ts
closingWithdrawalAmount: number | null
cashLeftAmount: number | null
```

Añadir al servicio:

```ts
export function computeClosingWithdrawal(actualCashAmount: number, cashLeftAmount: number): number {
  return actualCashAmount - cashLeftAmount
}
```

Ampliar el schema con validación cruzada:

```ts
export const closeSessionSchema = z.object({
  actualCashAmount: z.number().nonnegative('El conteo de efectivo no puede ser negativo'),
  cashLeftAmount: z.number().nonnegative('El efectivo dejado no puede ser negativo'),
  actualCardAmount: z.number().nonnegative().default(0),
  actualTransferAmount: z.number().nonnegative().default(0),
  actualOtherAmount: z.number().nonnegative().default(0),
  notasCierre: z.string().max(500).optional(),
}).refine((value) => value.cashLeftAmount <= value.actualCashAmount, {
  path: ['cashLeftAmount'],
  message: 'El efectivo dejado no puede superar el efectivo contado',
})
```

Añadir `cashLeftAmount: number` a `CloseSessionInput` y pasarlo sin recalcular desde el use-case.

- [ ] **Step 4: Probar el contrato exacto del caso de uso**

Actualizar la expectativa de `cash-register-write-use-cases.test.ts`:

```ts
expect(received).toEqual({
  sessionId,
  tiendaId,
  closedBy: 'user-1',
  actualCashAmount: 480_000,
  cashLeftAmount: 150_000,
  actualPayments: [
    { metodo: 'card', total: 0 },
    { metodo: 'transfer', total: 15_000 },
    { metodo: 'other', total: 0 },
  ],
  notasCierre: 'Todo cuadrado',
})
```

Añadir un test que confirme que `cashLeftAmount > actualCashAmount` no llama al repositorio.

- [ ] **Step 5: Ejecutar tests de dominio**

Run: `pnpm vitest run apps/pos-angular/src/app/features/cash-register/domain/services/cash-closure.test.ts tests/unit/features/cash-register/cash-register-dto.test.ts tests/unit/features/cash-register/cash-register-write-use-cases.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/pos-angular/src/app/features/cash-register/domain tests/unit/features/cash-register/cash-register-dto.test.ts tests/unit/features/cash-register/cash-register-write-use-cases.test.ts
git commit -m "feat(cash): model closing cash remainder"
```

---

### Task 3: Repositorio, mapper y base sugerida

**Files:**

- Modify: `apps/pos-angular/src/app/features/cash-register/data/models/cash-register.mapper.ts`
- Modify: `apps/pos-angular/src/app/features/cash-register/data/repositories/cash-register.repository.ts`
- Modify: `apps/pos-angular/src/app/features/cash-register/domain/repositories/cash-register.repository.ts`
- Create: `tests/unit/features/cash-register/cash-register-mapper.test.ts`

**Interfaces:**

- Consumes: `CashSession` y `CloseSessionInput` de Task 2.
- Produces: `CashRegisterRepository.getSuggestedOpeningAmount(tiendaId): Promise<number | null>` y RPC con `p_cash_left`.

- [ ] **Step 1: Escribir el test fallido del mapper**

Crear una fila completa y comprobar:

```ts
const result = rowToCashSession({
  // campos actuales completos
  closing_withdrawal_amount: 330_000,
  cash_left_amount: 150_000,
})

expect(result.closingWithdrawalAmount).toBe(330_000)
expect(result.cashLeftAmount).toBe(150_000)
```

Añadir un segundo caso con ambos valores `null` para sesiones abiertas/legacy.

- [ ] **Step 2: Ejecutar el test y confirmar fallo**

Run: `pnpm vitest run tests/unit/features/cash-register/cash-register-mapper.test.ts`

Expected: FAIL porque `CashSessionRow` aún no conoce las columnas.

- [ ] **Step 3: Ampliar mapper y selects**

Añadir al row y al mapper:

```ts
closing_withdrawal_amount: number | null
cash_left_amount: number | null

closingWithdrawalAmount:
  row.closing_withdrawal_amount !== null ? Number(row.closing_withdrawal_amount) : null,
cashLeftAmount: row.cash_left_amount !== null ? Number(row.cash_left_amount) : null,
```

Agregar ambas columnas a `SESSION_COLS`.

- [ ] **Step 4: Conectar el RPC y la consulta de base sugerida**

En `closeSession` pasar:

```ts
p_actual_cash: input.actualCashAmount,
p_cash_left: input.cashLeftAmount,
```

Añadir al contrato e implementación:

```ts
abstract getSuggestedOpeningAmount(tiendaId: string): Promise<number | null>
```

Implementar consultando únicamente el último cierre válido:

```ts
const { data, error } = await this.supabaseClient.supabase
  .from('cash_sessions')
  .select('cash_left_amount')
  .eq('tienda_id', tiendaId)
  .eq('status', 'closed')
  .not('cash_left_amount', 'is', null)
  .order('closed_at', { ascending: false })
  .limit(1)
  .maybeSingle()
if (error) throw new Error(error.message)
return data?.cash_left_amount === null || data?.cash_left_amount === undefined
  ? null
  : Number(data.cash_left_amount)
```

Ampliar el audit log del repositorio con `cashLeftAmount` y
`closingWithdrawalAmount: input.actualCashAmount - input.cashLeftAmount`.

- [ ] **Step 5: Ejecutar tests y typecheck focalizado**

Run: `pnpm vitest run tests/unit/features/cash-register/cash-register-mapper.test.ts tests/unit/features/cash-register/cash-register-write-use-cases.test.ts`

Run: `pnpm typecheck`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/pos-angular/src/app/features/cash-register/data apps/pos-angular/src/app/features/cash-register/domain/repositories/cash-register.repository.ts tests/unit/features/cash-register/cash-register-mapper.test.ts
git commit -m "feat(cash): map withdrawal and suggest next opening"
```

---

### Task 4: Formulario y diálogo de cierre

**Files:**

- Create: `apps/pos-angular/src/app/features/cash-register/presentation/forms/close-session-form.factory.ts`
- Create: `apps/pos-angular/src/app/features/cash-register/presentation/forms/close-session-form.mapper.ts`
- Create: `apps/pos-angular/src/app/features/cash-register/presentation/presenters/close-session-form.presenter.ts`
- Create: `tests/unit/features/cash-register/close-session-form.test.ts`
- Modify: `apps/pos-angular/src/app/features/cash-register/presentation/dialogs/close-session.dialog.ts`

**Interfaces:**

- Consumes: `closeSessionSchema`, `computeClosingWithdrawal` y `closeCashSession` de Task 2.
- Produces: formulario `{ actualCashAmount, actualTransferAmount, withdrawAtClose, cashLeftAmount, notasCierre }` y payload válido de cierre.

- [ ] **Step 1: Escribir tests fallidos de factory y mapper**

```ts
expect(createCloseSessionDefaults()).toEqual({
  actualCashAmount: 0,
  actualTransferAmount: 0,
  withdrawAtClose: false,
  cashLeftAmount: 0,
  notasCierre: '',
})

expect(closeSessionFormMapper.toPayload({
  actualCashAmount: 480_000,
  actualTransferAmount: 70_000,
  withdrawAtClose: false,
  cashLeftAmount: 150_000,
  notasCierre: '',
})).toEqual({
  actualCashAmount: 480_000,
  cashLeftAmount: 480_000,
  actualTransferAmount: 70_000,
  notasCierre: undefined,
})

expect(closeSessionFormMapper.toPayload({
  actualCashAmount: 480_000,
  actualTransferAmount: 70_000,
  withdrawAtClose: true,
  cashLeftAmount: 150_000,
  notasCierre: '  Retiro de cierre  ',
}).cashLeftAmount).toBe(150_000)
```

- [ ] **Step 2: Ejecutar test y confirmar fallo**

Run: `pnpm vitest run tests/unit/features/cash-register/close-session-form.test.ts`

Expected: FAIL por módulos inexistentes.

- [ ] **Step 3: Implementar factory, mapper y presenter**

Definir el schema de formulario con Zod y refinamiento condicional:

```ts
export const closeSessionFormSchema = z.object({
  actualCashAmount: z.number().nonnegative('El conteo de efectivo no puede ser negativo'),
  actualTransferAmount: z.number().nonnegative('El total de transferencias no puede ser negativo'),
  withdrawAtClose: z.boolean(),
  cashLeftAmount: z.number().nonnegative('El efectivo dejado no puede ser negativo'),
  notasCierre: z.string().max(500),
}).refine(
  (value) => !value.withdrawAtClose || value.cashLeftAmount <= value.actualCashAmount,
  { path: ['cashLeftAmount'], message: 'El efectivo dejado no puede superar el efectivo contado' },
)
```

El mapper debe imponer `cashLeftAmount = actualCashAmount` cuando `withdrawAtClose` sea falso. El
presenter seguirá el patrón de `EntryCostCorrectionFormPresenter`: `NonNullableFormBuilder`, signal
de errores, `reset`, `validate` y `setRootError`.

- [ ] **Step 4: Reestructurar el diálogo**

Proveer `CloseSessionFormPresenter` a nivel de componente e importar `FormCheckboxComponent`.
Sustituir el FormGroup local por el presenter. Al abrir:

```ts
this.presenter.reset({
  actualCashAmount: this.expectedCash(),
  actualTransferAmount: this.expectedMap().get('transfer')?.total ?? 0,
  withdrawAtClose: false,
  cashLeftAmount: Math.min(
    this.cashSession()?.openingAmount ?? 0,
    this.expectedCash(),
  ),
  notasCierre: '',
})
```

Renderizar después del conteo:

```html
<mo-form-checkbox
  controlName="withdrawAtClose"
  label="Retirar efectivo al cerrar"
  description="Opcional. Indica cuánto dinero quedará como base en el cajón."
/>
@if (withdrawAtClose()) {
  <mo-form-currency-input controlName="cashLeftAmount" label="Efectivo que dejarás en caja" />
  <p>Retiro calculado: {{ money(closingWithdrawal()) }}</p>
}
```

Calcular `closingWithdrawal` con `computeClosingWithdrawal` y presentar
`Math.max(0, computeClosingWithdrawal(actualCashAmount, cashLeftAmount))`; dejar la validación como
autoridad. En `submit`, usar el mapper y enviar su resultado
al use-case. Mantener la regla existente de nota por diferencias mayores a $5.000.

- [ ] **Step 5: Ejecutar pruebas y typecheck**

Run: `pnpm vitest run tests/unit/features/cash-register/close-session-form.test.ts tests/unit/features/cash-register/cash-register-dto.test.ts tests/unit/features/cash-register/cash-register-write-use-cases.test.ts`

Run: `pnpm typecheck`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/pos-angular/src/app/features/cash-register/presentation/forms apps/pos-angular/src/app/features/cash-register/presentation/presenters apps/pos-angular/src/app/features/cash-register/presentation/dialogs/close-session.dialog.ts tests/unit/features/cash-register/close-session-form.test.ts
git commit -m "feat(cash): add optional withdrawal to close dialog"
```

---

### Task 5: Cuadre visible, retiro directo y apertura sugerida

**Files:**

- Modify: `apps/pos-angular/src/app/features/cash-register/presentation/dialogs/add-movement.dialog.ts`
- Modify: `apps/pos-angular/src/app/features/cash-register/presentation/pages/caja.page.ts`

**Interfaces:**

- Consumes: `getSuggestedOpeningAmount` de Task 3 y `AddMovementDialog.initialType`.
- Produces: resumen operativo y acción directa de retiro durante el turno.

- [ ] **Step 1: Hacer configurable el tipo inicial del diálogo de movimiento**

Añadir:

```ts
readonly initialType = input<CashMovementType>('cash_in')
```

Y cambiar el reset a:

```ts
this.form.reset({ tipo: this.initialType(), amount: 0, motivo: '' })
```

- [ ] **Step 2: Separar los acumulados del cuadre en computeds**

En `CajaPage` definir:

```ts
readonly cashSales = computed(() => this.breakdown().find((p) => p.metodo === 'cash') ?? {
  metodo: 'cash', count: 0, total: 0,
})
readonly transferSales = computed(() => this.breakdown().find((p) => p.metodo === 'transfer') ?? {
  metodo: 'transfer', count: 0, total: 0,
})
readonly cashInputs = computed(() => sumActive('cash_in'))
readonly expenses = computed(() => sumActive('expense'))
readonly cashWithdrawals = computed(() => sumActive('cash_out'))
readonly corrections = computed(() => sumActive('correction'))
```

Mantener la semántica vigente de `correction` como resta al calcular el esperado, y usar una función
privada para sumar movimientos activos por tipo.

- [ ] **Step 3: Precargar la apertura sugerida**

Cuando `load()` no encuentre sesión abierta, consultar en paralelo seguro o de forma inmediata:

```ts
const suggested = await this.repo.getSuggestedOpeningAmount(auth.tiendaId)
this.openForm.controls.openingAmount.setValue(suggested ?? 0)
this.suggestedOpeningAmount.set(suggested)
```

Mostrar bajo el campo: `Sugerido desde el último cierre: $X`. No bloquear la edición.

- [ ] **Step 4: Implementar la tarjeta Cuadre del turno**

Reemplazar las tarjetas genéricas por un bloque que muestre:

```text
Ventas en efectivo       N pagos   $X
Transferencias           N pagos   $Y
Base inicial                       $A
Ingresos                           +$B
Gastos                             −$C
Retiros del turno                  −$D
Esperado en caja                   $E
```

Conservar “Total ventas” y las listas detalladas. Usar `tabular-nums`, etiquetas visibles y diseño
responsive de una columna en móvil y dos/tres en escritorio.

- [ ] **Step 5: Añadir acceso directo Retirar efectivo**

Mantener un signal `movementInitialType` y abrir así:

```ts
openMovement(tipo: CashMovementType = 'cash_in'): void {
  this.movementInitialType.set(tipo)
  this.movementOpen.set(true)
}
```

Conectar `+ Movimiento` a `openMovement()` y el botón `Retirar efectivo` a
`openMovement('cash_out')`. Pasar `[initialType]="movementInitialType()"` al diálogo.

- [ ] **Step 6: Verificación manual de la página**

Run: `pnpm dev`

Verificar en `/caja` a 375 px y 1280 px:

- no hay scroll horizontal;
- efectivo y transferencia muestran conteo y monto aunque sean cero;
- la suma visual coincide con “Esperado en caja”;
- “Retirar efectivo” abre `cash_out` seleccionado;
- una caja cerrada precarga, pero permite editar, la base anterior.

- [ ] **Step 7: Typecheck y commit**

Run: `pnpm typecheck`

```bash
git add apps/pos-angular/src/app/features/cash-register/presentation/dialogs/add-movement.dialog.ts apps/pos-angular/src/app/features/cash-register/presentation/pages/caja.page.ts
git commit -m "feat(cash): surface live shift reconciliation"
```

---

### Task 6: Historial y exportación del turno

**Files:**

- Modify: `apps/pos-angular/src/app/features/cash-register/presentation/components/closed-sessions-list.component.ts`
- Modify: `apps/pos-angular/src/app/shared/services/export/turn-sales-export.ts`
- Modify: `apps/pos-angular/src/app/features/cash-register/presentation/pages/caja.page.ts`
- Modify: `apps/pos-angular/src/app/features/pos/presentation/dialogs/sales-history.dialog.ts`
- Create: `tests/unit/features/cash-register/turn-sales-export.test.ts`

**Interfaces:**

- Consumes: `CashSession` con valores de cierre y ventas/movimientos existentes.
- Produces: `buildTurnSalesWorkbook(session, sales, cashMovements)` y descarga de sesiones cerradas.

- [ ] **Step 1: Escribir el test fallido del Excel**

Construir una sesión cerrada con apertura `150_000`, esperado `480_000`, contado `480_000`, retiro
`330_000` y dejado `150_000`. Verificar que la hoja `Resumen` contenga:

```ts
expect(summary?.rows).toEqual(expect.arrayContaining([
  ['Caja', 'Base inicial', null, 150_000],
  ['Caja', 'Efectivo esperado', null, 480_000],
  ['Caja', 'Efectivo contado antes del retiro', null, 480_000],
  ['Caja', 'Retiro al cierre', null, 330_000],
  ['Caja', 'Efectivo dejado', null, 150_000],
  ['Caja', 'Diferencia', null, 0],
]))
```

- [ ] **Step 2: Ejecutar test y confirmar fallo**

Run: `pnpm vitest run tests/unit/features/cash-register/turn-sales-export.test.ts`

Expected: FAIL porque el exportador no recibe `CashSession`.

- [ ] **Step 3: Ampliar el exportador sin romper ventas históricas**

Cambiar la firma a:

```ts
export function buildTurnSalesWorkbook(
  cashSession: CashSession | null,
  sales: readonly Sale[],
  cashMovements: readonly CashMovement[],
): ExcelWorkbookDefinition
```

Añadir filas de Caja solo cuando `cashSession !== null`. Actualizar `CajaPage` para pasar la sesión
activa. En `SalesHistoryDialog`, donde no existe una sesión única seleccionada, pasar `null` para
conservar el export actual.

- [ ] **Step 4: Mostrar el cierre en turnos anteriores**

En la cabecera de cada sesión cerrada mostrar `Caja esperada`, `Contado`, `Retiro`, `Quedó` y
`Diferencia`, usando `—` para valores legacy nulos. En el detalle, añadir el breakdown esperado de
`paymentClosure` mediante un helper seguro que valide `unknown` y devuelva solo efectivo y
transferencia:

```ts
interface ClosurePayment { metodo: string; count: number; total: number }

function expectedClosurePayments(value: unknown): ClosurePayment[] {
  if (!value || typeof value !== 'object' || !('expected' in value)) return []
  const expected = (value as { expected?: unknown }).expected
  if (!Array.isArray(expected)) return []
  return expected.filter(isClosurePayment)
}
```

No usar casts directos de `unknown` sin guardas.

Añadir un botón **Descargar Excel** dentro del detalle expandido de cada turno cerrado. Inyectar
`ExcelExportService`, mantener `exportingSessionId = signal<string | null>(null)` y reutilizar los
datos cargados de la sesión expandida:

```ts
async exportClosedSession(session: CashSession): Promise<void> {
  if (this.exportingSessionId()) return
  this.exportingSessionId.set(session.id)
  try {
    if (!this.isExpanded(session)) await this.toggleSession(session)
    await this.excel.download(
      buildTurnSalesWorkbook(session, this.expandedSales(), this.expandedMovements()),
    )
    this.toast.success('Turno descargado en Excel')
  } catch (error) {
    this.toast.error(getErrorMessage(error, 'No se pudo generar el archivo'))
  } finally {
    this.exportingSessionId.set(null)
  }
}
```

El botón debe detener la propagación del click de expansión. Si `toggleSession` falla, debe lanzar
o retornar un resultado fallido para impedir que se descarguen datos vacíos; no continuar después
de un error de carga.

- [ ] **Step 5: Ejecutar tests, typecheck y revisión visual**

Run: `pnpm vitest run tests/unit/features/cash-register/turn-sales-export.test.ts`

Run: `pnpm typecheck`

Con el servidor abierto, expandir un turno cerrado y comprobar legibilidad en 375 px y 1280 px.

- [ ] **Step 6: Commit**

```bash
git add apps/pos-angular/src/app/features/cash-register/presentation/components/closed-sessions-list.component.ts apps/pos-angular/src/app/shared/services/export/turn-sales-export.ts apps/pos-angular/src/app/features/cash-register/presentation/pages/caja.page.ts apps/pos-angular/src/app/features/pos/presentation/dialogs/sales-history.dialog.ts tests/unit/features/cash-register/turn-sales-export.test.ts
git commit -m "feat(cash): report closing withdrawal in history and export"
```

---

### Task 7: Documentación y verificación integral

**Files:**

- Modify: `docs/modules/cash-register.md`
- Modify: `docs/sessions/2026-09-13-caja-resumen-turno-efectivo.md`

**Interfaces:**

- Consumes: comportamiento terminado de Tasks 1–6.
- Produces: reglas operativas documentadas y evidencia de verificación.

- [ ] **Step 1: Documentar reglas nuevas**

Añadir:

```markdown
- RN-C17: el conteo físico del cierre se realiza antes de cualquier retiro de cierre. El retiro es
  opcional, equivale a `actual_cash_amount - cash_left_amount`, se guarda atómicamente con el
  cierre y no se duplica como `cash_movement`.
- RN-C18: `cash_left_amount` se sugiere como apertura de la próxima sesión de la tienda. La
  sugerencia siempre es editable y no sustituye el conteo físico del operador.
```

Actualizar RN-C03/RN-C11 para mencionar el desglose visible y diferenciar retiros durante el turno
de retiro al cierre.

- [ ] **Step 2: Ejecutar el conjunto de pruebas del módulo**

Run: `pnpm vitest run apps/pos-angular/src/app/features/cash-register/domain/services/cash-closure.test.ts tests/unit/features/cash-register`

Expected: PASS.

- [ ] **Step 3: Ejecutar verificación completa obligatoria**

Run: `pnpm typecheck`

Run: `pnpm lint`

Run: `pnpm test`

Run: `git diff --check`

Expected: todos con exit code 0. Si falla algo no relacionado por cambios preexistentes, registrar
el comando, el error exacto y demostrar que las pruebas focalizadas de Caja sí pasan.

- [ ] **Step 4: Completar el spec de sesión**

Cambiar estado a `Completado`, listar archivos/migración/decisiones, marcar los comandos realmente
ejecutados y registrar cualquier paso operativo pendiente, incluida la aplicación de la migración
remota si no forma parte de esta ejecución.

- [ ] **Step 5: Revisión final del diff**

Run: `git status --short`

Run: `git diff --stat HEAD~6..HEAD`

Run: `git diff HEAD~6..HEAD -- apps/pos-angular/src/app/features/cash-register apps/pos-angular/src/app/shared/services/export/turn-sales-export.ts supabase/migrations/20260913000100_cash_closing_withdrawal.sql docs/modules/cash-register.md`

Confirmar que no se incluyeron archivos ajenos al módulo ni cambios del usuario.

- [ ] **Step 6: Commit**

```bash
git add docs/modules/cash-register.md docs/sessions/2026-09-13-caja-resumen-turno-efectivo.md
git commit -m "docs(cash): document closing withdrawal flow"
```
