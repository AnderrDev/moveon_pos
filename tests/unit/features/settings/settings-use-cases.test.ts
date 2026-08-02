import { describe, expect, it } from 'vitest'
import { saveReceiptSettings } from '@angular-app/features/settings/domain/usecases/save-receipt-settings.use-case'
import { saveLoyaltySettings } from '@angular-app/features/settings/domain/usecases/save-loyalty-settings.use-case'
import type { ReceiptSettings } from '@angular-app/features/settings/domain/entities/receipt-settings.entity'
import type { LoyaltyConfig } from '@angular-app/features/loyalty/domain/loyalty-config'

const receiptSettings: ReceiptSettings = {
  titulo: 'COMPROBANTE DE VENTA',
  nit: '900123456-1',
  direccion: 'Calle 10 # 20-30',
  ciudad: 'Medellín',
  telefono: '300 123 4567',
  mensajePie: 'Gracias por tu compra',
  mostrarNit: true,
  mostrarDireccion: true,
  mostrarTelefono: false,
  mostrarIva: true,
  mostrarIvaEnPos: false,
  imprimirAlFinalizarVenta: true,
  abrirCajonEnEfectivo: true,
  printerName: 'POS-58',
}

const loyaltyConfig: LoyaltyConfig = {
  activo: true,
  sellosParaRecompensa: 8,
  valorRecompensaCop: 11_000,
  vigenciaDias: 30,
}

describe('saveReceiptSettings', () => {
  it('delega en el repositorio con el valor recibido', async () => {
    let received: ReceiptSettings | null = null
    const repo = {
      save: async (value: ReceiptSettings) => {
        received = value
      },
    }
    await saveReceiptSettings({ repo }, receiptSettings)
    expect(received).toEqual(receiptSettings)
  })

  it('propaga los fallos del repositorio como throw', async () => {
    const repo = {
      save: async () => {
        throw new Error('No tienes permiso para cambiar la configuracion')
      },
    }
    await expect(saveReceiptSettings({ repo }, receiptSettings)).rejects.toThrow(
      'No tienes permiso para cambiar la configuracion',
    )
  })
})

describe('saveLoyaltySettings', () => {
  it('delega en el repositorio con el valor recibido', async () => {
    let received: LoyaltyConfig | null = null
    const repo = {
      save: async (value: LoyaltyConfig) => {
        received = value
      },
    }
    await saveLoyaltySettings({ repo }, loyaltyConfig)
    expect(received).toEqual(loyaltyConfig)
  })

  it('propaga los fallos del repositorio como throw', async () => {
    const repo = {
      save: async () => {
        throw new Error('Sesion expirada')
      },
    }
    await expect(saveLoyaltySettings({ repo }, loyaltyConfig)).rejects.toThrow('Sesion expirada')
  })
})
