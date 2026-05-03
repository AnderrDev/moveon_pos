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
      this._client = createClient<Database>(supabaseUrl, supabaseAnonKey, {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
        },
      })
    }
    return this._client
  }
}
