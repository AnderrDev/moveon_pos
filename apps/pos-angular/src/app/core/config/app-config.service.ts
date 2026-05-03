import { Injectable } from '@angular/core'

export interface RuntimeConfig {
  supabaseUrl: string
  supabaseAnonKey: string
  appName: string
}

@Injectable({ providedIn: 'root' })
export class AppConfigService {
  private config: RuntimeConfig | null = null

  async load(): Promise<RuntimeConfig> {
    if (this.config) return this.config

    const response = await fetch('/runtime-config.json', { cache: 'no-store' })
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
