import { describe, expect, it } from 'vitest'
import {
  buildMoneyEnvelopes,
  type MoneyEnvelopesInput,
} from '@angular-app/features/expenses/domain/services/money-envelopes'
import {
  buildFinanceAdvice,
  inventoryCoverage,
} from '@angular-app/features/expenses/domain/services/finance-advice'

/** Un mes como octubre de 2026 en producción (ADR 0025): vende 14,3 M, costo 7,8 M, gastos 4,3 M + 0,5 M. */
function octubre(overrides: Partial<MoneyEnvelopesInput> = {}): MoneyEnvelopesInput {
  return {
    saldosIniciales: { mercancia: 0, utilidad: 0 },
    entradasAcumuladas: 14_263_550,
    entradasMes: 14_263_550,
    cogsAcumulado: 7_849_468,
    cogsMes: 7_849_468,
    comprasAcumuladas: 7_434_407,
    comprasMes: 7_434_407,
    fijosPagadosAcumulados: 4_300_000,
    fijosPagadosMes: 4_300_000,
    variablesAcumulados: 525_950,
    variablesMes: 525_950,
    retirosAcumulados: 0,
    retirosMes: 0,
    cogsUltimos28Dias: 7_300_000,
    ventasSinCosto: 0,
    entradasSinCosto: 0,
    ...overrides,
  }
}

describe('buildMoneyEnvelopes', () => {
  it('separa mercancía, gastos y utilidad; la utilidad es lo que sobra', () => {
    const e = buildMoneyEnvelopes(octubre())
    expect(e.sobres.mercancia.apartadoAcumulado).toBe(7_849_468)
    expect(e.sobres.mercancia.disponible).toBe(7_849_468 - 7_434_407)
    expect(e.sobres.gastos.apartadoAcumulado).toBe(4_300_000 + 525_950)
    expect(e.sobres.gastos.disponible).toBe(0)
    expect(e.sobres.utilidad.apartadoAcumulado).toBe(14_263_550 - 7_849_468 - 4_825_950)
    expect(e.sobres.utilidad.disponible).toBe(1_588_132)
  })

  it('los sobres suman exactamente lo que entró', () => {
    const e = buildMoneyEnvelopes(octubre())
    const apartado = Object.values(e.sobres).reduce((s, x) => s + x.apartadoAcumulado, 0)
    expect(apartado).toBe(e.entradasAcumuladas)
  })

  it('los gastos solo restan cuando se registran: sin arriendo registrado la utilidad sube', () => {
    const e = buildMoneyEnvelopes(octubre({ fijosPagadosAcumulados: 0, fijosPagadosMes: 0 }))
    expect(e.sobres.gastos.apartadoAcumulado).toBe(525_950)
    expect(e.sobres.utilidad.disponible).toBe(1_588_132 + 4_300_000)
  })

  it('comprar más de lo vendido al costo deja mercancía en negativo (septiembre)', () => {
    const e = buildMoneyEnvelopes(octubre({ cogsAcumulado: 8_010_831, comprasAcumuladas: 18_438_015 }))
    expect(e.sobres.mercancia.disponible).toBe(8_010_831 - 18_438_015)
  })

  it('los retiros salen del sobre de utilidad y pueden dejarlo en negativo', () => {
    const e = buildMoneyEnvelopes(octubre({ retirosAcumulados: 2_000_000, retirosMes: 2_000_000 }))
    expect(e.sobres.utilidad.usadoAcumulado).toBe(2_000_000)
    expect(e.sobres.utilidad.disponible).toBe(1_588_132 - 2_000_000)
  })

  it('los saldos iniciales se suman a su sobre', () => {
    const e = buildMoneyEnvelopes(octubre({ saldosIniciales: { mercancia: 1_000_000, utilidad: 250_000 } }))
    expect(e.sobres.mercancia.disponible).toBe(1_000_000 + 7_849_468 - 7_434_407)
    expect(e.sobres.utilidad.disponible).toBe(250_000 + 1_588_132)
  })

  it('día 1 del mes: vendido 69.000, costo 31.422, sin gastos → utilidad 37.578', () => {
    const e = buildMoneyEnvelopes(
      octubre({
        entradasAcumuladas: 69_000, cogsAcumulado: 31_422, comprasAcumuladas: 0,
        fijosPagadosAcumulados: 0, variablesAcumulados: 0,
      }),
    )
    expect(e.sobres.mercancia.disponible).toBe(31_422)
    expect(e.sobres.utilidad.disponible).toBe(37_578)
  })
})

describe('inventoryCoverage', () => {
  it('76 días con meta 45 es rojo (producción al 2026-11-01)', () => {
    const c = inventoryCoverage({ inventarioAlCosto: 20_584_752, cogsUltimos28Dias: 7_600_000, metaDias: 45 })
    expect(c.dias).toBe(76)
    expect(c.nivel).toBe('rojo')
  })

  it('entre la meta y 1,5 veces la meta es ámbar; por debajo verde', () => {
    expect(inventoryCoverage({ inventarioAlCosto: 15_000_000, cogsUltimos28Dias: 7_000_000, metaDias: 45 }).nivel).toBe('ambar')
    expect(inventoryCoverage({ inventarioAlCosto: 10_000_000, cogsUltimos28Dias: 7_000_000, metaDias: 45 }).nivel).toBe('verde')
  })

  it('sin inventario o sin ventas recientes no hay semáforo', () => {
    expect(inventoryCoverage({ inventarioAlCosto: null, cogsUltimos28Dias: 100, metaDias: 45 }).nivel).toBe('sin_datos')
    expect(inventoryCoverage({ inventarioAlCosto: 100, cogsUltimos28Dias: 0, metaDias: 45 }).nivel).toBe('sin_datos')
  })
})

describe('buildFinanceAdvice', () => {
  it('dice cuánto comprar y cuánto retirar', () => {
    const r = buildFinanceAdvice({
      envelopes: buildMoneyEnvelopes(octubre()),
      inventarioAlCosto: 20_000_000,
      cogsUltimos28Dias: 7_300_000,
      hayRetiros: true,
    })
    expect(r.consejos).toContainEqual({ code: 'comprar', disponible: 415_061 })
    expect(r.consejos).toContainEqual({ code: 'retirar', disponible: 1_588_132 })
    expect(r.inventario.metaDias).toBe(45)
    expect(r.inventario.nivel).toBe('rojo')
  })

  it('avisa cuando se compró o retiró de más', () => {
    const r = buildFinanceAdvice({
      envelopes: buildMoneyEnvelopes(octubre({ comprasAcumuladas: 9_000_000, retirosAcumulados: 3_000_000 })),
      inventarioAlCosto: null,
      cogsUltimos28Dias: 0,
      hayRetiros: true,
    })
    expect(r.consejos).toContainEqual({ code: 'comprar_exceso', exceso: 9_000_000 - 7_849_468 })
    expect(r.consejos).toContainEqual({ code: 'retirar_exceso', exceso: 3_000_000 - 1_588_132 })
    expect(r.inventario.nivel).toBe('sin_datos')
  })

  it('utilidad en negativo sin retiros es "aún no hay utilidad", no "retiraste de más"', () => {
    const r = buildFinanceAdvice({
      envelopes: buildMoneyEnvelopes(
        octubre({ entradasAcumuladas: 1_000_000, cogsAcumulado: 600_000, comprasAcumuladas: 0 }),
      ),
      inventarioAlCosto: 1,
      cogsUltimos28Dias: 1,
      hayRetiros: false,
    })
    expect(r.consejos).toContainEqual({ code: 'sin_utilidad', faltante: 4_825_950 - 400_000 })
    expect(r.consejos.some((c) => c.code === 'retirar_exceso')).toBe(false)
    expect(r.consejos.some((c) => c.code === 'sin_retiros')).toBe(false)
  })

  it('avisa de datos faltantes: sin costos y sin retiros registrados', () => {
    const r = buildFinanceAdvice({
      envelopes: buildMoneyEnvelopes(octubre({ ventasSinCosto: 3, entradasSinCosto: 2 })),
      inventarioAlCosto: 1,
      cogsUltimos28Dias: 1,
      hayRetiros: false,
    })
    expect(r.consejos.map((c) => c.code)).toEqual(['comprar', 'retirar', 'ventas_sin_costo', 'entradas_sin_costo', 'sin_retiros'])
  })
})
