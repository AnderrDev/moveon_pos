import { inject, Injectable } from '@angular/core'
import { SupabaseClientService } from '../../core/supabase/supabase-client.service'

/** Proyección mínima cerrada del ADR 0016 — no ampliar sin ADR nuevo. */
export interface ClubProgress {
  primerNombre: string
  stampsBalance: number
  sellosParaRecompensa: number
  recompensasDisponibles: number
  recompensaValorCop: number | null
  proximaExpiracion: Date | null
}

interface ClubProgressRow {
  primer_nombre: string
  stamps_balance: number
  sellos_para_recompensa: number
  recompensas_disponibles: number
  recompensa_valor_cop: number | null
  proxima_expiracion: string | null
}

@Injectable({ providedIn: 'root' })
export class ClubProgressService {
  private readonly db = inject(SupabaseClientService)

  /**
   * Consulta pública por celular (RPC anon `storefront_club_progress`).
   * `null` = no encontrado/no autorizado/entrada inválida — la UI muestra
   * un único mensaje genérico (sin oráculo de existencia, ADR 0016).
   *
   * ⚠️ El RPC no existe en el proyecto remoto: su migración (20260723020000)
   * nunca se aplicó, así que en producción esto lanza PGRST202 y la sección
   * muestra el estado de error a todos. Ver docs/modules/catalogo.md.
   */
  async lookup(celular: string): Promise<ClubProgress | null> {
    // Los tipos generados marcan las columnas de retorno como no nulas;
    // `recompensa_valor_cop` y `proxima_expiracion` pueden venir NULL.
    const { data, error } = await this.db.supabase
      .rpc('storefront_club_progress', { p_celular: celular })
      .returns<ClubProgressRow[]>()
    if (error) throw new Error(error.message)
    const row = data?.[0]
    if (!row) return null
    return {
      primerNombre: row.primer_nombre,
      stampsBalance: row.stamps_balance,
      sellosParaRecompensa: row.sellos_para_recompensa,
      recompensasDisponibles: row.recompensas_disponibles,
      recompensaValorCop: row.recompensa_valor_cop,
      proximaExpiracion: row.proxima_expiracion ? new Date(row.proxima_expiracion) : null,
    }
  }
}
