import { describe, expect, it } from 'vitest'
import { buildNominaPagoSugerido, pagadoPorEmpleado } from '@angular-app/features/expenses/domain/services/nomina'

const EMPLEADO = { nombre: 'Laura', salarioMensual: 1_800_000 }

describe('buildNominaPagoSugerido', () => {
  it('mes completo: salario acordado y período mensual', () => {
    const pago = buildNominaPagoSugerido(EMPLEADO, 'mes', '2026-07')
    expect(pago.montoSugerido).toBe(1_800_000)
    expect(pago.periodo).toBe('2026-07')
    expect(pago.concepto).toContain('Laura')
  })

  it('las dos quincenas suman exactamente el salario (incluso con salario impar)', () => {
    const impar = { nombre: 'Laura', salarioMensual: 1_500_001 }
    const q1 = buildNominaPagoSugerido(impar, 'quincena1', '2026-07')
    const q2 = buildNominaPagoSugerido(impar, 'quincena2', '2026-07')
    expect(q1.montoSugerido + q2.montoSugerido).toBe(1_500_001)
    expect(q1.periodo).toBe('2026-07-Q1')
    expect(q2.periodo).toBe('2026-07-Q2')
  })

  it('adelanto: monto libre (0) y período mensual', () => {
    const pago = buildNominaPagoSugerido(EMPLEADO, 'adelanto', '2026-07')
    expect(pago.montoSugerido).toBe(0)
    expect(pago.periodo).toBe('2026-07')
    expect(pago.concepto).toContain('Adelanto')
  })
})

describe('pagadoPorEmpleado', () => {
  it('suma solo gastos activos con empleado', () => {
    const totals = pagadoPorEmpleado([
      { empleadoId: 'e1', monto: 900_000, status: 'active' },
      { empleadoId: 'e1', monto: 100_000, status: 'active' },
      { empleadoId: 'e1', monto: 500_000, status: 'voided' },
      { empleadoId: null, monto: 300_000, status: 'active' },
      { empleadoId: 'e2', monto: 450_000, status: 'active' },
    ])
    expect(totals.get('e1')).toBe(1_000_000)
    expect(totals.get('e2')).toBe(450_000)
    expect(totals.size).toBe(2)
  })
})
