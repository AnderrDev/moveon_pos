import { Injectable } from '@angular/core'

export interface RuntimeConfig {
  supabaseUrl: string
  supabaseAnonKey: string
  appName: string
  sentryDsn?: string
  environment: string
}

@Injectable({ providedIn: 'root' })
export class AppConfigService {
  private config: RuntimeConfig | null = null

  async load(): Promise<RuntimeConfig> {
    if (this.config) return this.config

    // Ruta relativa (no "/runtime-config.json"): la app se sirve con
    // baseHref /catalogo/ detrás del proxy del POS, y la URL debe resolverse
    // contra ese base tanto en el proxy como en el dominio directo.
    const response = await fetch('runtime-config.json', { cache: 'no-store' })
    if (!response.ok) {
      throw new Error(
        '[AppConfig] No se pudo cargar /runtime-config.json. Ejecuta `pnpm config:generate`.',
      )
    }

    const parsed = (await response.json()) as Partial<RuntimeConfig>
    if (!parsed.supabaseUrl || !parsed.supabaseAnonKey) {
      throw new Error('[AppConfig] runtime-config.json esta incompleto')
    }

    this.config = {
      supabaseUrl: parsed.supabaseUrl,
      supabaseAnonKey: parsed.supabaseAnonKey,
      appName: parsed.appName ?? 'MOVEONAPP POS',
      sentryDsn: parsed.sentryDsn,
      environment: parsed.environment ?? 'development',
    }
    return this.config
  }

  get current(): RuntimeConfig {
    if (!this.config) {
      throw new Error('[AppConfig] no inicializado. Llama a load() antes de usarlo.')
    }
    return this.config
  }
}
