import { describe, expect, it } from 'vitest'
import { registerEntryFormSchema } from '@angular-app/features/inventory/presentation/forms/register-entry-form.factory'
import { registerEntryFormMapper } from '@angular-app/features/inventory/presentation/forms/register-entry-form.mapper'
import {
  adjustStockFormSchema,
  createAdjustStockDefaults,
} from '@angular-app/features/inventory/presentation/forms/adjust-stock-form.factory'
import { adjustStockFormMapper } from '@angular-app/features/inventory/presentation/forms/adjust-stock-form.mapper'
import {
  createTransferStockDefaults,
  transferStockFormSchema,
} from '@angular-app/features/inventory/presentation/forms/transfer-stock-form.factory'
import { transferStockFormMapper } from '@angular-app/features/inventory/presentation/forms/transfer-stock-form.mapper'
import { registerEntrySchema, transferStockSchema } from '@angular-app/features/inventory/domain/dtos/inventory.dto'

const PRODUCT = '11111111-1111-4111-8111-111111111111'
const messages = (result: { error?: { issues: { path: PropertyKey[]; message: string }[] } }) =>
  Object.fromEntries((result.error?.issues ?? []).map((i) => [String(i.path[0]), i.message]))

describe('entrada de mercancía', () => {
  it('arranca con el costo vigente y omite costo 0 y motivo vacío al enviar', () => {
    const value = registerEntryFormMapper.toFormValue({ costo: 42_000 })
    expect(value).toEqual({ cantidad: 1, ubicacion: 'punto_venta', costoUnitario: 42_000, motivo: '', metodoPago: '' })
    const parsed = registerEntryFormSchema.parse({ ...value, costoUnitario: 0, motivo: '   ' })
    expect(registerEntryFormMapper.toPayload(parsed, PRODUCT)).toEqual({
      productId: PRODUCT,
      cantidad: 1,
      ubicacion: 'punto_venta',
      costoUnitario: undefined,
      motivo: undefined,
      metodoPago: undefined,
    })
  })

  it('rechaza cantidad 0 y costo negativo', () => {
    expect(messages(registerEntryFormSchema.safeParse({ cantidad: 0, ubicacion: 'bodega', costoUnitario: -1, motivo: '', metodoPago: '' }))).toEqual({
      cantidad: 'La cantidad debe ser mayor a 0',
      costoUnitario: 'El costo no puede ser negativo',
    })
  })
})

describe('pago de la entrada', () => {
  const base = { cantidad: 3, ubicacion: 'punto_venta' as const, motivo: '' }

  it('envía el método elegido', () => {
    const parsed = registerEntryFormSchema.parse({ ...base, costoUnitario: 52_000, metodoPago: 'efectivo_caja' })
    expect(registerEntryFormMapper.toPayload(parsed, PRODUCT)).toMatchObject({ costoUnitario: 52_000, metodoPago: 'efectivo_caja' })
  })

  it('pagar con efectivo de caja exige costo, en el formulario y en el DTO', () => {
    const form = { ...base, costoUnitario: 0, metodoPago: 'efectivo_caja' as const }
    expect(messages(registerEntryFormSchema.safeParse(form))).toEqual({
      costoUnitario: 'Para pagar con efectivo de caja registra el costo de la compra',
    })
    expect(registerEntrySchema.safeParse({ productId: PRODUCT, cantidad: 3, metodoPago: 'efectivo_caja' }).success).toBe(false)
  })

  it('otros métodos no exigen costo', () => {
    expect(registerEntryFormSchema.safeParse({ ...base, costoUnitario: 0, metodoPago: 'transferencia' }).success).toBe(true)
    expect(registerEntrySchema.safeParse({ productId: PRODUCT, cantidad: 3, metodoPago: 'transferencia' }).success).toBe(true)
  })

  it('rechaza un método desconocido', () => {
    expect(registerEntrySchema.safeParse({ productId: PRODUCT, cantidad: 1, metodoPago: 'fiado' }).success).toBe(false)
  })
})

describe('ajuste de stock', () => {
  it('exige variación distinta de cero y motivo, recortado', () => {
    expect(messages(adjustStockFormSchema.safeParse(createAdjustStockDefaults()))).toEqual({
      cantidadDelta: 'El ajuste no puede ser cero',
      motivo: 'Describe el motivo del ajuste',
    })
    const parsed = adjustStockFormSchema.parse({ cantidadDelta: -3, ubicacion: 'punto_venta', motivo: ' Conteo físico ' })
    expect(adjustStockFormMapper.toPayload(parsed, PRODUCT)).toEqual({
      productId: PRODUCT,
      cantidadDelta: -3,
      ubicacion: 'punto_venta',
      motivo: 'Conteo físico',
    })
  })
})

describe('traslado', () => {
  it('formulario y DTO comparten la regla origen ≠ destino', () => {
    const same = { ...createTransferStockDefaults(), toUbicacion: 'bodega' as const, motivo: 'Reposición' }
    expect(messages(transferStockFormSchema.safeParse(same))).toEqual({
      toUbicacion: 'El origen y destino deben ser diferentes',
    })
    expect(transferStockSchema.safeParse({ ...same, productId: PRODUCT }).success).toBe(false)
  })

  it('envía el payload que acepta el DTO', () => {
    const parsed = transferStockFormSchema.parse({ ...createTransferStockDefaults(), cantidad: 4, motivo: ' Reposición PV ' })
    const payload = transferStockFormMapper.toPayload(parsed, PRODUCT)
    expect(payload).toEqual({ productId: PRODUCT, fromUbicacion: 'bodega', toUbicacion: 'punto_venta', cantidad: 4, motivo: 'Reposición PV' })
    expect(transferStockSchema.safeParse(payload).success).toBe(true)
  })
})
