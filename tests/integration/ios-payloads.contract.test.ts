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

/** Fixtures con caso en este archivo. Uno nuevo sin caso hace fallar el primer test. */
const COVERED = ['adjust_stock', 'audit_log_adjust', 'audit_log_transfer', 'register_inventory_entry', 'transfer_stock']

const SEED_SQL = `
  insert into public.tiendas (id, nombre, timezone) values (:'tienda', 'Paridad payloads iOS', 'America/Bogota');
  insert into public.user_tiendas (user_id, tienda_id, rol, is_active) values (:'admin', :'tienda', 'admin', true);
  insert into public.productos (id, tienda_id, nombre, tipo, precio_venta, costo, iva_tasa, stock_minimo, is_active)
    values (:'producto', :'tienda', 'Proteína contrato', 'simple', 100000, 60000, 0, 0, true),
           (:'con_stock', :'tienda', 'Creatina contrato', 'simple', 80000, 40000, 0, 0, true);
  insert into public.inventory_movements (tienda_id, producto_id, tipo, cantidad, ubicacion, motivo, created_by)
    values (:'tienda', :'con_stock', 'entry', 20, 'bodega', 'Inventario inicial', :'admin');
`

async function levelOf(client: SupabaseClient, productId: string): Promise<{ punto_venta_stock: number; bodega_stock: number }> {
  const { data } = await client.rpc('get_stock_levels', { p_tienda_id: TIENDA })
  const level = (data as { producto_id: string; bodega_stock: number; punto_venta_stock: number }[]).find((l) => l.producto_id === productId)
  return { punto_venta_stock: Number(level?.punto_venta_stock ?? 0), bodega_stock: Number(level?.bodega_stock ?? 0) }
}

async function send(client: SupabaseClient, fixture: IosPayload): Promise<{ data: unknown; error: unknown }> {
  if (fixture.kind === 'rpc') return client.rpc(fixture.target, fixture.payload)
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
    psql(stack, SEED_SQL, { tienda: TIENDA, admin: adminId, producto: PRODUCTO, con_stock: CON_STOCK })
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
})
