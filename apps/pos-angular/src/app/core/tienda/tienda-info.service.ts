import { inject, Injectable } from '@angular/core'
import { SupabaseClientService } from '../supabase/supabase-client.service'
import { DEFAULT_TIMEZONE } from '@angular-app/features/reports/domain/services/day-range'
import {
  DEFAULT_LOYALTY_CONFIG,
  type LoyaltyConfig,
} from '@angular-app/features/loyalty/domain/loyalty-config'

interface ReceiptSettings {
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

export interface TiendaInfo {
  id: string
  nombre: string
  nit: string | null
  direccion: string | null
  telefono: string | null
  ciudad: string | null
  timezone: string
  receipt: ReceiptSettings
  fidelizacion: LoyaltyConfig
}

const DEFAULT_RECEIPT: ReceiptSettings = {
  titulo: 'COMPROBANTE DE VENTA',
  nit: null,
  direccion: null,
  ciudad: null,
  telefono: null,
  mensajePie: 'Gracias por tu compra. ¡Vuelve pronto!',
  mostrarNit: true,
  mostrarDireccion: true,
  mostrarTelefono: true,
  mostrarIva: false,
  mostrarIvaEnPos: true,
  imprimirAlFinalizarVenta: false,
  abrirCajonEnEfectivo: true,
  printerName: 'POS-58',
}

interface TiendaRow {
  id: string
  nombre: string
  nit: string | null
  direccion: string | null
  telefono: string | null
  ciudad: string | null
  timezone: string | null
}

interface SettingsRow {
  data: {
    recibo?: Partial<ReceiptSettings & { mensaje_pie: string }>
    fidelizacion?: Partial<LoyaltyConfig>
  } | null
}

@Injectable({ providedIn: 'root' })
export class TiendaInfoService {
  private readonly supabaseClient = inject(SupabaseClientService)
  private cache = new Map<string, TiendaInfo>()
  private inflight = new Map<string, Promise<TiendaInfo>>()

  async get(tiendaId: string): Promise<TiendaInfo> {
    const cached = this.cache.get(tiendaId)
    if (cached) return cached
    const pending = this.inflight.get(tiendaId)
    if (pending) return pending

    const promise = this.load(tiendaId)
    this.inflight.set(tiendaId, promise)
    try {
      const info = await promise
      this.cache.set(tiendaId, info)
      return info
    } finally {
      this.inflight.delete(tiendaId)
    }
  }

  invalidate(tiendaId?: string): void {
    if (tiendaId) this.cache.delete(tiendaId)
    else this.cache.clear()
  }

  private async load(tiendaId: string): Promise<TiendaInfo> {
    const client = this.supabaseClient.supabase
    const [tiendaRes, settingsRes] = await Promise.all([
      client
        .from('tiendas')
        .select('id, nombre, nit, direccion, telefono, ciudad, timezone')
        .eq('id', tiendaId)
        .single<TiendaRow>(),
      client
        .from('settings')
        .select('data')
        .eq('tienda_id', tiendaId)
        .maybeSingle<SettingsRow>(),
    ])

    if (tiendaRes.error || !tiendaRes.data) {
      throw new Error(tiendaRes.error?.message ?? 'Tienda no encontrada')
    }

    const recibo = settingsRes.data?.data?.recibo ?? {}
    const fidelizacion = settingsRes.data?.data?.fidelizacion ?? {}
    return {
      id: tiendaRes.data.id,
      nombre: tiendaRes.data.nombre,
      nit: tiendaRes.data.nit,
      direccion: tiendaRes.data.direccion,
      telefono: tiendaRes.data.telefono,
      ciudad: tiendaRes.data.ciudad,
      timezone: tiendaRes.data.timezone ?? DEFAULT_TIMEZONE,
      receipt: {
        titulo: recibo.titulo ?? DEFAULT_RECEIPT.titulo,
        nit: recibo.nit !== undefined ? recibo.nit : tiendaRes.data.nit,
        direccion:
          recibo.direccion !== undefined ? recibo.direccion : tiendaRes.data.direccion,
        ciudad: recibo.ciudad !== undefined ? recibo.ciudad : tiendaRes.data.ciudad,
        telefono: recibo.telefono !== undefined ? recibo.telefono : tiendaRes.data.telefono,
        mensajePie:
          (recibo.mensajePie ?? recibo.mensaje_pie ?? DEFAULT_RECEIPT.mensajePie) ?? null,
        mostrarNit: recibo.mostrarNit ?? DEFAULT_RECEIPT.mostrarNit,
        mostrarDireccion: recibo.mostrarDireccion ?? DEFAULT_RECEIPT.mostrarDireccion,
        mostrarTelefono: recibo.mostrarTelefono ?? DEFAULT_RECEIPT.mostrarTelefono,
        mostrarIva: recibo.mostrarIva ?? DEFAULT_RECEIPT.mostrarIva,
        mostrarIvaEnPos: recibo.mostrarIvaEnPos ?? DEFAULT_RECEIPT.mostrarIvaEnPos,
        imprimirAlFinalizarVenta:
          recibo.imprimirAlFinalizarVenta ?? DEFAULT_RECEIPT.imprimirAlFinalizarVenta,
        abrirCajonEnEfectivo:
          recibo.abrirCajonEnEfectivo ?? DEFAULT_RECEIPT.abrirCajonEnEfectivo,
        printerName: recibo.printerName ?? DEFAULT_RECEIPT.printerName,
      },
      // Misma fuente que el RPC loyalty_program_config: settings.data.fidelizacion
      // con los defaults del programa (8 / $11.000 / 30 días).
      fidelizacion: {
        activo: fidelizacion.activo ?? DEFAULT_LOYALTY_CONFIG.activo,
        sellosParaRecompensa: Math.max(
          1,
          fidelizacion.sellosParaRecompensa ?? DEFAULT_LOYALTY_CONFIG.sellosParaRecompensa,
        ),
        valorRecompensaCop: Math.max(
          0,
          fidelizacion.valorRecompensaCop ?? DEFAULT_LOYALTY_CONFIG.valorRecompensaCop,
        ),
        vigenciaDias: Math.max(
          1,
          fidelizacion.vigenciaDias ?? DEFAULT_LOYALTY_CONFIG.vigenciaDias,
        ),
      },
    }
  }
}
