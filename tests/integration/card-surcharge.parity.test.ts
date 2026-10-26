/**
 * Recargo por pago con tarjeta (ADR 0024, PLAN-99): paridad de la fórmula SQL
 * (`card_fee_amount` / `card_charge_for`) con `card-surcharge.ts`, y el
 * contrato de `create_sale_atomic` / `correct_payment_atomic` con pagos con
 * tarjeta.
 *
 * Corre SOLO contra el Supabase LOCAL: `pnpm test:parity`. Al terminar borra
 * todo lo que creó.
 */
import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  NEQUI_CARD_FEE,
  calculateCardCharge,
  calculateCardFee,
} from '@angular-app/features/sales/domain/services/card-surcharge'
import {
  CLEANUP_SQL,
  createUsers,
  deleteUsers,
  localStack,
  psql,
  psqlQuery,
  signIn,
  type LocalStack,
} from './support/local-stack'

const TIENDA = randomUUID()
const PRODUCTO = randomUUID()
const CARO = randomUUID()

interface PaymentInput {
  metodo: 'cash' | 'card' | 'transfer'
  amount: number
  card_surcharge?: number
}

describe('recargo por tarjeta: fórmula SQL = TS y contrato de la venta', () => {
  let stack: LocalStack
  let admin: SupabaseClient
  let adminId: string
  let sessionId: string
  const adminEmail = `paridad-tarjeta-${TIENDA.slice(0, 8)}@local.test`

  /** Vende `quantity` del producto con los pagos dados (mismo payload que `SalesRepository.create`). */
  function sell(payments: PaymentInput[], producto = PRODUCTO, quantity = 1) {
    return admin.rpc('create_sale_atomic', {
      p_tienda_id: TIENDA,
      p_cash_session_id: sessionId,
      p_sale_number: '',
      p_cashier_id: adminId,
      p_cliente_id: null,
      p_subtotal: 0,
      p_discount_total: 0,
      p_tax_total: 0,
      p_total: 0,
      p_idempotency_key: randomUUID(),
      p_items: [{
        producto_id: producto,
        producto_nombre: 'Tarjeta',
        producto_sku: null,
        quantity,
        unit_price: 0,
        option_id: null,
        discount_amount: 0,
        tax_rate: 0,
        tax_amount: 0,
        total: 0,
      }],
      p_payments: payments.map((p) => ({ ...p, referencia: null })),
      p_global_discount_total: 0,
      p_discount_reason: null,
      p_loyalty_redemptions: null,
    })
  }

  beforeAll(async () => {
    stack = localStack()
    ;[adminId] = await createUsers(stack, [adminEmail])
    psql(stack, CLEANUP_SQL)
    psql(stack, `
      begin;
      insert into public.tiendas (id, nombre, timezone) values (:'tienda', 'Paridad tarjeta', 'America/Bogota');
      insert into public.user_tiendas (user_id, tienda_id, rol, is_active) values (:'admin', :'tienda', 'admin', true);
      insert into public.productos (id, tienda_id, nombre, tipo, precio_venta, costo, iva_tasa, stock_minimo, is_active) values
        (:'producto', :'tienda', 'Proteína tarjeta', 'simple', 30000, 15000, 0, 0, true),
        (:'caro', :'tienda', 'Combo caro tarjeta', 'simple', 260000, 100000, 0, 0, true);
      insert into public.inventory_movements (tienda_id, producto_id, tipo, cantidad, ubicacion, motivo, created_by) values
        (:'tienda', :'producto', 'entry', 100, 'punto_venta', 'Inventario inicial', :'admin'),
        (:'tienda', :'caro', 'entry', 10, 'punto_venta', 'Inventario inicial', :'admin');
      insert into public.cash_sessions (tienda_id, opened_by, opening_amount, status) values (:'tienda', :'admin', 0, 'open');
      commit;
    `, { tienda: TIENDA, admin: adminId, producto: PRODUCTO, caro: CARO })
    admin = await signIn(stack, adminEmail)
    const { data } = await admin.from('cash_sessions').select('id').eq('tienda_id', TIENDA).eq('status', 'open').single()
    sessionId = (data as { id: string }).id
  })

  afterAll(async () => {
    if (!stack) return
    psql(stack, CLEANUP_SQL)
    await deleteUsers(stack, [adminId])
  })

  it('card_fee_amount da el mismo costo que el TS en todo el rango de Nequi', () => {
    const out = psqlQuery(stack, `
      select string_agg(public.card_fee_amount(a, 199, 19)::int::text, ',' order by a)
      from generate_series(1500, 256000) a;`)
    const sql = out.split(',').map(Number)
    for (let a = 1500; a <= 256000; a += 1) {
      expect(sql[a - 1500], `monto ${a}`).toBe(calculateCardFee(a).fee)
    }
  })

  it('card_charge_for da el mismo cobro que el TS en todo el rango de Nequi', () => {
    const out = psqlQuery(stack, `
      select string_agg(public.card_charge_for(b, 199, 19)::int::text, ',' order by b)
      from generate_series(1500, 244000) b;`)
    const sql = out.split(',').map(Number)
    for (let b = 1500; b <= 244000; b += 1) {
      expect(sql[b - 1500], `base ${b}`).toBe(calculateCardCharge(b).chargeAmount)
    }
  })

  it('venta con tarjeta: guarda el recargo aparte del total y del monto del pago', async () => {
    const { surcharge } = calculateCardCharge(30000)
    const { data: saleId, error } = await sell([{ metodo: 'card', amount: 30000, card_surcharge: surcharge }])
    expect(error).toBeNull()

    const { data: sale } = await admin
      .from('sales')
      .select('total, card_surcharge, card_fee_rate_bps, card_fee_iva_pct, payments(metodo, amount, card_surcharge)')
      .eq('id', saleId as string)
      .single()
    expect(sale).toEqual({
      total: 30000,
      card_surcharge: 727,
      card_fee_rate_bps: 199,
      card_fee_iva_pct: 19,
      payments: [{ metodo: 'card', amount: 30000, card_surcharge: 727 }],
    })
  })

  it('pago mixto: el recargo solo va sobre la parte con tarjeta', async () => {
    const { surcharge } = calculateCardCharge(20000)
    const { data: saleId, error } = await sell([
      { metodo: 'cash', amount: 10000 },
      { metodo: 'card', amount: 20000, card_surcharge: surcharge },
    ])
    expect(error).toBeNull()
    const { data: sale } = await admin.from('sales').select('total, card_surcharge').eq('id', saleId as string).single()
    expect(sale).toEqual({ total: 30000, card_surcharge: surcharge })
  })

  it('venta sin tarjeta: recargo en cero y sin tarifa', async () => {
    const { data: saleId, error } = await sell([{ metodo: 'cash', amount: 30000 }])
    expect(error).toBeNull()
    const { data: sale } = await admin
      .from('sales')
      .select('card_surcharge, card_fee_rate_bps, card_fee_iva_pct')
      .eq('id', saleId as string)
      .single()
    expect(sale).toEqual({ card_surcharge: 0, card_fee_rate_bps: null, card_fee_iva_pct: null })
  })

  it.each([
    ['recargo distinto al de la tarifa', [{ metodo: 'card', amount: 30000, card_surcharge: 700 }], 'no coincide'],
    ['pago con tarjeta sin recargo', [{ metodo: 'card', amount: 30000 }], 'no coincide'],
    ['recargo en un pago que no es tarjeta', [{ metodo: 'transfer', amount: 30000, card_surcharge: 727 }], 'Solo los pagos con tarjeta'],
  ] as [string, PaymentInput[], string][])('rechaza: %s', async (_name, payments, message) => {
    const { error } = await sell(payments)
    expect(error?.message).toContain(message)
  })

  it('rechaza un cobro con tarjeta por encima de $250.000', async () => {
    const { surcharge } = calculateCardCharge(260000)
    const { error } = await sell([{ metodo: 'card', amount: 260000, card_surcharge: surcharge }], CARO)
    expect(error?.message).toContain('entre $1.500 y $250.000')
  })

  it('usa la tarifa guardada en la configuración de la tienda', async () => {
    psql(stack, `insert into public.settings (tienda_id, data) values (:'tienda', '{"pagoTarjeta":{"comisionBps":250,"ivaPct":19}}')
      on conflict (tienda_id) do update set data = excluded.data;`, { tienda: TIENDA })
    try {
      const tarifa = { ...NEQUI_CARD_FEE, rateBps: 250 }
      const { surcharge } = calculateCardCharge(30000, tarifa)
      const { data: saleId, error } = await sell([{ metodo: 'card', amount: 30000, card_surcharge: surcharge }])
      expect(error).toBeNull()
      const { data: sale } = await admin.from('sales').select('card_surcharge, card_fee_rate_bps').eq('id', saleId as string).single()
      expect(sale).toEqual({ card_surcharge: surcharge, card_fee_rate_bps: 250 })
    } finally {
      psql(stack, `delete from public.settings where tienda_id = :'tienda';`, { tienda: TIENDA })
    }
  })

  it('correct_payment_atomic no corrige un pago con recargo ni hacia tarjeta', async () => {
    const { surcharge } = calculateCardCharge(30000)
    const { data: cardSale } = await sell([{ metodo: 'card', amount: 30000, card_surcharge: surcharge }])
    const { data: cashSale } = await sell([{ metodo: 'cash', amount: 30000 }])
    const paymentOf = async (saleId: unknown) =>
      ((await admin.from('payments').select('id').eq('sale_id', saleId as string).single()).data as { id: string }).id

    const fromCard = await admin.rpc('correct_payment_atomic', {
      p_payment_id: await paymentOf(cardSale), p_tienda_id: TIENDA, p_new_metodo: 'cash',
      p_corrected_by: adminId, p_reason: 'Prueba de corrección',
    })
    expect(fromCard.error?.message).toContain('no se corrigen')

    const toCard = await admin.rpc('correct_payment_atomic', {
      p_payment_id: await paymentOf(cashSale), p_tienda_id: TIENDA, p_new_metodo: 'card',
      p_corrected_by: adminId, p_reason: 'Prueba de corrección',
    })
    expect(toCard.error?.message).toContain('no se corrigen')

    const cashToTransfer = await admin.rpc('correct_payment_atomic', {
      p_payment_id: await paymentOf(cashSale), p_tienda_id: TIENDA, p_new_metodo: 'transfer',
      p_corrected_by: adminId, p_reason: 'Prueba de corrección',
    })
    expect(cashToTransfer.error).toBeNull()
  })
})
