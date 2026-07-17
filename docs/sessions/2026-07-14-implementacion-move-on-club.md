# Spec de Sesión — 2026-07-14 — Implementación MOVE ON Club (núcleo)

---

## Metadatos

| Campo | Valor |
|---|---|
| Fecha | 2026-07-14 |
| Sprint | Bloque MOVE ON Club (PLAN-50..60) |
| Agente | Claude Code |
| HUs trabajadas | PLAN-50, PLAN-51, PLAN-52, PLAN-53, PLAN-54, PLAN-55, PLAN-56 (PLAN-58 parcial) |
| Estado | Completada (núcleo); PLAN-57/59/60 y UI de PLAN-58 pendientes |

---

## 1. Objetivo de la sesión

Implementar el programa de fidelización MOVE ON Club diseñado en la sesión de planeación del
mismo día (`2026-07-14-plan-fidelizacion-move-on-club.md`), con un cambio pedido por el dueño:
**el registro/búsqueda de cliente debe ser flexible — por número de celular O por documento de
identidad** (no exclusivamente por celular).

---

## 2. Lo que se implementó

### 2.1 Archivos creados
- `supabase/migrations/20260714_001_loyalty_move_on_club.sql` — esquema completo: columnas
  nuevas en `clientes` (celular_normalizado único + backfill, activo, autorizaciones),
  `productos.participa_fidelizacion`, `sales.loyalty_discount_total`,
  `sale_items.loyalty_reward_id`/`loyalty_discount_amount`; tablas `loyalty_accounts`
  (proyección), `loyalty_transactions` (ledger), `loyalty_rewards`; RLS solo-SELECT;
  `loyalty_program_config` (lee `settings.data.fidelizacion`, defaults 8/$11.000/30 días);
  RPCs internas `loyalty_apply_delta` + `loyalty_generate_rewards` (execute revocado);
  `adjust_loyalty_stamps` (admin); `create_sale_atomic` extendido (sellos + canje, ahora
  SECURITY DEFINER); `void_sale_atomic` extendido (reversa completa);
  `create_product_with_initial_stock` con `p_participa_fidelizacion`.
- `supabase/migrations/20260714_002_loyalty_cleanup_legacy_create_sale_overload.sql` — elimina
  un overload huérfano de 12 argumentos de `create_sale_atomic` hallado en el remoto (código
  muerto peligroso, previo a la trazabilidad de descuentos) y revoca anon.
- `src/modules/customers/domain/value-objects/phone-co.ts` — `normalizePhoneCO`/`isValidPhoneCO`/
  `formatPhoneCO` (celular colombiano canónico de 10 dígitos).
- `src/modules/loyalty/domain/entities/loyalty.entity.ts` — tipos de cuenta/ledger/recompensa.
- `src/modules/loyalty/domain/loyalty-config.ts` — `DEFAULT_LOYALTY_CONFIG` (espejo del RPC).
- `src/modules/loyalty/domain/services/stamps.ts` — sellos elegibles, ciclos de recompensa,
  vigencia, `rewardDiscountForPrice`, `applyLoyaltyDiscountToItem` (estructural, sin importar
  el módulo sales).
- `apps/pos-angular/src/app/features/loyalty/loyalty.repository.ts` — resumen (saldo +
  recompensas vigentes), ledger, `adjustStamps` (RPC).
- `tests/unit/modules/customers/phone-co.test.ts` (18 tests) y
  `tests/unit/modules/loyalty/stamps.test.ts` (20 tests).

### 2.2 Archivos modificados
- `src/modules/customers/domain/entities/cliente.entity.ts` — campos nuevos.
- `apps/pos-angular/src/app/features/customers/customers.repository.ts` — columnas nuevas,
  `celular_normalizado` derivado SIEMPRE del teléfono vía `PhoneCO`, mapeo de violación de
  unicidad a mensaje claro, `findByPhoneOrDocument` (búsqueda flexible).
- `apps/pos-angular/src/app/features/customers/cliente-form.dialog.ts` — checkboxes de
  autorización (programa + mensajes promocionales); si autoriza fidelización, exige celular
  colombiano válido.
- Pipeline de productos (`product.entity/dto/mapper/factory/form-mapper`, `products.repository`,
  `product-form.dialog`) — flag `participaFidelizacion` con checkbox en el form admin.
- `apps/pos-angular/src/app/features/pos/pos.types.ts` + `pos-data.service.ts` — flag en `PosProduct`.
- `apps/pos-angular/src/app/features/pos/pos-cart.store.ts` — estado de canje
  (`loyaltyRedemption` auto-invalidante), totales con descuento de canje aplicado una vez a la
  línea, `applyLoyaltyReward`/`clearLoyaltyRedemption`.
- `apps/pos-angular/src/app/features/pos/pos-sale.service.ts` — `p_loyalty_redemptions`
  (reward_id + item_index 0-based).
- `apps/pos-angular/src/app/features/pos/customer-picker.dialog.ts` — búsqueda flexible
  (celular normalizado O documento O nombre), badge "Club", botón "+ Nuevo".
- `apps/pos-angular/src/app/features/pos/pos.page.ts` — bloque MOVE ON Club en el carrito
  (barra X/8, preview de sellos, canje/quitar), registro rápido vía `ClienteFormDialog`,
  descuento discrecional separado del canje (motivo y tope 50% NO aplican al canje).
- `apps/pos-angular/src/app/features/expenses/expenses.repository.ts` — fix de drift (ver §6).
- `src/infrastructure/supabase/database.types.ts` — regenerado tras aplicar la migración.
- Fixtures de tests de productos/ventas — campo `participaFidelizacion` agregado.
- `docs/modules/loyalty.md`, `docs/plan-de-trabajo.md` — estados actualizados.

---

## 3. Decisiones tomadas

| Decisión | Alternativa descartada | Razón |
|---|---|---|
| Búsqueda flexible celular O documento | Solo celular (plan original) | Pedido explícito del dueño al iniciar la implementación |
| `create_sale_atomic` pasa a SECURITY DEFINER | Políticas RLS de INSERT en tablas loyalty | Mantiene RN-LF15 (cero escrituras directas); los chequeos de auth/rol/caja ya eran explícitos en el cuerpo; mismo patrón que `void_sale_atomic` |
| Descuento de canje UNA vez por línea (`loyalty_discount_amount` propio) | Reusar `discount_amount` por unidad | `discount_amount` se multiplica por cantidad; el canje cubre 1 unidad. Columna propia = trazable y no contamina el tope RN-S09 |
| Sellos de una línea canjeada = floor(cantidad) − 1 | Línea canjeada no genera ningún sello | Si el cliente compra 3 batidos y canjea 1, los 2 pagados sí deben sumar sellos |
| UI: 1 canje por venta (RPC soporta varios) | Multi-canje en UI | Caso raro; el payload jsonb ya es array para extenderlo sin migración |
| Canje aplica a la línea elegible más costosa | Selector manual de línea | Menos fricción en caja; el premio cubre hasta $11.000 así que la línea más costosa maximiza el beneficio del cliente; se puede quitar y recolocar |
| Backfill de `celular_normalizado` en la migración | Solo normalizar hacia adelante | Los clientes existentes con celular válido quedan buscables de inmediato; colisiones → gana el más antiguo |

---

## 4. ADRs creados o actualizados

- `docs/adr/0013-programa-fidelizacion-move-on-club.md` — pasa de Propuesto a **Aceptado e
  implementado** (actualizar estado en el próximo retoque; el contenido sigue vigente).

---

## 5. Tests

- [x] `pnpm typecheck` — pasó (tsc + ng build development).
- [x] `pnpm lint` — pasó.
- [x] `pnpm test` — **484 tests pasaron** (38 nuevos de loyalty/phone-co).
- [x] Smoke test SQL en remoto (con ROLLBACK, sin dejar datos): ejemplo oficial del negocio
  7 sellos + 3 batidos → `balance=2 rewards=1 valor=11000 expira=2026-08-13`. ✔
- [ ] pgTAP local — sigue bloqueado por PLAN-46 (nombres de migraciones 20260426_*).

### Batería E2E contra el remoto (2026-07-14, JWT simulado + ROLLBACK total)

Tres bloques `DO` con `raise exception` final para revertir todo; se verificó después que no
quedó ningún dato (`clientes/productos/ventas E2E = 0`, tablas loyalty en 0).

**Funcional (T1–T9) — todo pasó:**
- T1: 8 batidos → 8 sellos → 1 recompensa $11.000, saldo 0, total venta $88.000.
- T2: idempotencia — misma key devuelve la misma venta, sin `earn` duplicado.
- T3: canje sobre batido de $13.000 → total $2.000, `loyalty_discount_total=11000`,
  motivo automático `'Canje MOVE ON Club'`, línea trazada, recompensa `redeemed`, 0 sellos.
- T4: doble canje de la misma recompensa → bloqueado.
- T5: línea con descuento manual → 0 sellos.
- T6: descuento global → 0 sellos.
- T7: venta limpia de 3 → saldo 3; anulación → saldo 0.
- T8: anular la venta del canje → recompensa restaurada a `available`.
- T9: anular la venta origen → recompensa `voided`, saldo final 0.

**Seguridad (S1–S5) — todo pasó (como rol `authenticated` con JWT del admin):**
- S1/S2/S3: INSERT al ledger, UPDATE del saldo e INSERT de recompensa directos → bloqueados.
- S4: invocar `loyalty_apply_delta` directamente → permission denied (execute revocado).
- S5: SELECT de su tienda → funciona (política de lectura).

**Ajuste manual (A1–A4) — todo pasó:**
- A1: admin +10 → 1 recompensa generada, saldo 2, `audit_logs` con `loyalty.stamps_adjusted`.
- A2: sin motivo → bloqueado. A3: saldo negativo → bloqueado. A4: cajero → bloqueado.

**Bug real atrapado por la batería:** el check `sales_discount_breakdown_check` (20260615_001)
exigía `discount_total = item + global` y rechazaba las ventas con canje. Corregido en
`20260714_003_loyalty_fix_discount_breakdown_check.sql` (aplicada al remoto):
`discount_total = item + global + loyalty`.

**Advisors de Supabase post-migración:** sin hallazgos nuevos críticos atribuibles a loyalty;
las advertencias sobre RPCs `SECURITY DEFINER` ejecutables por `authenticated` son el patrón
intencional del proyecto (validación de auth/rol interna). Preexistentes que quedan anotados:
`tg_audit_sale_discount`/`tg_consume_sale_components` ejecutables por `anon`, vista
`storefront_productos_publicos` SECURITY DEFINER, y leaked-password-protection desactivado.

---

## 6. Bloqueos y hallazgos

- **Drift remoto vs migración local (hallazgo):** `get_reinvestment_fund_totals` en el remoto
  ya NO devuelve `ventas_sin_costo` (la migración local `20260708_001` sí lo define). El código
  leía `NaN` silenciosamente; se agregó fallback a 0 en `expenses.repository.ts`. **Pendiente
  reconciliar la migración local con el remoto.**
- **Overload huérfano de `create_sale_atomic` (12 args)** vivía en el remoto desde antes de
  `20260615_001` — eliminado en `20260714_002`.
- El progreso "X/8" del POS usa `DEFAULT_LOYALTY_CONFIG` (8) — cuando exista la UI de
  configuración (PLAN-59) debe leerse de settings para tiendas con umbral distinto.

---

## 7. Próximos pasos

1. **Acción del admin (sin código):** marcar los batidos con el checkbox "Participa en MOVE ON
   Club" en `/productos`, y registrar clientes con la autorización activada.
2. PLAN-57: historial de fidelización en la ficha del cliente (`LoyaltyRepository.listTransactions`
   ya está listo).
3. PLAN-58 (UI): pantalla admin de ajuste manual (el RPC y el método del repo ya existen).
4. PLAN-59: sección de configuración del programa en `/configuracion`.
5. PLAN-60: barrido de vencimiento + reporte de fidelización.
6. QA manual end-to-end en producción: venta con batidos marcados → sellos; 8 sellos →
   recompensa; canje; anulación → reversa.
7. Reconciliar el drift de `get_reinvestment_fund_totals` (ver §6).

---

## 8. Notas adicionales

- El canje NO exige motivo de descuento ni cuenta para el tope del 50% del cajero — el RPC le
  pone motivo reservado `'Canje MOVE ON Club'` si la venta no trae otro (ADR 0013 §5).
- Con descuento global en la venta, ninguna línea genera sellos (RN-LF02); la preview del POS
  replica esa regla mostrando 0.
- `sales.discount_total = item + global + loyalty` — los reportes que desglosen descuentos
  pueden separar el canje vía `loyalty_discount_total`.
