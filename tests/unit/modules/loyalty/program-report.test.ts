import { describe, expect, it } from 'vitest'
import {
  buildLoyaltyProgramReport,
  type LoyaltyReportRange,
  type LoyaltyRewardSample,
  type LoyaltyTransactionSample,
} from '@/modules/loyalty/domain/services/program-report'

const RANGE: LoyaltyReportRange = {
  start: new Date('2026-07-01T05:00:00Z'), // 2026-07-01 00:00 America/Bogota
  end: new Date('2026-08-01T05:00:00Z'),
  now: new Date('2026-07-16T15:00:00Z'),
}

const tx = (
  overrides: Partial<LoyaltyTransactionSample> = {},
): LoyaltyTransactionSample => ({
  clienteId: 'c1',
  clienteNombre: 'Ana',
  type: 'earn',
  stampsDelta: 1,
  ...overrides,
})

const reward = (overrides: Partial<LoyaltyRewardSample> = {}): LoyaltyRewardSample => ({
  status: 'available',
  generatedAt: new Date('2026-07-10T12:00:00Z'),
  redeemedAt: null,
  expiresAt: new Date('2026-08-09T12:00:00Z'),
  ...overrides,
})

describe('buildLoyaltyProgramReport', () => {
  it('reporte vacío sin actividad', () => {
    const report = buildLoyaltyProgramReport([], [], RANGE)
    expect(report).toEqual({
      sellosOtorgados: 0,
      sellosRevertidos: 0,
      ajusteNeto: 0,
      recompensasGeneradas: 0,
      recompensasCanjeadas: 0,
      recompensasVencidas: 0,
      recompensasDisponiblesAhora: 0,
      clientesActivos: 0,
      topClientes: [],
    })
  })

  it('suma sellos otorgados, reversas y ajustes por separado', () => {
    const report = buildLoyaltyProgramReport(
      [
        tx({ stampsDelta: 3 }),
        tx({ stampsDelta: 2 }),
        tx({ type: 'void', stampsDelta: -2 }),
        tx({ type: 'adjustment', stampsDelta: -1 }),
        tx({ type: 'adjustment', stampsDelta: 4 }),
      ],
      [],
      RANGE,
    )
    expect(report.sellosOtorgados).toBe(5)
    expect(report.sellosRevertidos).toBe(2)
    expect(report.ajusteNeto).toBe(3)
    expect(report.clientesActivos).toBe(1)
  })

  it('cuenta recompensas generadas/canjeadas/vencidas dentro del período', () => {
    const report = buildLoyaltyProgramReport(
      [],
      [
        // Generada y canjeada en el período.
        reward({ status: 'redeemed', redeemedAt: new Date('2026-07-12T12:00:00Z') }),
        // Generada antes del período, vencida dentro (aunque el barrido no la marcó).
        reward({
          generatedAt: new Date('2026-06-05T12:00:00Z'),
          expiresAt: new Date('2026-07-05T12:00:00Z'),
        }),
        // Vencida dentro del período, ya marcada por el barrido.
        reward({
          status: 'expired',
          generatedAt: new Date('2026-06-08T12:00:00Z'),
          expiresAt: new Date('2026-07-08T12:00:00Z'),
        }),
        // Disponible y vigente ahora.
        reward(),
      ],
      RANGE,
    )
    expect(report.recompensasGeneradas).toBe(2)
    expect(report.recompensasCanjeadas).toBe(1)
    expect(report.recompensasVencidas).toBe(2)
    expect(report.recompensasDisponiblesAhora).toBe(1)
  })

  it('una recompensa canjeada nunca cuenta como vencida', () => {
    const report = buildLoyaltyProgramReport(
      [],
      [
        reward({
          status: 'redeemed',
          redeemedAt: new Date('2026-06-20T12:00:00Z'), // canje fuera del período
          expiresAt: new Date('2026-07-05T12:00:00Z'), // "vencería" dentro
        }),
      ],
      RANGE,
    )
    expect(report.recompensasVencidas).toBe(0)
    expect(report.recompensasCanjeadas).toBe(0)
  })

  it('ordena top clientes por sellos ganados y cuenta recompensas desbloqueadas', () => {
    const report = buildLoyaltyProgramReport(
      [
        tx({ clienteId: 'c1', clienteNombre: 'Ana', stampsDelta: 2 }),
        tx({ clienteId: 'c2', clienteNombre: 'Luis', stampsDelta: 6 }),
        tx({ clienteId: 'c2', clienteNombre: 'Luis', type: 'redeem', stampsDelta: -8 }),
        tx({ clienteId: 'c3', clienteNombre: null, stampsDelta: 2 }),
      ],
      [],
      RANGE,
    )
    expect(report.clientesActivos).toBe(3)
    expect(report.topClientes[0]).toMatchObject({
      clienteId: 'c2',
      nombre: 'Luis',
      sellosGanados: 6,
      recompensasDesbloqueadas: 1,
    })
    expect(report.topClientes[2]?.nombre).toBe('Cliente sin nombre')
  })

  it('respeta el límite del top', () => {
    const transactions = Array.from({ length: 15 }, (_, i) =>
      tx({ clienteId: `c${i}`, clienteNombre: `Cliente ${i}`, stampsDelta: i + 1 }),
    )
    const report = buildLoyaltyProgramReport(transactions, [], RANGE)
    expect(report.topClientes).toHaveLength(10)
    expect(report.clientesActivos).toBe(15)
    expect(report.topClientes[0]?.sellosGanados).toBe(15)
  })
})
