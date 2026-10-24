import { inject, Injectable } from '@angular/core'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { AppConfigService } from '../config/app-config.service'
import type { Database } from '@/infrastructure/supabase/database.types'

@Injectable({ providedIn: 'root' })
export class SupabaseClientService {
  private readonly appConfig = inject(AppConfigService)
  private _client: SupabaseClient<Database> | null = null

  get supabase(): SupabaseClient<Database> {
    if (!this._client) {
      const { supabaseUrl, supabaseAnonKey } = this.appConfig.current
      // La landing es 100% anónima (vistas públicas + RPC anon): no hay login
      // ni sesión que refrescar. `detectSessionInUrl` además inspeccionaría el
      // fragmento en cada carga, y esta página navega por anclas (#catalogo).
      this._client = createClient<Database>(supabaseUrl, supabaseAnonKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false,
        },
      })
    }
    return this._client
  }
}
