import { inject, Injectable } from '@angular/core'
import { SupabaseClientService } from '../supabase/supabase-client.service'

export interface ReceiptSettings {
  mensajePie: string | null
  mostrarNit: boolean
  mostrarTelefono: boolean
}

export interface TiendaInfo {
  id: string
  nombre: string
  nit: string | null
  direccion: string | null
  telefono: string | null
  ciudad: string | null
  receipt: ReceiptSettings
}

const DEFAULT_RECEIPT: ReceiptSettings = {
  mensajePie: 'Gracias por tu compra. ¡Vuelve pronto!',
  mostrarNit: true,
  mostrarTelefono: true,
}

interface TiendaRow {
  id: string
  nombre: string
  nit: string | null
  direccion: string | null
  telefono: string | null
  ciudad: string | null
}

interface SettingsRow {
  data: { recibo?: Partial<ReceiptSettings & { mensaje_pie: string }> } | null
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
        .select('id, nombre, nit, direccion, telefono, ciudad')
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
    return {
      id: tiendaRes.data.id,
      nombre: tiendaRes.data.nombre,
      nit: tiendaRes.data.nit,
      direccion: tiendaRes.data.direccion,
      telefono: tiendaRes.data.telefono,
      ciudad: tiendaRes.data.ciudad,
      receipt: {
        mensajePie:
          (recibo.mensajePie ?? recibo.mensaje_pie ?? DEFAULT_RECEIPT.mensajePie) ?? null,
        mostrarNit: recibo.mostrarNit ?? DEFAULT_RECEIPT.mostrarNit,
        mostrarTelefono: recibo.mostrarTelefono ?? DEFAULT_RECEIPT.mostrarTelefono,
      },
    }
  }
}
