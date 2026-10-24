import { z } from 'zod'
import type { ReceiptSettings } from '@angular-app/features/settings/domain/entities/receipt-settings.entity'

/**
 * Reglas de la configuración del comprobante. Fuente única: el formulario de
 * /configuracion (`receipt-settings-form.factory.ts`) se construye con estos
 * mismos campos; aquí los textos opcionales ya llegan como `null` si van vacíos.
 */
export const RECEIPT_TEXT_LIMITS = {
  nit: 30,
  direccion: 100,
  ciudad: 60,
  telefono: 30,
  mensajePie: 120,
} as const

export const receiptTituloSchema = z.string().trim().min(2, 'Escribe un titulo').max(32, 'Maximo 32 caracteres')

export const receiptPrinterNameSchema = z
  .string()
  .trim()
  .min(1, 'Escribe el nombre de la impresora')
  .max(80, 'Maximo 80 caracteres')

const nullableText = (max: number) => z.string().trim().max(max).nullable()

export const receiptSettingsSchema = z.object({
  titulo: receiptTituloSchema,
  nit: nullableText(RECEIPT_TEXT_LIMITS.nit),
  direccion: nullableText(RECEIPT_TEXT_LIMITS.direccion),
  ciudad: nullableText(RECEIPT_TEXT_LIMITS.ciudad),
  telefono: nullableText(RECEIPT_TEXT_LIMITS.telefono),
  mensajePie: nullableText(RECEIPT_TEXT_LIMITS.mensajePie),
  printerName: receiptPrinterNameSchema,
  mostrarNit: z.boolean(),
  mostrarDireccion: z.boolean(),
  mostrarTelefono: z.boolean(),
  mostrarIva: z.boolean(),
  mostrarIvaEnPos: z.boolean(),
  imprimirAlFinalizarVenta: z.boolean(),
  abrirCajonEnEfectivo: z.boolean(),
}) satisfies z.ZodType<ReceiptSettings>
