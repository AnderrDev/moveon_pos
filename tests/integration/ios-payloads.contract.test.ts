/**
 * Contrato de escritura de la app iOS "MOVE ON Admin" (ADR 0022 §4, PLAN-85):
 * cada fixture de `fixtures/ios-payloads/` se envía tal cual al Supabase LOCAL
 * y se verifica su efecto. Los tests Swift comprueban que la app produce el
 * mismo JSON, así un cambio de payload en cualquiera de los dos lados se nota.
 *
 * Corre SOLO contra el Supabase LOCAL: `pnpm test:parity`.
 */
import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { CLEANUP_SQL, createUsers, deleteUsers, localStack, psql, signIn, type LocalStack } from './support/local-stack'
import { loadPayload, payloadNames, type IosPayload } from './support/ios-payloads'

const TIENDA = randomUUID()
const PRODUCTO = randomUUID()
/** Producto con 20 en bodega para el ajuste y el traslado. */
const CON_STOCK = randomUUID()
const CATEGORIA = randomUUID()
const VENTA = randomUUID()
/** Venta nueva: producto con 5 en el punto de venta y batido con opciones. */
const VENDIBLE = randomUUID()
const BATIDO = randomUUID()
const SIN_PROTEINA = randomUUID()

/** Fixtures con caso en este archivo. Uno nuevo sin caso hace fallar el primer test. */
const COVERED = [
  'adjust_stock',
  'create_sale',
  'audit_log_adjust',
  'audit_log_create_sale',
  'audit_log_product_create',
  'audit_log_product_update',
  'audit_log_transfer',
  'audit_log_void_sale',
  'create_product',
  'register_inventory_entry',
  'transfer_stock',
  'update_product',
  'void_sale',
]

const SEED_SQL = `
  begin;
  insert into public.tiendas (id, nombre, timezone) values (:'tienda', 'Paridad payloads iOS', 'America/Bogota');
  insert into public.user_tiendas (user_id, tienda_id, rol, is_active) values (:'admin', :'tienda', 'admin', true);
  insert into public.productos (id, tienda_id, nombre, tipo, precio_venta, costo, iva_tasa, stock_minimo, is_active)
    values (:'producto', :'tienda', 'Proteína contrato', 'simple', 100000, 60000, 0, 0, true),
           (:'con_stock', :'tienda', 'Creatina contrato', 'simple', 80000, 40000, 0, 0, true);
  insert into public.cash_sessions (tienda_id, opened_by, opening_amount, status) values (:'tienda', :'admin', 0, 'open');
  -- El trigger sales_enforce_cashier_identity exige que el cajero sea el usuario de la sesión.
  select set_config('request.jwt.claim.sub', :'admin', true);
  insert into public.sales (id, tienda_id, cash_session_id, sale_number, cashier_id, subtotal, total, idempotency_key)
    select :'venta', :'tienda', id, 'IOS-ANULAR-1', :'admin', 160000, 160000, 'ios-anular-' || :'tienda'
    from public.cash_sessions where tienda_id = :'tienda';
  insert into public.sale_items (sale_id, producto_id, producto_nombre, quantity, unit_price, unit_cost, total)
    values (:'venta', :'con_stock', 'Creatina contrato', 2, 80000, 40000, 160000);
  insert into public.payments (sale_id, metodo, amount) values (:'venta', 'cash', 160000);
  insert into public.productos (id, tienda_id, nombre, sku, tipo, precio_venta, costo, iva_tasa, stock_minimo, is_active) values
    (:'vendible', :'tienda', 'Vendible contrato', 'IOS-VEND-1', 'simple', 80000, 40000, 0, 0, true),
    (:'batido', :'tienda', 'Batido contrato', null, 'prepared', 15000, null, 0, 0, true);
  insert into public.product_options (id, tienda_id, producto_id, grupo, nombre, precio_extra, es_default, orden, is_active) values
    (gen_random_uuid(), :'tienda', :'batido', 'Proteína', 'Whey', 3000, true, 0, true),
    (:'sin_proteina', :'tienda', :'batido', 'Proteína', 'Sin proteína', 0, false, 1, true);
  insert into public.inventory_movements (tienda_id, producto_id, tipo, cantidad, ubicacion, motivo, created_by)
    values (:'tienda', :'vendible', 'entry', 5, 'punto_venta', 'Inventario inicial', :'admin');
  insert into public.categorias (id, tienda_id, nombre, orden, is_active) values (:'categoria', :'tienda', 'Creatinas', 0, true);
  insert into public.inventory_movements (tienda_id, producto_id, tipo, cantidad, ubicacion, motivo, created_by)
    values (:'tienda', :'con_stock', 'entry', 20, 'bodega', 'Inventario inicial', :'admin');
  commit;
`

async function levelOf(client: SupabaseClient, productId: string): Promise<{ punto_venta_stock: number; bodega_stock: number }> {
  const { data } = await client.rpc('get_stock_levels', { p_tienda_id: TIENDA })
  const level = (data as { producto_id: string; bodega_stock: number; punto_venta_stock: number }[]).find((l) => l.producto_id === productId)
  return { punto_venta_stock: Number(level?.punto_venta_stock ?? 0), bodega_stock: Number(level?.bodega_stock ?? 0) }
}

async function send(client: SupabaseClient, fixture: IosPayload): Promise<{ data: unknown; error: { code?: string; message?: string } | null }> {
  if (fixture.kind === 'rpc') return client.rpc(fixture.target, fixture.payload)
  if (fixture.kind === 'update') {
    return client.from(fixture.target).update(fixture.payload).match(fixture.match ?? {}).select().single()
  }
  return client.from(fixture.target).insert(fixture.payload).select().single()
}

describe('payloads de escritura de la app iOS contra el Supabase local', () => {
  let stack: LocalStack
  let admin: SupabaseClient
  let adminId: string
  const adminEmail = `paridad-ios-payloads-${TIENDA.slice(0, 8)}@local.test`

  beforeAll(async () => {
    stack = localStack()
    ;[adminId] = await createUsers(stack, [adminEmail])
    psql(stack, CLEANUP_SQL)
    psql(stack, SEED_SQL, { tienda: TIENDA, admin: adminId, producto: PRODUCTO, con_stock: CON_STOCK, categoria: CATEGORIA, venta: VENTA, vendible: VENDIBLE, batido: BATIDO, sin_proteina: SIN_PROTEINA })
    admin = await signIn(stack, adminEmail)
  })

  afterAll(async () => {
    if (!stack) return
    psql(stack, CLEANUP_SQL)
    await deleteUsers(stack, [adminId])
  })

  it('cada fixture tiene su caso de contrato', () => {
    expect(payloadNames()).toEqual([...COVERED].sort())
  })

  it('register_inventory_entry: crea la entrada en bodega con costo y motivo', async () => {
    const fixture = loadPayload('register_inventory_entry', { tienda_id: TIENDA, producto_id: PRODUCTO, user_id: adminId })
    const { data: movementId, error } = await send(admin, fixture)
    expect(error).toBeNull()

    const { data: movement } = await admin
      .from('inventory_movements')
      .select('tipo, ubicacion, cantidad, costo_unitario, motivo, created_by')
      .eq('id', movementId as string)
      .single()
    expect(movement).toEqual({
      tipo: 'entry',
      ubicacion: 'bodega',
      cantidad: 12,
      costo_unitario: 61500,
      motivo: 'Compra a proveedor',
      created_by: adminId,
    })

    const { data: levels } = await admin.rpc('get_stock_levels', { p_tienda_id: TIENDA })
    const level = (levels as { producto_id: string; bodega_stock: number; punto_venta_stock: number }[]).find((l) => l.producto_id === PRODUCTO)
    expect(level).toMatchObject({ bodega_stock: 12, punto_venta_stock: 0 })
  })

  it('audit_log_adjust: la política deja al admin registrar su propia auditoría', async () => {
    const entityId = randomUUID()
    const fixture = loadPayload('audit_log_adjust', {
      tienda_id: TIENDA,
      user_id: adminId,
      user_email: adminEmail,
      entity_id: entityId,
    })
    const { data, error } = await send(admin, fixture)
    expect(error).toBeNull()
    expect(data).toMatchObject({ ...fixture.payload, entity_id: entityId })
  })

  it('adjust_stock: resta en la ubicación indicada con su motivo', async () => {
    const before = await levelOf(admin, CON_STOCK)
    const fixture = loadPayload('adjust_stock', { tienda_id: TIENDA, producto_id: CON_STOCK, user_id: adminId })
    const { data, error } = await send(admin, fixture)
    expect(error).toBeNull()
    expect(data).toMatchObject({ tipo: 'adjustment', ubicacion: 'bodega', cantidad: -2, motivo: 'Conteo físico' })
    expect(await levelOf(admin, CON_STOCK)).toEqual({ ...before, bodega_stock: before.bodega_stock - 2 })
  })

  it('transfer_stock: mueve de bodega al punto de venta y devuelve el id del traslado', async () => {
    const before = await levelOf(admin, CON_STOCK)
    const fixture = loadPayload('transfer_stock', { tienda_id: TIENDA, producto_id: CON_STOCK, user_id: adminId })
    const { data: transferId, error } = await send(admin, fixture)
    expect(error).toBeNull()
    expect(typeof transferId).toBe('string')
    expect(await levelOf(admin, CON_STOCK)).toEqual({
      punto_venta_stock: before.punto_venta_stock + 4,
      bodega_stock: before.bodega_stock - 4,
    })
  })

  it('audit_log_transfer: la auditoría del traslado se guarda tal cual', async () => {
    const entityId = randomUUID()
    const fixture = loadPayload('audit_log_transfer', {
      tienda_id: TIENDA,
      user_id: adminId,
      user_email: adminEmail,
      entity_id: entityId,
    })
    const { data, error } = await send(admin, fixture)
    expect(error).toBeNull()
    expect(data).toMatchObject({ ...fixture.payload, entity_id: entityId })
  })

  it('create_product: crea el producto con su categoría y el stock inicial en bodega', async () => {
    const fixture = loadPayload('create_product', { tienda_id: TIENDA, categoria_id: CATEGORIA })
    const { data: productId, error } = await send(admin, fixture)
    expect(error, JSON.stringify(error)).toBeNull()
    const { data: product } = await admin
      .from('productos')
      .select('nombre, sku, codigo_barras, categoria_id, tipo, unidad, precio_venta, costo, iva_tasa, stock_minimo, is_active')
      .eq('id', productId as string)
      .single()
    expect(product).toEqual({
      nombre: 'Creatina contrato iOS',
      sku: 'IOS-CREA-300',
      codigo_barras: '7700000000017',
      categoria_id: CATEGORIA,
      tipo: 'simple',
      unidad: 'und',
      precio_venta: 95000,
      costo: 47000,
      iva_tasa: 0,
      stock_minimo: 2,
      is_active: true,
    })
    expect(await levelOf(admin, productId as string)).toEqual({ punto_venta_stock: 0, bodega_stock: 10 })

    // El SKU es único por tienda: repetirlo choca con ux_productos_tienda_sku (la app lo traduce).
    const again = await send(admin, loadPayload('create_product', { tienda_id: TIENDA, categoria_id: CATEGORIA }))
    expect(again.error?.code).toBe('23505')
    expect(again.error?.message).toContain('ux_productos_tienda_sku')
  })

  it('update_product: cambia solo lo enviado, vacía con null y el trigger audita el precio', async () => {
    const priceAudits = async () =>
      (await admin.from('audit_logs').select('id').eq('entity_id', PRODUCTO).eq('action', 'product.price_changed')).data ?? []
    const before = (await priceAudits()).length
    const fixture = loadPayload('update_product', { tienda_id: TIENDA, producto_id: PRODUCTO })
    const { data, error } = await send(admin, fixture)
    expect(error).toBeNull()
    expect(data).toMatchObject({
      nombre: 'Proteína contrato',
      precio_venta: 105000,
      costo: null,
      codigo_barras: null,
      stock_minimo: 3,
      iva_tasa: 0,
    })
    expect((await priceAudits()).length).toBe(before + 1)
  })

  it('void_sale: anula la venta con su motivo y devuelve el stock al punto de venta', async () => {
    const before = await levelOf(admin, CON_STOCK)
    const fixture = loadPayload('void_sale', { tienda_id: TIENDA, sale_id: VENTA, user_id: adminId })
    const { error } = await send(admin, fixture)
    expect(error).toBeNull()
    const { data: sale } = await admin.from('sales').select('status, voided_by, voided_reason').eq('id', VENTA).single()
    expect(sale).toEqual({ status: 'voided', voided_by: adminId, voided_reason: 'Cliente devolvió el producto sin abrir' })
    expect(await levelOf(admin, CON_STOCK)).toEqual({ ...before, punto_venta_stock: before.punto_venta_stock + 2 })

    // Anular dos veces se rechaza con el mensaje que la app traduce.
    const again = await send(admin, fixture)
    expect(again.error?.message).toContain('Venta no encontrada o ya anulada')
  })

  it('create_sale: el servidor recalcula, numera, descuenta el cambio del efectivo y saca el stock', async () => {
    const { data: session } = await admin.from('cash_sessions').select('id').eq('tienda_id', TIENDA).eq('status', 'open').single()
    const key = randomUUID()
    const vars = {
      tienda_id: TIENDA,
      cash_session_id: (session as { id: string }).id,
      user_id: adminId,
      idempotency_key: key,
      producto_id: VENDIBLE,
      batido_id: BATIDO,
      option_id: SIN_PROTEINA,
    }
    const { data: saleId, error } = await send(admin, loadPayload('create_sale', vars))
    expect(error).toBeNull()

    const { data: sale } = await admin
      .from('sales')
      .select('sale_number, status, total, subtotal, discount_total, payments(metodo, amount, referencia), sale_items(producto_nombre, quantity, unit_price, option_nombre, total)')
      .eq('id', saleId as string)
      .single()
    const row = sale as {
      sale_number: string
      payments: { metodo: string; amount: number; referencia: string | null }[]
      sale_items: { producto_nombre: string; quantity: number; unit_price: number; option_nombre: string | null; total: number }[]
    }
    expect(row).toMatchObject({ status: 'completed', total: 110000, subtotal: 110000, discount_total: 0 })
    expect(row.sale_number).toMatch(/^V-\d{6}$/)
    // El cambio (120.000 − 110.000) sale del efectivo: los pagos suman exactamente el total.
    expect([...row.payments].sort((a, b) => a.metodo.localeCompare(b.metodo))).toEqual([
      { metodo: 'cash', amount: 90000, referencia: null },
      { metodo: 'transfer', amount: 20000, referencia: 'TRX-123' },
    ])
    expect([...row.sale_items].sort((a, b) => a.total - b.total)).toEqual([
      { producto_nombre: 'Batido contrato', quantity: 2, unit_price: 15000, option_nombre: 'Sin proteína', total: 30000 },
      { producto_nombre: 'Vendible contrato', quantity: 1, unit_price: 80000, option_nombre: null, total: 80000 },
    ])
    expect(await levelOf(admin, VENDIBLE)).toEqual({ punto_venta_stock: 4, bodega_stock: 0 })

    // Reintento con la misma clave: devuelve la misma venta, no crea otra.
    const retry = await send(admin, loadPayload('create_sale', vars))
    expect(retry.data).toBe(saleId)
    const { count } = await admin.from('sales').select('id', { count: 'exact', head: true }).eq('idempotency_key', key)
    expect(count).toBe(1)
  })

  it.each(['audit_log_product_create', 'audit_log_product_update', 'audit_log_void_sale', 'audit_log_create_sale'])('%s: la auditoría del producto se guarda tal cual', async (name) => {
    const entityId = randomUUID()
    const fixture = loadPayload(name, { tienda_id: TIENDA, user_id: adminId, user_email: adminEmail, entity_id: entityId })
    const { data, error } = await send(admin, fixture)
    expect(error).toBeNull()
    expect(data).toMatchObject({ ...fixture.payload, entity_id: entityId })
  })
})
