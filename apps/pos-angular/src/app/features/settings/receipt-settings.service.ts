import { inject, Injectable } from '@angular/core'
import { SessionService } from '../../core/auth/session.service'
import { SupabaseClientService } from '../../core/supabase/supabase-client.service'
import { TiendaInfoService, type ReceiptSettings } from '../../core/tienda/tienda-info.service'
import type { ReceiptSettingsPayload } from '@/modules/settings/forms/receipt-settings-form.mapper'
import type { Json } from '@/infrastructure/supabase/database.types'

interface SettingsRow {
  data: Json | null
}

@Injectable({ providedIn: 'root' })
export class ReceiptSettingsService {
  private readonly session = inject(SessionService)
  private readonly supabase = inject(SupabaseClientService)
  private readonly tiendaInfo = inject(TiendaInfoService)

  async load(): Promise<ReceiptSettings> {
    const auth = await this.requireAdmin()
    return (await this.tiendaInfo.get(auth.tiendaId)).receipt
  }

  async save(value: ReceiptSettingsPayload): Promise<void> {
    const auth = await this.requireAdmin()
    const client = this.supabase.supabase
    const { data: current, error: readError } = await client
      .from('settings')
      .select('data')
      .eq('tienda_id', auth.tiendaId)
      .maybeSingle<SettingsRow>()

    if (readError) throw new Error(readError.message)

    const currentData = isJsonObject(current?.data) ? current.data : {}
    const nextData: Json = {
      ...currentData,
      recibo: {
        titulo: value.titulo,
        nit: value.nit,
        direccion: value.direccion,
        ciudad: value.ciudad,
        telefono: value.telefono,
        mensajePie: value.mensajePie,
        printerName: value.printerName,
        mostrarNit: value.mostrarNit,
        mostrarDireccion: value.mostrarDireccion,
        mostrarTelefono: value.mostrarTelefono,
        mostrarIva: value.mostrarIva,
        mostrarIvaEnPos: value.mostrarIvaEnPos,
        imprimirAlFinalizarVenta: value.imprimirAlFinalizarVenta,
        abrirCajonEnEfectivo: value.abrirCajonEnEfectivo,
      },
    }
    const { error } = await client.from('settings').upsert(
      {
        tienda_id: auth.tiendaId,
        data: nextData,
      },
      { onConflict: 'tienda_id' },
    )
    if (error) throw new Error(error.message)
    this.tiendaInfo.invalidate(auth.tiendaId)
  }

  private async requireAdmin() {
    const auth = await this.session.getAuthContext()
    if (!auth) throw new Error('Sesion expirada')
    if (auth.rol !== 'admin') throw new Error('No tienes permiso para cambiar la configuracion')
    return auth
  }
}

function isJsonObject(value: Json | null | undefined): value is Record<string, Json | undefined> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
