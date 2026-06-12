import { z } from 'zod'

const optionalText = (max: number) => z.string().trim().max(max)

export const receiptSettingsFormSchema = z.object({
  titulo: z.string().trim().min(2, 'Escribe un titulo').max(32, 'Maximo 32 caracteres'),
  nit: optionalText(30),
  direccion: optionalText(100),
  ciudad: optionalText(60),
  telefono: optionalText(30),
  mensajePie: optionalText(120),
  printerName: z
    .string()
    .trim()
    .min(1, 'Escribe el nombre de la impresora')
    .max(80, 'Maximo 80 caracteres'),
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
