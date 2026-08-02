import type {
  LoyaltyRewardStatus,
  LoyaltyTransactionType,
} from '@angular-app/features/loyalty/domain/entities/loyalty.entity'

/**
 * Agregados del programa MOVE ON Club para /reportes (PLAN-60).
 * Lógica pura: recibe filas ya consultadas y produce los KPIs del período.
 */

export interface LoyaltyTransactionSample {
  clienteId: string
  clienteNombre: string | null
  type: LoyaltyTransactionType
  stampsDelta: number
}

export interface LoyaltyRewardSample {
  status: LoyaltyRewardStatus
  generatedAt: Date
  redeemedAt: Date | null
  expiresAt: Date
}

export interface LoyaltyReportRange {
  /** Inicio del período (inclusive, UTC). */
  start: Date
  /** Fin del período (exclusivo, UTC). */
  end: Date
  /** Instante de evaluación para "disponibles ahora". */
  now: Date
}

export interface LoyaltyClientActivity {
  clienteId: string
  nombre: string
  sellosGanados: number
  recompensasDesbloqueadas: number
}

export interface LoyaltyProgramReport {
  /** Sellos otorgados por ventas en el período (transacciones `earn`). */
  sellosOtorgados: number
  /** Sellos devueltos por anulaciones en el período (valor absoluto). */
  sellosRevertidos: number
  /** Suma neta de ajustes manuales del período (puede ser negativa). */
  ajusteNeto: number
  /** Recompensas generadas en el período. */
  recompensasGeneradas: number
  /** Recompensas canjeadas en el período. */
  recompensasCanjeadas: number
  /** Recompensas cuya vigencia venció dentro del período sin canjearse. */
  recompensasVencidas: number
  /** Recompensas disponibles y vigentes al momento de la consulta. */
  recompensasDisponiblesAhora: number
  /** Clientes con al menos un movimiento en el ledger durante el período. */
  clientesActivos: number
  /** Clientes del período ordenados por sellos ganados (desc). */
  topClientes: LoyaltyClientActivity[]
}

const inRange = (date: Date, range: LoyaltyReportRange): boolean =>
  date.getTime() >= range.start.getTime() && date.getTime() < range.end.getTime()

/**
 * @param transactions Transacciones del ledger DEL PERÍODO (ya filtradas por fecha).
 * @param rewards Todas las recompensas de la tienda (el volumen es pequeño);
 *   la función las cruza contra el rango.
 */
export function buildLoyaltyProgramReport(
  transactions: LoyaltyTransactionSample[],
  rewards: LoyaltyRewardSample[],
  range: LoyaltyReportRange,
  topLimit = 10,
): LoyaltyProgramReport {
  let sellosOtorgados = 0
  let sellosRevertidos = 0
  let ajusteNeto = 0

  const byCliente = new Map<string, LoyaltyClientActivity>()

  for (const tx of transactions) {
    if (tx.type === 'earn') sellosOtorgados += tx.stampsDelta
    else if (tx.type === 'void') sellosRevertidos += Math.abs(tx.stampsDelta)
    else if (tx.type === 'adjustment') ajusteNeto += tx.stampsDelta

    let activity = byCliente.get(tx.clienteId)
    if (!activity) {
      activity = {
        clienteId: tx.clienteId,
        nombre: tx.clienteNombre ?? 'Cliente sin nombre',
        sellosGanados: 0,
        recompensasDesbloqueadas: 0,
      }
      byCliente.set(tx.clienteId, activity)
    }
    if (tx.type === 'earn') activity.sellosGanados += tx.stampsDelta
    // 'redeem' en el ledger = consumo de sellos al generar una recompensa.
    if (tx.type === 'redeem') activity.recompensasDesbloqueadas += 1
  }

  let recompensasGeneradas = 0
  let recompensasCanjeadas = 0
  let recompensasVencidas = 0
  let recompensasDisponiblesAhora = 0

  for (const reward of rewards) {
    if (inRange(reward.generatedAt, range)) recompensasGeneradas += 1
    if (reward.redeemedAt && inRange(reward.redeemedAt, range)) recompensasCanjeadas += 1
    // Una recompensa "vence en el período" si su vigencia terminó dentro del
    // rango y nunca se canjeó (aunque el barrido aún no la haya marcado).
    if (
      reward.redeemedAt === null &&
      (reward.status === 'expired' || reward.status === 'available') &&
      inRange(reward.expiresAt, range)
    ) {
      recompensasVencidas += 1
    }
    if (reward.status === 'available' && reward.expiresAt.getTime() > range.now.getTime()) {
      recompensasDisponiblesAhora += 1
    }
  }

  const topClientes = [...byCliente.values()]
    .sort(
      (a, b) =>
        b.sellosGanados - a.sellosGanados ||
        b.recompensasDesbloqueadas - a.recompensasDesbloqueadas ||
        a.nombre.localeCompare(b.nombre),
    )
    .slice(0, topLimit)

  return {
    sellosOtorgados,
    sellosRevertidos,
    ajusteNeto,
    recompensasGeneradas,
    recompensasCanjeadas,
    recompensasVencidas,
    recompensasDisponiblesAhora,
    clientesActivos: byCliente.size,
    topClientes,
  }
}
