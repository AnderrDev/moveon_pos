import { describe, expect, it } from 'vitest'
import { saveReceiptSettings } from '@angular-app/features/settings/domain/usecases/save-receipt-settings.use-case'
import { saveLoyaltySettings } from '@angular-app/features/settings/domain/usecases/save-loyalty-settings.use-case'
import type { ReceiptSettings } from '@angular-app/features/settings/domain/entities/receipt-settings.entity'

const receipt: ReceiptSettings = {
  titulo: 'COMPROBANTE DE VENTA',
  nit: null,
  direccion: 'Calle 1 # 2-3',
  ciudad: null,
  telefono: null,
  mensajePie: 'Gracias',
  mostrarNit: true,
  mostrarDireccion: true,
  mostrarTelefono: false,
  mostrarIva: false,
  mostrarIvaEnPos: false,
  imprimirAlFinalizarVenta: false,
  abrirCajonEnEfectivo: true,
  printerName: 'POS-58',
}

describe('saveReceiptSettings', () => {
  it('guarda una configuración válida', async () => {
    let saved: unknown = null
    const result = await saveReceiptSettings({ repo: { save: async (v) => { saved = v } } }, receipt)
    expect(result).toEqual({ ok: true, value: undefined })
    expect(saved).toEqual(receipt)
  })

  it('rechaza título vacío o impresora sin nombre sin llamar al repositorio', async () => {
    let called = false
    const repo = { save: async () => { called = true } }
    expect((await saveReceiptSettings({ repo }, { ...receipt, titulo: ' ' })).ok).toBe(false)
    expect((await saveReceiptSettings({ repo }, { ...receipt, printerName: '' })).ok).toBe(false)
    expect((await saveReceiptSettings({ repo }, { ...receipt, nit: 'x'.repeat(31) })).ok).toBe(false)
    expect(called).toBe(false)
  })
})

describe('saveLoyaltySettings', () => {
  const config = { activo: true, sellosParaRecompensa: 8, valorRecompensaCop: 11000, vigenciaDias: 30 }

  it('guarda una configuración válida', async () => {
    let saved: unknown = null
    const result = await saveLoyaltySettings({ repo: { save: async (v) => { saved = v } } }, config)
    expect(result).toEqual({ ok: true, value: undefined })
    expect(saved).toEqual(config)
  })

  it('rechaza valores fuera de rango sin llamar al repositorio', async () => {
    let called = false
    const repo = { save: async () => { called = true } }
    expect((await saveLoyaltySettings({ repo }, { ...config, sellosParaRecompensa: 0 })).ok).toBe(false)
    expect((await saveLoyaltySettings({ repo }, { ...config, vigenciaDias: 400 })).ok).toBe(false)
    expect(called).toBe(false)
  })
})
