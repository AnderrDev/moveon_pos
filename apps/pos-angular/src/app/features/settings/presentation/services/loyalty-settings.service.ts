import { inject, Injectable } from '@angular/core'
import { SessionService } from '@angular-app/core/auth/session.service'
import { SupabaseClientService } from '@angular-app/core/supabase/supabase-client.service'
import { TiendaInfoService } from '@angular-app/core/tienda/tienda-info.service'
import type { LoyaltyConfig } from '@angular-app/features/loyalty/domain/loyalty-config'
import type { Json } from '@/infrastructure/supabase/database.types'

interface SettingsRow {
  data: Json | null
}

/**
 * Lee y guarda `settings.data.fidelizacion` (PLAN-59). Solo admin. El RPC
 * `loyalty_program_config` lee esta misma clave al otorgar sellos y generar
 * recompensas, así que guardar aquí cambia el programa sin migración.
 */
@Injectable({ providedIn: 'root' })
export class LoyaltySettingsService {
  private readonly session = inject(SessionService)
  private readonly supabase = inject(SupabaseClientService)
  private readonly tiendaInfo = inject(TiendaInfoService)

  async load(): Promise<LoyaltyConfig> {
    const auth = await this.requireAdmin()
    return (await this.tiendaInfo.get(auth.tiendaId)).fidelizacion
  }

  async save(value: LoyaltyConfig): Promise<void> {
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
      fidelizacion: {
        activo: value.activo,
        sellosParaRecompensa: value.sellosParaRecompensa,
        valorRecompensaCop: value.valorRecompensaCop,
        vigenciaDias: value.vigenciaDias,
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
