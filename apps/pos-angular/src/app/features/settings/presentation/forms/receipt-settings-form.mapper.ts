import type { ReceiptSettingsFormValue } from '@angular-app/features/settings/presentation/forms/receipt-settings-form.factory'

export interface ReceiptSettingsSource {
  titulo: string
  nit: string | null
  direccion: string | null
  ciudad: string | null
  telefono: string | null
  mensajePie: string | null
  printerName: string
  mostrarNit: boolean
  mostrarDireccion: boolean
  mostrarTelefono: boolean
  mostrarIva: boolean
  mostrarIvaEnPos: boolean
  imprimirAlFinalizarVenta: boolean
  abrirCajonEnEfectivo: boolean
}

export interface ReceiptSettingsPayload {
  titulo: string
  nit: string | null
  direccion: string | null
  ciudad: string | null
  telefono: string | null
  mensajePie: string | null
  printerName: string
  mostrarNit: boolean
  mostrarDireccion: boolean
  mostrarTelefono: boolean
  mostrarIva: boolean
  mostrarIvaEnPos: boolean
  imprimirAlFinalizarVenta: boolean
  abrirCajonEnEfectivo: boolean
}

export const receiptSettingsFormMapper = {
  toFormValue(settings: ReceiptSettingsSource): ReceiptSettingsFormValue {
    return {
      titulo: settings.titulo,
      nit: settings.nit ?? '',
      direccion: settings.direccion ?? '',
      ciudad: settings.ciudad ?? '',
      telefono: settings.telefono ?? '',
      mensajePie: settings.mensajePie ?? '',
      printerName: settings.printerName,
      mostrarNit: settings.mostrarNit,
      mostrarDireccion: settings.mostrarDireccion,
      mostrarTelefono: settings.mostrarTelefono,
      mostrarIva: settings.mostrarIva,
      mostrarIvaEnPos: settings.mostrarIvaEnPos,
      imprimirAlFinalizarVenta: settings.imprimirAlFinalizarVenta,
      abrirCajonEnEfectivo: settings.abrirCajonEnEfectivo,
    }
  },

  toPayload(value: ReceiptSettingsFormValue): ReceiptSettingsPayload {
    const nullable = (text: string): string | null => text.trim() || null
    return {
      titulo: value.titulo.trim(),
      nit: nullable(value.nit),
      direccion: nullable(value.direccion),
      ciudad: nullable(value.ciudad),
      telefono: nullable(value.telefono),
      mensajePie: nullable(value.mensajePie),
      printerName: value.printerName.trim(),
      mostrarNit: value.mostrarNit,
      mostrarDireccion: value.mostrarDireccion,
      mostrarTelefono: value.mostrarTelefono,
      mostrarIva: value.mostrarIva,
      mostrarIvaEnPos: value.mostrarIvaEnPos,
      imprimirAlFinalizarVenta: value.imprimirAlFinalizarVenta,
      abrirCajonEnEfectivo: value.abrirCajonEnEfectivo,
    }
  },
}
