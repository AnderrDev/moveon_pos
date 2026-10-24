import { z } from 'zod'
import {
  RECEIPT_TEXT_LIMITS,
  receiptPrinterNameSchema,
  receiptTituloSchema,
} from '@angular-app/features/settings/domain/dtos/receipt-settings.dto'

const optionalText = (max: number) => z.string().trim().max(max)

/** Borde del formulario: mismas reglas que `receiptSettingsSchema` (dominio), con textos vacíos como ''. */
export const receiptSettingsFormSchema = z.object({
  titulo: receiptTituloSchema,
  nit: optionalText(RECEIPT_TEXT_LIMITS.nit),
  direccion: optionalText(RECEIPT_TEXT_LIMITS.direccion),
  ciudad: optionalText(RECEIPT_TEXT_LIMITS.ciudad),
  telefono: optionalText(RECEIPT_TEXT_LIMITS.telefono),
  mensajePie: optionalText(RECEIPT_TEXT_LIMITS.mensajePie),
  printerName: receiptPrinterNameSchema,
  mostrarNit: z.boolean(),
  mostrarDireccion: z.boolean(),
  mostrarTelefono: z.boolean(),
  mostrarIva: z.boolean(),
  mostrarIvaEnPos: z.boolean(),
  imprimirAlFinalizarVenta: z.boolean(),
  abrirCajonEnEfectivo: z.boolean(),
})

export type ReceiptSettingsFormValue = z.infer<typeof receiptSettingsFormSchema>

export function createReceiptSettingsFormDefaults(
  initial: Partial<ReceiptSettingsFormValue> = {},
): ReceiptSettingsFormValue {
  return {
    titulo: initial.titulo ?? 'COMPROBANTE DE VENTA',
    nit: initial.nit ?? '',
    direccion: initial.direccion ?? '',
    ciudad: initial.ciudad ?? '',
    telefono: initial.telefono ?? '',
    mensajePie: initial.mensajePie ?? 'Gracias por tu compra. Vuelve pronto!',
    printerName: initial.printerName ?? 'POS-58',
    mostrarNit: initial.mostrarNit ?? true,
    mostrarDireccion: initial.mostrarDireccion ?? true,
    mostrarTelefono: initial.mostrarTelefono ?? true,
    mostrarIva: initial.mostrarIva ?? false,
    mostrarIvaEnPos: initial.mostrarIvaEnPos ?? true,
    imprimirAlFinalizarVenta: initial.imprimirAlFinalizarVenta ?? false,
    abrirCajonEnEfectivo: initial.abrirCajonEnEfectivo ?? true,
  }
}
