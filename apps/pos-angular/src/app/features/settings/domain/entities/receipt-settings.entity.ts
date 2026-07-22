/**
 * Configuración del comprobante de venta (tirilla térmica). TS puro
 * (ADR 0015 §6.1) — misma forma que `core/tienda/tienda-info.service.ts`
 * (`ReceiptSettings`, Angular) y que `ReceiptSettingsPayload`
 * (`presentation/forms/receipt-settings-form.mapper.ts`); `domain/` no
 * puede importar `core/`, así que se re-declara aquí como fuente única del
 * contrato de persistencia.
 */
export interface ReceiptSettings {
  titulo: string
  nit: string | null
  direccion: string | null
  ciudad: string | null
  telefono: string | null
  mensajePie: string | null
  mostrarNit: boolean
  mostrarDireccion: boolean
  mostrarTelefono: boolean
  mostrarIva: boolean
  mostrarIvaEnPos: boolean
  imprimirAlFinalizarVenta: boolean
  abrirCajonEnEfectivo: boolean
  printerName: string
}
