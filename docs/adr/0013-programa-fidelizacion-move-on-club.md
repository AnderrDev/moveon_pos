# ADR 0013 — Programa de fidelización MOVE ON Club: ledger auditable + RPC-only

| Campo | Valor |
|---|---|
| Fecha | 2026-07-14 |
| Estado | Aceptado e implementado (núcleo, 2026-07-14 — ver `docs/sessions/2026-07-14-implementacion-move-on-club.md`) |
| Decisores | Dueño del negocio (requisito) + Arquitecto (Claude) |
| Relacionado | Amplía `docs/modules/customers.md`, crea `docs/modules/loyalty.md`; ver `docs/01-mvp-scope.md` (fidelización listada como v1.3) |

## Contexto

El negocio quiere lanzar **MOVE ON Club**: por cada 8 batidos válidos pagados, el cliente
recibe 1 batido base gratis (hasta $11.000 COP). El programa exige acumulación por cliente
identificado por celular, progreso visible, desbloqueo automático de recompensa, redención
controlada, historial completo (acumulaciones, redenciones, anulaciones, ajustes) y **cero
tolerancia a manipulación directa del saldo**.

Hoy `clientes` no tiene celular único ni normalizado, no hay tablas de fidelización, y
`productos` no distingue qué productos participan en el programa. El roadmap (`04-roadmap.md`)
ubica fidelización en v1.3 (Sprint 8), después de facturación electrónica (v1.1) y recetas de
batidos (v1.2). Este ADR documenta la arquitectura para cuando el negocio decida adelantar o
llegar a ese sprint — no autoriza implementación inmediata.

## Decisión

### 1. Identidad del cliente: celular como llave principal
- Se agrega `clientes.celular_normalizado` (formato canónico colombiano: 10 dígitos, sin `+57`/`57`/espacios/guiones). La normalización vive en el **dominio puro** (`src/modules/customers/domain/value-objects/phone-co.ts`), reutilizable por UI y RPC.
- Índice único parcial `(tienda_id, celular_normalizado) where celular_normalizado is not null` evita duplicados. `numero_documento` sigue siendo opcional (RN-CL03 ya existente); el celular pasa a ser el identificador operativo principal.
- `clientes` gana `activo`, `autoriza_fidelizacion`, `acepta_mensajes_promocionales` (booleanos, default `false` salvo `activo=true`).

### 2. Ledger auditable, no un contador mutable
Se rechaza guardar el saldo de sellos como un simple `int` editable en `clientes`. En su
lugar:
- `loyalty_transactions` es el **ledger append-only** (`earn`, `redeem`, `void`, `adjustment`,
  `expire`), con `stamps_delta`, `balance_after` (snapshot) y `reason`.
- `loyalty_accounts` es una **vista materializada de conveniencia** (1 fila por cliente,
  `stamps_balance` cacheado) que se actualiza **únicamente** dentro de la misma transacción SQL
  que inserta la fila del ledger. Nunca se escribe por separado.
- Esto replica el patrón ya usado en `inventory_movements` (RN dura del proyecto: "el stock
  nunca se modifica directamente") aplicado a sellos de fidelización.

### 3. Mutación solo vía RPC `SECURITY DEFINER`
- RLS de `loyalty_accounts`, `loyalty_transactions` y `loyalty_rewards`: **`SELECT` únicamente**
  para usuarios autenticados de su tienda. Ninguna política permite `INSERT`/`UPDATE`/`DELETE`
  directo — ni siquiera para `admin`. Todo cambio de saldo pasa por RPC:
  - `register_loyalty_stamps` — se invoca dentro de `create_sale_atomic` (mismo commit que la
    venta) cuando la venta queda `completed`. Cero ventana de venta sin sellos.
  - `redeem_loyalty_reward` — se invoca también dentro de `create_sale_atomic`, aceptando
    redenciones como parte del payload de la venta (evita reservar una recompensa fuera de una
    transacción atómica).
  - `reverse_loyalty_stamps` — se invoca dentro del flujo de anulación de venta existente.
  - `adjust_loyalty_stamps` — admin-only, motivo obligatorio, para correcciones manuales.
- Esto es una extensión directa del principio arquitectónico ya vigente: "las escrituras
  críticas no se hacen con múltiples inserts desde componentes Angular: deben ir a RPC
  transaccional" (`02-architecture.md` §4.1).

### 4. Elegibilidad de producto explícita, no inferida
- `productos.participa_fidelizacion boolean not null default false`. El admin decide
  explícitamente qué productos (batidos) cuentan — no se infiere de `tipo = 'prepared'`, porque
  no todo producto preparado necesariamente participa (y el negocio puede querer incluir algún
  producto `simple` a futuro).
- Una línea de venta genera sello solo si: el producto participa, la línea no tiene
  `discount_amount` propio, no recibió parte del `global_discount_amount` prorrateado, y no es
  ella misma la línea de redención de una recompensa (evita que el batido gratis genere sello).

### 5. Redención como descuento dirigido, fuera del tope de descuento discrecional (RN-S09)
- La redención de recompensa **no** usa el mecanismo de descuento manual normal (tope 50% para
  cajero, aprobación admin por encima). Es una operación distinta: consumir una recompensa ya
  ganada. Se modela como `discount_amount = min(precio_unitario, reward_value_cop)` en la línea
  elegida, con trazabilidad vía `sale_items.loyalty_reward_id` (columna nueva) — no reutiliza
  `sales.discount_reason` como motivo operativo discrecional, sino un valor reservado
  (`'loyalty_reward'`) que el RPC asigna automáticamente.
- **Importante para el arquitecto que implemente esto:** `create_sale_atomic` deberá excluir
  explícitamente los descuentos de origen `loyalty_reward` del cálculo del tope RN-S09 (50%
  subtotal) y de la exigencia de aprobación admin — de lo contrario, un batido de $11.000-13.000
  con descuento de $11.000 dispararía el bloqueo pensado para descuentos discrecionales.
- Extras/toppings agregados al batido canjeado son líneas de producto independientes, sin
  descuento, cobradas normalmente.

### 6. Configuración en `settings.data.fidelizacion`, no hardcodeada
- Reutiliza la tabla `settings` ya existente (mismo patrón que `settings.data.recibo`):
  `{ activo, sellosParaRecompensa: 8, valorRecompensaCop: 11000, vigenciaDias: 30 }`.
- Los RPC leen esta config en vez de tener `8`/`11000`/`30` hardcodeados en SQL, para permitir
  ajustar el programa sin migración. Solo `admin` edita.

### 7. Vigencia de recompensa: evaluación perezosa, sin cron obligatorio
- `loyalty_rewards.expires_at = generated_at + vigenciaDias`. El estado `expired` se evalúa al
  consultar o intentar redimir (comparación con `now()`), no requiere `pg_cron` para el MVP del
  programa. Un barrido periódico (Edge Function) que marque `expired` explícitamente queda como
  mejora P2 para que el historial no muestre `available` vencidas — no bloquea la función
  principal.

## Alternativas descartadas

- **Contador simple en `clientes.sellos_actuales`:** rechazado — no permite historial ni
  auditoría, y viola el principio "evitar modificaciones directas del saldo" pedido
  explícitamente por el negocio.
- **Puntos monetarios / wallet genérico:** rechazado — el negocio pidió explícitamente "por
  ahora no se manejan puntos monetarios"; el modelo de sellos por unidad es más simple y
  suficiente.
- **Otorgar sellos con un trigger `AFTER INSERT` en `sales`:** rechazado — dificulta el control
  fino de qué líneas son elegibles (requiere lógica por ítem) y separa la responsabilidad del
  RPC transaccional ya establecido (`create_sale_atomic`). Se prefiere una llamada explícita
  dentro del mismo RPC, más fácil de testear e idéntica en estilo al resto del módulo `sales`.
- **Reward atado a un producto específico ("el batido de proteína") en vez de un tope de
  valor:** rechazado — la regla de negocio es explícita: "1 batido base gratis de hasta
  $11.000", aplicable a cualquier batido elegible, con cobro de diferencia si el precio es
  mayor. Modelarlo como tope de valor es más flexible y evita mantener una lista de "producto
  canjeable" separada.

## Consecuencias

- Nuevas tablas: `loyalty_accounts`, `loyalty_transactions`, `loyalty_rewards` (detalle completo
  en `docs/modules/loyalty.md`).
- `clientes` y `productos` reciben columnas nuevas (no rompen datos existentes: defaults
  seguros).
- `create_sale_atomic` y el flujo de anulación de venta crecen en responsabilidad — deben
  extenderse con cuidado para no romper `sales.md` RN-S01–RN-S12 existentes. Se recomienda que
  el agente `architect` revise la firma actual de `create_sale_atomic`
  (`supabase/migrations/20260615_001_discount_traceability.sql`) antes de tocarla.
- Este ADR no autoriza a saltar el orden del roadmap (`04-roadmap.md` regla "no saltarse
  sprints"). Queda como diseño listo para ejecutar cuando el negocio confirme prioridad.
