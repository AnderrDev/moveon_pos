# Módulo: loyalty (Fidelización — MOVE ON Club)

> Estado: **completo (2026-07-16)** — migraciones `20260714_001`/`_002`/`_003` aplicadas al
> remoto; dominio en `src/modules/loyalty`; UI POS (progreso + canje + registro rápido)
> operativa. PLAN-57/58 (diálogo "Club" en `/clientes` con historial + ajuste admin),
> PLAN-59 (sección MOVE ON Club en `/configuracion`) y PLAN-60 (RPC
> `expire_loyalty_rewards`, migración `20260716000100`, + tab "Fidelización" en `/reportes`)
> implementados en la sesión 2026-07-16. La migración de vencimiento está pendiente de
> aplicarse al remoto (confirmación del dueño).
> Ver `docs/adr/0013-programa-fidelizacion-move-on-club.md` (decisión) y
> `docs/sessions/2026-07-14-implementacion-move-on-club.md` (implementación).
>
> **Cambio sobre el plan original (decisión del dueño, 2026-07-14):** la identificación del
> cliente es flexible — se busca por **celular O por documento de identidad** (RN-CL04 se
> mantiene: el celular sigue siendo único y necesario para participar en el programa).

## Responsabilidad

Acumular sellos por batidos válidos vendidos, desbloquear y redimir recompensas (batido base
gratis), y mantener un historial auditable de todo movimiento de sellos por cliente. Depende de
`customers` (identidad del cliente) y de `sales` (origen de los sellos), pero vive en su propio
módulo por volumen de reglas propias.

## Mecánica del programa

- 8 sellos = 1 batido base gratis (hasta $11.000 COP; configurable, ver §Configuración).
- 1 sello por unidad de batido **elegible** vendida a precio de lista.
- Una compra puede completar varios ciclos de 8 y generar más de una recompensa.
- El batido redimido no genera sello adicional.
- No se manejan puntos monetarios, solo sellos enteros.

## Entidades del dominio

### `LoyaltyAccount` (proyección de conveniencia, no fuente de verdad)

```typescript
type LoyaltyAccount = {
  id: string
  tiendaId: string
  clienteId: string
  stampsBalance: number
  totalStampsEarned: number
  totalRewardsRedeemed: number
  createdAt: Date
  updatedAt: Date
}
```

### `LoyaltyTransaction` (ledger — fuente de verdad)

```typescript
type LoyaltyTransactionType = 'earn' | 'redeem' | 'void' | 'adjustment' | 'expire'

type LoyaltyTransaction = {
  id: string
  tiendaId: string
  clienteId: string
  saleId: string | null
  type: LoyaltyTransactionType
  stampsDelta: number // + o -
  balanceAfter: number
  reason: string | null // obligatorio en 'adjustment' y 'void' con saldo truncado
  createdBy: string
  createdAt: Date
}
```

### `LoyaltyReward`

```typescript
type LoyaltyRewardStatus = 'available' | 'redeemed' | 'expired' | 'voided'

type LoyaltyReward = {
  id: string
  tiendaId: string
  clienteId: string
  costStamps: number // 8, snapshot de la config al generarse
  rewardValueCop: number // 11000, snapshot de la config al generarse
  status: LoyaltyRewardStatus
  sourceTransactionId: string // transacción 'earn' que la generó
  generatedAt: Date
  expiresAt: Date
  redeemedAt: Date | null
  redeemedSaleId: string | null
  redeemedBy: string | null
  voidedAt: Date | null
  voidedBy: string | null
  voidedReason: string | null
}
```

### Value Object: `PhoneCO`

Normaliza celulares colombianos a 10 dígitos canónicos. Vive en
`src/modules/customers/domain/value-objects/phone-co.ts` (módulo `customers`, reutilizado aquí).
Reglas: acepta con/sin `+57`, `57`, espacios, guiones y paréntesis; rechaza si no quedan 10
dígitos empezando por `3`.

## Configuración (`settings.data.fidelizacion`)

```json
{
  "activo": true,
  "sellosParaRecompensa": 8,
  "valorRecompensaCop": 11000,
  "vigenciaDias": 30
}
```

Solo `admin` edita (mismo patrón que `settings.data.recibo`, ver `docs/modules/settings.md`).
Los RPC leen esta config al momento de otorgar/generar — no hay valores hardcodeados en SQL.

## Reglas de negocio (RN-LF)

### Acumulación

- **RN-LF01:** 1 sello por unidad de línea de venta cuyo producto tenga
  `productos.participa_fidelizacion = true`, vendida sin descuento de línea ni parte del
  descuento global prorrateado, en una venta con `status = 'completed'`.
- **RN-LF02:** Una línea con `sale_items.discount_amount > 0` o `global_discount_amount > 0` no
  genera sello, aunque el producto participe.
- **RN-LF03:** Los sellos se otorgan dentro de la misma transacción SQL que crea la venta
  (`create_sale_atomic` extendido llama a `register_loyalty_stamps`). No existe un paso
  posterior desacoplado — evita ventanas de venta sin sellos por fallos de red.
- **RN-LF04:** Un mismo `sale_id` no puede generar sellos más de una vez. Índice único parcial
  `loyalty_transactions(sale_id) where type = 'earn'`.
- **RN-LF05:** La línea que redime una recompensa (`sale_items.loyalty_reward_id is not null`)
  nunca genera sello, aunque el producto participe.
- **RN-LF06 (producto elegible):** el admin marca explícitamente qué productos participan
  (`productos.participa_fidelizacion`). Default `false`.

### Recompensa

- **RN-LF07:** Cada 8 sellos netos acumulados genera 1 `loyalty_reward`. Cálculo por venta:
  `nuevasRecompensas = floor(balanceDespués / sellosParaRecompensa) - floor(balanceAntes / sellosParaRecompensa)`.
  Una venta puede generar más de una recompensa (ver ejemplo del negocio: 7 sellos + compra de 3
  batidos → 1 recompensa generada, quedan 2 sellos para el siguiente ciclo).
- **RN-LF08:** La recompensa vale 1 batido base gratis hasta `valorRecompensaCop`. Si el batido
  elegido cuesta más, el cliente paga la diferencia. Extras/toppings se cobran aparte, siempre.
- **RN-LF09:** Vence a los `vigenciaDias` días desde `generated_at`. Vencida no puede redimirse
  (`RedeemLoyaltyReward` valida `expires_at > now()` antes de marcar `redeemed`). Evaluación
  perezosa; un barrido periódico que marque `expired` explícitamente es mejora P2, no bloqueante.
- **RN-LF10:** Una recompensa `redeemed` no puede reutilizarse. Redimir es atómico: valida
  `status = 'available'` y no vencida, marca `redeemed`, enlaza `redeemed_sale_id` — todo dentro
  del mismo RPC que crea la venta.
- **RN-LF11:** Los premios no se convierten en dinero. No existe un flujo de "cambiar recompensa
  por efectivo".

### Redención (integración con `sales`)

- **RN-LF12:** La redención se aplica como descuento dirigido sobre una línea de batido
  elegible: `discount_amount = min(precio_unitario, valorRecompensaCop)`,
  `sale_items.loyalty_reward_id` referencia la recompensa consumida. **No** pasa por el tope de
  descuento discrecional de RN-S09 (50% cajero / aprobación admin) — es una operación de
  redención, no un descuento manual. Ver ADR 0013 §5 para el detalle de por qué se excluye.
- **RN-LF13:** Redimir y vender ocurren en la misma llamada a `create_sale_atomic` (payload
  extendido con `loyaltyRedemptions: [{ rewardId, saleItemIndex }]`) — nunca se "reserva" una
  recompensa fuera de una transacción de venta exitosa.

### Anulación y control de fraude

- **RN-LF14:** Anular una venta que otorgó sellos (`VoidSaleUseCase`) revierte esos sellos:
  inserta transacción `type = 'void'` con `stamps_delta` negativo igual al `earn` original,
  mismo `sale_id`. Si el balance resultante iría negativo (porque esos sellos ya se consumieron
  en una recompensa redimida en otra venta), se trunca en 0 y se registra el faltante en
  `reason` para revisión manual del admin — la anulación de la venta nunca se bloquea por esto.
- **RN-LF15:** Ningún saldo (`loyalty_accounts.stamps_balance`) se escribe directo desde el
  cliente Angular. RLS de `loyalty_accounts` / `loyalty_transactions` / `loyalty_rewards` es
  **solo `SELECT`** para usuarios autenticados de su tienda; toda mutación pasa por RPC
  `SECURITY DEFINER`.
- **RN-LF16:** Ajustes manuales (`adjust_loyalty_stamps`) son admin-only, exigen motivo ≥ 3
  caracteres, y quedan en el ledger como `type = 'adjustment'` con `created_by`.

## Use cases

- `GetLoyaltyProgressUseCase(clienteId)` → `{ stampsBalance, stampsToNextReward, availableRewards }`.
- `ListLoyaltyHistoryUseCase(clienteId, filters)` → ledger + recompensas paginado (acumulaciones,
  redenciones, anulaciones, ajustes en una sola vista cronológica).
- `AdjustLoyaltyStampsUseCase` (admin) → invoca `adjust_loyalty_stamps`.
- La acumulación y redención **no** tienen use-case propio de escritura del lado Angular más
  allá de invocar el RPC extendido de `sales` (`CreateSaleUseCase` ya existente, con payload
  ampliado) — se evita duplicar la orquestación transaccional fuera de la RPC.

## Esquema de datos (borrador — a confirmar por el agente `architect` antes de migrar)

```sql
create type loyalty_transaction_type as enum ('earn','redeem','void','adjustment','expire');
create type loyalty_reward_status as enum ('available','redeemed','expired','voided');

alter table clientes
  add column celular_normalizado text,
  add column activo boolean not null default true,
  add column autoriza_fidelizacion boolean not null default false,
  add column acepta_mensajes_promocionales boolean not null default false;

create unique index ux_clientes_celular_normalizado
  on clientes (tienda_id, celular_normalizado)
  where celular_normalizado is not null;

alter table productos
  add column participa_fidelizacion boolean not null default false;

alter table sale_items
  add column loyalty_reward_id uuid references loyalty_rewards(id);

create table loyalty_accounts (
  id uuid primary key default gen_random_uuid(),
  tienda_id uuid not null references tiendas(id) on delete cascade,
  cliente_id uuid not null references clientes(id) on delete cascade,
  stamps_balance int not null default 0,
  total_stamps_earned int not null default 0,
  total_rewards_redeemed int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tienda_id, cliente_id)
);

create table loyalty_transactions (
  id uuid primary key default gen_random_uuid(),
  tienda_id uuid not null references tiendas(id) on delete cascade,
  cliente_id uuid not null references clientes(id) on delete cascade,
  sale_id uuid references sales(id) on delete set null,
  type loyalty_transaction_type not null,
  stamps_delta int not null,
  balance_after int not null,
  reason text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create unique index ux_loyalty_tx_sale_earn on loyalty_transactions(sale_id) where type = 'earn';
create unique index ux_loyalty_tx_sale_void on loyalty_transactions(sale_id) where type = 'void';

create table loyalty_rewards (
  id uuid primary key default gen_random_uuid(),
  tienda_id uuid not null references tiendas(id) on delete cascade,
  cliente_id uuid not null references clientes(id) on delete cascade,
  cost_stamps int not null default 8,
  reward_value_cop numeric(14,2) not null,
  status loyalty_reward_status not null default 'available',
  source_transaction_id uuid not null references loyalty_transactions(id),
  generated_at timestamptz not null default now(),
  expires_at timestamptz not null,
  redeemed_at timestamptz,
  redeemed_sale_id uuid references sales(id),
  redeemed_by uuid references auth.users(id),
  voided_at timestamptz,
  voided_by uuid references auth.users(id),
  voided_reason text
);
```

> Nota: `sale_items.loyalty_reward_id` crea una referencia circular de creación con
> `loyalty_rewards.redeemed_sale_id` (ambas tablas se referencian mutuamente vía `sales`). Se
> resuelve insertando `sale_items` primero sin el FK poblado y actualizándolo en el mismo
> statement de `create_sale_atomic`, igual que ya hace el RPC con otros campos derivados — el
> `architect` debe confirmar el orden exacto de inserts al implementar.

## RPC (SECURITY DEFINER)

| RPC | Se invoca desde | Responsabilidad |
|---|---|---|
| `register_loyalty_stamps(sale_id)` | Dentro de `create_sale_atomic` | Suma líneas elegibles, inserta `earn`, actualiza `loyalty_accounts`, genera recompensas nuevas (RN-LF07) |
| `redeem_loyalty_reward(reward_id, sale_item_id)` | Dentro de `create_sale_atomic`, si el payload trae `loyaltyRedemptions` | Valida y marca `redeemed`, aplica descuento dirigido a la línea |
| `reverse_loyalty_stamps(sale_id)` | Dentro del flujo de anulación de venta | Inserta `void`, trunca en 0 si aplica (RN-LF14) |
| `adjust_loyalty_stamps(cliente_id, delta, reason)` | UI admin | Ajuste manual auditado (RN-LF16) |

## RLS

```sql
alter table loyalty_accounts enable row level security;
alter table loyalty_transactions enable row level security;
alter table loyalty_rewards enable row level security;

create policy "read_own_tienda_loyalty_accounts" on loyalty_accounts
  for select using (
    tienda_id in (select tienda_id from user_tiendas where user_id = auth.uid() and is_active = true)
  );
-- mismas políticas de solo-lectura para loyalty_transactions y loyalty_rewards.
-- Sin políticas de insert/update/delete: solo RPC SECURITY DEFINER las toca.
```

## UI (Angular)

- Selector de cliente en POS: si tiene cuenta, barra de progreso "X/8 sellos" + badge de
  recompensa(s) disponible(s).
- Registro rápido de cliente desde el flujo de venta: nombre + celular + checkboxes de
  autorización (fidelización, mensajes promocionales) — no bloquea la venta en curso.
- Botón "Canjear premio MOVE ON Club" en el carrito: habilitado solo con recompensa disponible y
  ≥1 batido elegible en el carrito; aplica el descuento dirigido a la línea elegida por el
  cajero, muestra la diferencia a cobrar si el batido supera `valorRecompensaCop`.
- Diálogo "Club" en `/clientes` (`features/loyalty/cliente-loyalty.dialog.ts`, PLAN-57/58):
  resumen (saldo, progreso X/N, recompensas vigentes), ledger cronológico (acumulaciones,
  redenciones, anulaciones, ajustes, vencimientos) y — solo admin — ajuste manual de sellos con
  motivo obligatorio (schema Zod en `src/modules/loyalty/forms/adjust-stamps-form.factory.ts`).
- Sección "MOVE ON Club" en `/configuracion` (PLAN-59): edita `settings.data.fidelizacion`
  (activo, sellos por recompensa, valor máximo, vigencia). Patrón factory/mapper/presenter en
  `src/modules/settings/forms/loyalty-settings-form.*` + `LoyaltySettingsService`. El POS y el
  diálogo leen la config vía `TiendaInfoService.fidelizacion` (defaults del dominio si no hay).
- Tab "Fidelización" en `/reportes` (PLAN-60): KPIs del período (sellos otorgados/revertidos,
  ajuste neto, recompensas generadas/canjeadas/vencidas, disponibles hoy, clientes activos) +
  tabla de clientes del período. Dominio puro en
  `src/modules/loyalty/domain/services/program-report.ts`; queries en
  `features/reports/loyalty-report.service.ts`.
- Vencimiento explícito (PLAN-60): RPC `expire_loyalty_rewards(p_tienda_id)`
  (migración `20260716000100`) marca `expired` e inserta transacción `expire` (delta 0) en el
  ledger. Sin cron: se invoca oportunistamente al abrir el diálogo del cliente y el reporte.

## Testing

### Unitarios obligatorios

- Normalización de celular colombiano (con/sin `+57`, espacios, guiones; casos inválidos).
- Cálculo de sellos elegibles por venta (excluye líneas con descuento y la línea de redención).
- Cálculo de recompensas nuevas por cruce de múltiplos de 8, incluyendo el caso de 2+
  recompensas en una sola venta.
- Vigencia de recompensa (límite exacto de `vigenciaDias`).

### Integración obligatorios

- Crear venta con productos elegibles → `loyalty_transactions` + `loyalty_accounts.stamps_balance`
  correctos, recompensa generada al cruzar el octavo sello.
- Anular venta que otorgó sellos → reversa correcta, balance nunca negativo.
- Redimir recompensa → descuento dirigido aplicado, `status = 'redeemed'`, segundo intento de
  redención falla.
- Redimir recompensa vencida → falla con error tipado.
- RLS: intento de `update`/`insert` directo (sin pasar por RPC) sobre las 3 tablas falla para
  cualquier rol, incluido `admin`.
