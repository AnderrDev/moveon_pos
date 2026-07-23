import { describe, expect, it } from 'vitest'
import {
  createReceiptSettingsFormDefaults,
  receiptSettingsFormSchema,
} from '@angular-app/features/settings/presentation/forms/receipt-settings-form.factory'
import {
  receiptSettingsFormMapper,
  type ReceiptSettingsSource,
} from '@angular-app/features/settings/presentation/forms/receipt-settings-form.mapper'

const source: ReceiptSettingsSource = {
  titulo: 'MOVE ON GEAR',
  nit: '901234567-8',
  direccion: 'Cra 10 # 20-30',
  ciudad: 'Bogotá',
  telefono: '3012244006',
  mensajePie: 'Gracias por tu compra',
  printerName: 'POS-58',
  mostrarNit: true,
  mostrarDireccion: false,
  mostrarTelefono: true,
  mostrarIva: false,
  mostrarIvaEnPos: true,
  imprimirAlFinalizarVenta: false,
  abrirCajonEnEfectivo: true,
}

describe('receiptSettingsFormSchema', () => {
  const valid = createReceiptSettingsFormDefaults()

  it('acepta la configuración por defecto del comprobante', () => {
    expect(receiptSettingsFormSchema.safeParse(valid).success).toBe(true)
  })

  it('rechaza título de menos de 2 o más de 32 caracteres', () => {
    expect(receiptSettingsFormSchema.safeParse({ ...valid, titulo: 'A' }).success).toBe(false)
    expect(receiptSettingsFormSchema.safeParse({ ...valid, titulo: 'x'.repeat(33) }).success).toBe(
      false,
    )
  })

  it('rechaza nombre de impresora vacío o de más de 80 caracteres', () => {
    expect(receiptSettingsFormSchema.safeParse({ ...valid, printerName: '' }).success).toBe(false)
    expect(receiptSettingsFormSchema.safeParse({ ...valid, printerName: '   ' }).success).toBe(
      false,
    )
    expect(
      receiptSettingsFormSchema.safeParse({ ...valid, printerName: 'x'.repeat(81) }).success,
    ).toBe(false)
  })

  it('acepta textos opcionales vacíos y respeta sus máximos', () => {
    expect(receiptSettingsFormSchema.safeParse({ ...valid, nit: '' }).success).toBe(true)
    expect(receiptSettingsFormSchema.safeParse({ ...valid, nit: 'x'.repeat(31) }).success).toBe(
      false,
    )
    expect(
      receiptSettingsFormSchema.safeParse({ ...valid, direccion: 'x'.repeat(101) }).success,
    ).toBe(false)
    expect(receiptSettingsFormSchema.safeParse({ ...valid, ciudad: 'x'.repeat(61) }).success).toBe(
      false,
    )
    expect(
      receiptSettingsFormSchema.safeParse({ ...valid, telefono: 'x'.repeat(31) }).success,
    ).toBe(false)
    expect(
      receiptSettingsFormSchema.safeParse({ ...valid, mensajePie: 'x'.repeat(121) }).success,
    ).toBe(false)
  })
})

describe('createReceiptSettingsFormDefaults', () => {
  it('precarga título, mensaje de pie e impresora POS-58', () => {
    expect(createReceiptSettingsFormDefaults()).toEqual({
      titulo: 'COMPROBANTE DE VENTA',
      nit: '',
      direccion: '',
      ciudad: '',
      telefono: '',
      mensajePie: 'Gracias por tu compra. Vuelve pronto!',
      printerName: 'POS-58',
      mostrarNit: true,
      mostrarDireccion: true,
      mostrarTelefono: true,
      mostrarIva: false,
      mostrarIvaEnPos: true,
      imprimirAlFinalizarVenta: false,
      abrirCajonEnEfectivo: true,
    })
  })

  it('permite sobreescribir todos los valores iniciales', () => {
    const overrides = {
      titulo: 'MOVE ON GEAR',
      nit: '901234567-8',
      direccion: 'Cra 10 # 20-30',
      ciudad: 'Bogotá',
      telefono: '3012244006',
      mensajePie: 'Vuelve pronto',
      printerName: 'EPSON-TM20',
      mostrarNit: false,
      mostrarDireccion: false,
      mostrarTelefono: false,
      mostrarIva: true,
      mostrarIvaEnPos: false,
      imprimirAlFinalizarVenta: true,
      abrirCajonEnEfectivo: false,
    }
    expect(createReceiptSettingsFormDefaults(overrides)).toEqual(overrides)
  })
})

describe('receiptSettingsFormMapper.toFormValue', () => {
  it('convierte la configuración guardada a valores de formulario', () => {
    expect(receiptSettingsFormMapper.toFormValue(source)).toEqual({
      titulo: 'MOVE ON GEAR',
      nit: '901234567-8',
      direccion: 'Cra 10 # 20-30',
      ciudad: 'Bogotá',
      telefono: '3012244006',
      mensajePie: 'Gracias por tu compra',
      printerName: 'POS-58',
      mostrarNit: true,
      mostrarDireccion: false,
      mostrarTelefono: true,
      mostrarIva: false,
      mostrarIvaEnPos: true,
      imprimirAlFinalizarVenta: false,
      abrirCajonEnEfectivo: true,
    })
  })

  it('usa cadenas vacías para los textos null', () => {
    const formValue = receiptSettingsFormMapper.toFormValue({
      ...source,
      nit: null,
      direccion: null,
      ciudad: null,
      telefono: null,
      mensajePie: null,
    })
    expect(formValue.nit).toBe('')
    expect(formValue.direccion).toBe('')
    expect(formValue.ciudad).toBe('')
    expect(formValue.telefono).toBe('')
    expect(formValue.mensajePie).toBe('')
  })
})

describe('receiptSettingsFormMapper.toPayload', () => {
  it('limpia strings y convierte vacíos en null', () => {
    const payload = receiptSettingsFormMapper.toPayload({
      titulo: '  MOVE ON GEAR  ',
      nit: '  901234567-8  ',
      direccion: '   ',
      ciudad: '',
      telefono: ' 3012244006 ',
      mensajePie: '',
      printerName: '  POS-58  ',
      mostrarNit: true,
      mostrarDireccion: false,
      mostrarTelefono: true,
      mostrarIva: false,
      mostrarIvaEnPos: true,
      imprimirAlFinalizarVenta: true,
      abrirCajonEnEfectivo: false,
    })
    expect(payload).toEqual({
      titulo: 'MOVE ON GEAR',
      nit: '901234567-8',
      direccion: null,
      ciudad: null,
      telefono: '3012244006',
      mensajePie: null,
      printerName: 'POS-58',
      mostrarNit: true,
      mostrarDireccion: false,
      mostrarTelefono: true,
      mostrarIva: false,
      mostrarIvaEnPos: true,
      imprimirAlFinalizarVenta: true,
      abrirCajonEnEfectivo: false,
    })
  })

  it('round-trip config → form → payload sin pérdida', () => {
    const formValue = receiptSettingsFormMapper.toFormValue(source)
    expect(receiptSettingsFormMapper.toPayload(formValue)).toEqual(source)
  })
})
