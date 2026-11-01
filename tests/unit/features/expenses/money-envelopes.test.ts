import { describe, expect, it } from 'vitest'
import {
  accrueFixedSince,
  buildMoneyEnvelopes,
  type MoneyEnvelopesInput,
} from '@angular-app/features/expenses/domain/services/money-envelopes'
import {
  buildFinanceAdvice,
  inventoryCoverage,
} from '@angular-app/features/expenses/domain/services/finance-advice'

/** Un mes como octubre de 2026 en producción (ADR 0025): vende 14,3 M, costo 7,8 M, fijos 4,3 M. */
function octubre(overrides: Partial<MoneyEnvelopesInput> = {}): MoneyEnvelopesInput {
  return {
    saldosIniciales: { mercancia: 0, fijos: 0, utilidad: 0 },
    entradasAcumuladas: 14_263_550,
    entradasMes: 14_263_550,
    cogsAcumulado: 7_849_468,
    cogsMes: 7_849_468,
    comprasAcumuladas: 7_434_407,
    comprasMes: 7_434_407,
    fijosApartadosAcumulados: 4_300_000,
    fijosApartadosMes: 4_300_000,
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
  it('reparte lo vendido en los cuatro sobres y la utilidad es lo que sobra', () => {
    const e = buildMoneyEnvelopes(octubre())
    expect(e.sobres.mercancia.apartadoAcumulado).toBe(7_849_468)
    expect(e.sobres.mercancia.disponible).toBe(7_849_468 - 7_434_407)
    expect(e.sobres.fijos.disponible).toBe(0)
    expect(e.sobres.diaADia.disponible).toBe(0)
    expect(e.sobres.utilidad.apartadoAcumulado).toBe(14_263_550 - 7_849_468 - 4_300_000 - 525_950)
    expect(e.sobres.utilidad.disponible).toBe(1_588_132)
  })

  it('los sobres suman exactamente lo que entró', () => {
    const e = buildMoneyEnvelopes(octubre())
    const apartado = Object.values(e.sobres).reduce((s, x) => s + x.apartadoAcumulado, 0)
    expect(apartado).toBe(e.entradasAcumuladas)
  })

  it('comprar más de lo vendido al costo deja mercancía en negativo (septiembre)', () => {
    const e = buildMoneyEnvelopes(
      octubre({ cogsAcumulado: 8_010_831, comprasAcumuladas: 18_438_015 }),
    )
    expect(e.sobres.mercancia.disponible).toBe(8_010_831 - 18_438_015)
  })

  it('los retiros salen del sobre de utilidad y pueden dejarlo en negativo', () => {
    const e = buildMoneyEnvelopes(octubre({ retirosAcumulados: 2_000_000, retirosMes: 2_000_000 }))
    expect(e.sobres.utilidad.usadoAcumulado).toBe(2_000_000)
    expect(e.sobres.utilidad.disponible).toBe(1_588_132 - 2_000_000)
  })

  it('los saldos iniciales se suman a cada sobre', () => {
    const e = buildMoneyEnvelopes(
      octubre({ saldosIniciales: { mercancia: 1_000_000, fijos: 500_000, utilidad: 250_000 } }),
    )
    expect(e.sobres.mercancia.disponible).toBe(1_000_000 + 7_849_468 - 7_434_407)
    expect(e.sobres.fijos.disponible).toBe(500_000)
    expect(e.sobres.utilidad.disponible).toBe(250_000 + 1_588_132)
  })

  it('fijos apartados pero no pagados quedan guardados en su sobre', () => {
    const e = buildMoneyEnvelopes(octubre({ fijosPagadosAcumulados: 0, fijosPagadosMes: 0 }))
    expect(e.sobres.fijos.disponible).toBe(4_300_000)
    // La utilidad no cambia: la plata del arriendo no es utilidad aunque no se haya pagado.
    expect(e.sobres.utilidad.disponible).toBe(1_588_132)
  })
})

describe('accrueFixedSince', () => {
  it('aparta el mes completo cuando el mes ya cerró', () => {
    const r = accrueFixedSince({ fijosMensual: 4_300_000, desde: '2026-11-01', hasta: '2026-12-15', mesVisible: '2026-11' })
    expect(r.mes).toBe(4_300_000)
    expect(r.acumulado).toBe(4_300_000 + Math.round((4_300_000 * 15) / 31))
  })

  it('aparta por día dentro del mes en curso', () => {
    const r = accrueFixedSince({ fijosMensual: 3_000_000, desde: '2026-11-01', hasta: '2026-11-10', mesVisible: '2026-11' })
    expect(r.mes).toBe(1_000_000)
    expect(r.acumulado).toBe(1_000_000)
  })

  it('arranca a mitad de mes y no cuenta los días anteriores', () => {
    const r = accrueFixedSince({ fijosMensual: 3_000_000, desde: '2026-11-16', hasta: '2026-11-30', mesVisible: '2026-11' })
    expect(r.acumulado).toBe(1_500_000)
  })

  it('sin fijos o con fecha futura no aparta nada', () => {
    expect(accrueFixedSince({ fijosMensual: 0, desde: '2026-11-01', hasta: '2026-11-30', mesVisible: '2026-11' })).toEqual({ acumulado: 0, mes: 0, dias: 0, diasMes: 30 })
    expect(accrueFixedSince({ fijosMensual: 100, desde: '2026-12-01', hasta: '2026-11-30', mesVisible: '2026-11' })).toEqual({ acumulado: 0, mes: 0, dias: 0, diasMes: 30 })
  })

  it('cuenta los días apartados: 1 de noviembre = 1 día de 30, $143.333 de $4.300.000', () => {
    const r = accrueFixedSince({ fijosMensual: 4_300_000, desde: '2026-11-01', hasta: '2026-11-01', mesVisible: '2026-11' })
    expect(r).toEqual({ acumulado: 143_333, mes: 143_333, dias: 1, diasMes: 30 })
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
  it('dice cuánto comprar, cuánto retirar y cuánto guardar para fijos', () => {
    const r = buildFinanceAdvice({
      envelopes: buildMoneyEnvelopes(octubre({ fijosPagadosAcumulados: 2_500_000, fijosPagadosMes: 2_500_000 })),
      inventarioAlCosto: 20_000_000,
      cogsUltimos28Dias: 7_300_000,
      fijosConfigurados: true,
      hayRetiros: true,
    })
    expect(r.consejos).toContainEqual({ code: 'comprar', disponible: 415_061 })
    expect(r.consejos).toContainEqual({ code: 'retirar', disponible: 1_588_132 })
    expect(r.consejos).toContainEqual({ code: 'guardar_fijos', apartado: 4_300_000, pagado: 2_500_000, disponible: 1_800_000 })
    expect(r.inventario.metaDias).toBe(45)
    expect(r.inventario.nivel).toBe('rojo')
  })

  it('avisa cuando se compró o retiró de más', () => {
    const r = buildFinanceAdvice({
      envelopes: buildMoneyEnvelopes(octubre({ comprasAcumuladas: 9_000_000, retirosAcumulados: 3_000_000 })),
      inventarioAlCosto: null,
      cogsUltimos28Dias: 0,
      fijosConfigurados: true,
      hayRetiros: true,
    })
    expect(r.consejos).toContainEqual({ code: 'comprar_exceso', exceso: 9_000_000 - 7_849_468 })
    expect(r.consejos).toContainEqual({ code: 'retirar_exceso', exceso: 3_000_000 - 1_588_132 })
    expect(r.inventario.nivel).toBe('sin_datos')
  })

  it('utilidad en negativo sin retiros es "aún no hay utilidad", no "retiraste de más" (día 1 del mes)', () => {
    const r = buildFinanceAdvice({
      envelopes: buildMoneyEnvelopes(
        octubre({ entradasAcumuladas: 57_000, cogsAcumulado: 25_822, fijosApartadosAcumulados: 143_333, variablesAcumulados: 0, comprasAcumuladas: 0 }),
      ),
      inventarioAlCosto: 1,
      cogsUltimos28Dias: 1,
      fijosConfigurados: true,
      hayRetiros: false,
    })
    expect(r.consejos).toContainEqual({ code: 'sin_utilidad', faltante: 143_333 - 57_000 + 25_822 })
    expect(r.consejos.some((c) => c.code === 'retirar_exceso')).toBe(false)
    // Sin utilidad tampoco se insiste en registrar retiros.
    expect(r.consejos.some((c) => c.code === 'sin_retiros')).toBe(false)
  })

  it('avisa de datos faltantes: sin fijos, sin costos y sin retiros registrados', () => {
    const r = buildFinanceAdvice({
      envelopes: buildMoneyEnvelopes(octubre({ ventasSinCosto: 3, entradasSinCosto: 2 })),
      inventarioAlCosto: 1,
      cogsUltimos28Dias: 1,
      fijosConfigurados: false,
      hayRetiros: false,
    })
    const codes = r.consejos.map((c) => c.code)
    expect(codes).toEqual(['comprar', 'retirar', 'sin_fijos', 'ventas_sin_costo', 'entradas_sin_costo', 'sin_retiros'])
  })
})
