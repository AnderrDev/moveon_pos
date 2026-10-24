# Spec de Sesión — 2026-10-24 — Ola 1: que el dinero cuadre (finanzas, caja, compras)

---

## Metadatos

| Campo | Valor |
|---|---|
| Fecha | 2026-10-24 |
| Sprint | Post-MVP (mejoras de flujo) |
| Agente | Claude Code |
| HUs trabajadas | Ola 1 de la revisión de productos/inventario/finanzas |
| Estado | Completada y en producción |

---

## 1. Objetivo de la sesión

Que la utilidad y el dinero que muestra Finanzas sean reales:

1. Los movimientos "Gasto" registrados desde Caja llegan a Finanzas (antes no: 146 movimientos / $2.338.646 fuera de la utilidad en producción).
2. Anular o corregir un gasto se sincroniza entre Finanzas y Caja (antes anular el gasto dejaba activa la salida de caja y viceversa).
3. La entrada de inventario pregunta cómo se pagó la compra; si fue con efectivo de caja crea la salida en caja. Finanzas muestra las compras de mercancía del mes como salida de dinero (sin restarlas de la utilidad).

Regla: pruebas solo en Supabase local; ninguna migración va a producción sin OK del dueño.

---

## 2. Lo que se implementó

### 2.1 Migraciones (aplicadas SOLO en local)
- `20261024160000_cash_expenses_sync.sql` — `ensure_cash_expense_category`; `add_cash_movement_atomic` crea el gasto para `tipo='expense'`; `void_cash_movement_atomic` y `correct_cash_movement_atomic` sincronizan el gasto enlazado; nueva `void_expense_atomic`; revoca escrituras directas a `expenses`.
- `20261024170000_backfill_cash_expenses.sql` — crea el gasto de los movimientos `expense` activos que no lo tienen (cambio de DATOS, idempotente).
- `20261024180000_inventory_entry_payment.sql` — `inventory_movements.metodo_pago` + `cash_movement_id`; `register_inventory_entry_atomic` con `p_metodo_pago` opcional (efectivo de caja crea `cash_out`); `correct_inventory_entry_cost_atomic` ajusta esa salida si la caja sigue abierta.

### 2.2 Frontend
- Finanzas: anular gasto vía `void_expense_atomic`; bloque "Dinero del período" (entradas − gastos − compras de mercancía) con `getMerchandisePurchases`; `buildFinancialSummary` devuelve `comprasMercancia` y `balanceDinero`.
- Inventario: campo "¿Cómo se pagó la compra?" en la entrada, con aviso del monto que saldrá de caja; regla compartida DTO/formulario `entryCashPaymentHasCost` (`registerEntryFieldsSchema` + `registerEntrySchema`).
- Caja: aviso en "Gasto" de que también queda en Finanzas.
- `database.types.ts` editado a mano (las funciones nuevas aún no existen en el remoto).

### 2.3 Pruebas
- pgTAP nueva `supabase/tests/cash-expenses-sync.test.sql` (18); todas las suites: 17 archivos / 226 pruebas OK.
- Unitarias: 871 OK (nuevas: pago de entrada, balance de dinero). Paridad local (`pnpm test:parity`): 35 OK, incluido el payload iOS de entrada sin método.
- Navegador local (puerto 4210): gasto desde caja → aparece en Finanzas como "Gastos de caja"; entrada de 2 × $70.000 pagada con caja → salida de $140.000; sin costo muestra el error; anular el gasto en Finanzas anuló la salida en Caja (esperado volvió de $10.000 a $28.000). Sin errores de consola.
- `pnpm lint`, `pnpm typecheck`, `pnpm build` OK.

---

## 3. Decisiones tomadas

- **Gastos de caja como filas de `expenses`** (no como suma aparte): así la utilidad, el export, la comparativa mensual y `owner_finance_summary` (app iOS) los cuentan sin más cambios.
- **Categoría única "Gastos de caja"** para lo registrado desde caja: el cajero no puede leer categorías (RLS admin). Reclasificar o elegir categoría desde caja queda pendiente.
- **Anular sincroniza aunque la caja esté cerrada**, igual que `void_cash_movement_atomic` ya permitía; el arqueo guardado del cierre no cambia.
- **La compra de mercancía no es gasto.** Se muestra como salida de dinero, aparte de la utilidad, para no contar dos veces el costo.
- **Corregir costo con la caja cerrada no toca la salida** (el arqueo es histórico); queda constancia en la auditoría.
- La salida por compra usa `cash_out` (se ve como "Retiro" con motivo "Compra mercancía: …").

---

## 4. Pendientes

- ~~Producción~~ **Hecho 2026-10-24 con OK del dueño:** `20261024160000`, `20261024170000` (backfill: 146 gastos / $2.338.646 recuperados, 0 movimientos sin gasto) y `20261024180000` aplicadas con `db query --linked` y versión registrada; funciones DEFINER, sin EXECUTE para anon, `expenses` solo lectura para authenticated. Frontend publicado en `main` adead04, Netlify ready en POS y catálogo.
- Elegir categoría al registrar un gasto desde caja, o reclasificar gastos en Finanzas (hoy algunos son nómina: "pago Danelis", "pago Gustavo").
- Inventario muestra "+ Entrada", "Ajustar" y "Trasladar" en productos preparados y combos, que la RPC rechaza (Ola 2).
- Decisión pendiente: ¿el stock inicial de un producto nuevo cuenta como compra en el fondo?
