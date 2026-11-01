import { describe, expect, it } from 'vitest'
import { splitProductSchema, splitUnitCost } from '@angular-app/features/inventory/domain/dtos/inventory.dto'
import { splitProduct } from '@angular-app/features/inventory/domain/usecases/split-product.use-case'
import {
  buildDemandHistories,
  isDemandMovement,
} from '@angular-app/features/inventory/domain/services/purchase-suggestions'
import {
  createSplitProductDefaults,
  splitProductFormSchema,
} from '@angular-app/features/inventory/presentation/forms/split-product-form.factory'
import { splitProductFormMapper } from '@angular-app/features/inventory/presentation/forms/split-product-form.mapper'
import type { InventoryMovement } from '@angular-app/features/inventory/domain/entities/inventory.entity'

const ORIGEN = '11111111-1111-4111-8111-111111111111'
const DESTINO = '22222222-2222-4222-8222-222222222222'

describe('fraccionar (PLAN-113)', () => {
  it('el costo de cada porción es costo del origen × abiertos ÷ porciones', () => {
    expect(splitUnitCost(90_000, 1, 30)).toBe(3_000)
    expect(splitUnitCost(90_000, 2, 55)).toBe(3_272.73)
    expect(splitUnitCost(90_000, 1, 0)).toBe(0)
  })

  it('el DTO exige origen y destino distintos y porciones enteras', () => {
    const base = { origenId: ORIGEN, cantidadOrigen: 1, destinoId: DESTINO, cantidadDestino: 30, ubicacion: 'punto_venta' }
    expect(splitProductSchema.safeParse(base).success).toBe(true)
    const same = splitProductSchema.safeParse({ ...base, destinoId: ORIGEN })
    expect(same.success).toBe(false)
    if (!same.success) expect(same.error.issues[0].path).toEqual(['destinoId'])
    expect(splitProductSchema.safeParse({ ...base, cantidadDestino: 2.5 }).success).toBe(false)
    expect(splitProductSchema.safeParse({ ...base, cantidadOrigen: 0 }).success).toBe(false)
  })

  it('el formulario arranca abriendo 1 y el mapper agrega el origen y limpia la nota', () => {
    const defaults = createSplitProductDefaults()
    expect(defaults.cantidadOrigen).toBe(1)
    expect(splitProductFormSchema.safeParse(defaults).success).toBe(false) // falta destino y porciones
    const value = { ...defaults, destinoId: DESTINO, cantidadDestino: 30, nota: '  se regaron 2  ' }
    expect(splitProductFormSchema.safeParse(value).success).toBe(true)
    expect(splitProductFormMapper.toPayload(value, ORIGEN)).toEqual({
      origenId: ORIGEN, cantidadOrigen: 1, destinoId: DESTINO, cantidadDestino: 30, ubicacion: 'punto_venta', nota: 'se regaron 2',
    })
    expect(splitProductFormMapper.toPayload({ ...value, nota: '' }, ORIGEN).nota).toBeUndefined()
  })

  it('el use-case valida y delega en el repositorio con tienda y autor', async () => {
    const calls: unknown[] = []
    const movement = { id: 'm' } as InventoryMovement
    const repo = { splitProduct: async (input: unknown) => { calls.push(input); return movement } }
    const ok = await splitProduct(
      { repo, tiendaId: 't', createdBy: 'u' },
      { origenId: ORIGEN, cantidadOrigen: 1, destinoId: DESTINO, cantidadDestino: 30, ubicacion: 'bodega' },
    )
    expect(ok.ok).toBe(true)
    expect(calls[0]).toMatchObject({ tiendaId: 't', createdBy: 'u', origenId: ORIGEN, destinoId: DESTINO, cantidadDestino: 30, ubicacion: 'bodega' })
    const bad = await splitProduct({ repo, tiendaId: 't', createdBy: 'u' }, { origenId: ORIGEN, destinoId: ORIGEN })
    expect(bad.ok).toBe(false)
  })

  it('los tarros abiertos para sachets cuentan como demanda del tarro en el asesor', () => {
    expect(isDemandMovement({ tipo: 'adjustment', cantidad: -1, referenciaTipo: 'product_split' })).toBe(true)
    expect(isDemandMovement({ tipo: 'adjustment', cantidad: 30, referenciaTipo: 'product_split' })).toBe(false)
    expect(isDemandMovement({ tipo: 'adjustment', cantidad: -1, referenciaTipo: null })).toBe(false)
    expect(isDemandMovement({ tipo: 'sale_exit', cantidad: -1 })).toBe(true)

    const now = new Date('2026-11-10T12:00:00Z')
    const day = (d: number) => new Date(Date.UTC(2026, 10, d, 15))
    const h = buildDemandHistories(
      [
        { productId: 'tarro', tipo: 'sale_exit', cantidad: -1, at: day(5) },
        { productId: 'tarro', tipo: 'adjustment', cantidad: -1, at: day(6), referenciaTipo: 'product_split' },
        { productId: 'tarro', tipo: 'adjustment', cantidad: -1, at: day(7), referenciaTipo: null },
        { productId: 'sachet', tipo: 'adjustment', cantidad: 30, at: day(6), referenciaTipo: 'product_split' },
      ],
      new Map([['tarro', 5], ['sachet', 30]]),
      { now, timezone: 'America/Bogota', days: 7 },
    )
    const tarro = h.get('tarro')!
    expect(tarro.consumption.reduce((a, b) => a + b, 0)).toBe(2)
    expect(h.get('sachet')!.consumption.reduce((a, b) => a + b, 0)).toBe(0)
  })
})
