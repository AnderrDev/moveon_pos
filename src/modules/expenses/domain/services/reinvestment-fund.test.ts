import { describe, expect, it } from 'vitest'
import { buildReinvestmentFund } from './reinvestment-fund'

describe('buildReinvestmentFund', () => {
  it('calcula el disponible como saldo inicial + apartado − invertido', () => {
    const fund = buildReinvestmentFund({
      saldoInicial: 500_000,
      cogsAcumulado: 6_800_000,
      comprasAcumuladas: 6_700_000,
      cogsMes: 1_200_000,
      comprasMes: 900_000,
      ventasSinCosto: 2,
      entradasSinCosto: 3,
    })
    expect(fund.disponible).toBe(600_000)
    expect(fund.saldoInicial).toBe(500_000)
    expect(fund.apartadoAcumulado).toBe(6_800_000)
    expect(fund.invertidoAcumulado).toBe(6_700_000)
    expect(fund.apartadoMes).toBe(1_200_000)
    expect(fund.invertidoMes).toBe(900_000)
    expect(fund.ventasSinCosto).toBe(2)
    expect(fund.entradasSinCosto).toBe(3)
  })

  it('permite disponible negativo cuando se invirtió más de lo apartado', () => {
    const fund = buildReinvestmentFund({
      saldoInicial: 0,
      cogsAcumulado: 100_000,
      comprasAcumuladas: 350_000,
      cogsMes: 0,
      comprasMes: 0,
      ventasSinCosto: 0,
      entradasSinCosto: 0,
    })
    expect(fund.disponible).toBe(-250_000)
  })

  it('fondo recién configurado sin movimientos queda en el saldo inicial', () => {
    const fund = buildReinvestmentFund({
      saldoInicial: 1_000_000,
      cogsAcumulado: 0,
      comprasAcumuladas: 0,
      cogsMes: 0,
      comprasMes: 0,
      ventasSinCosto: 0,
      entradasSinCosto: 0,
    })
    expect(fund.disponible).toBe(1_000_000)
    expect(fund.apartadoMes).toBe(0)
    expect(fund.invertidoMes).toBe(0)
  })
})
