import type { Empleado } from '@angular-app/features/expenses/domain/entities/expense.entity'

export type NominaTipoPago = 'mes' | 'quincena1' | 'quincena2' | 'adelanto'

export const NOMINA_TIPO_LABEL: Record<NominaTipoPago, string> = {
  mes: 'Mes completo',
  quincena1: 'Quincena 1',
  quincena2: 'Quincena 2',
  adelanto: 'Adelanto',
}

export interface NominaPagoSugerido {
  /** Monto precargado según el salario acordado; 0 en adelantos (lo define el usuario). */
  montoSugerido: number
  /** `YYYY-MM` o `YYYY-MM-Q1`/`YYYY-MM-Q2`. */
  periodo: string
  concepto: string
}

function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })
}

/**
 * Sugerencia de pago de nómina para un empleado en un mes (`YYYY-MM`).
 * Nómina simulada: el salario acordado es el costo total — sin prestaciones
 * ni cálculos legales. Las dos quincenas siempre suman el salario exacto.
 */
export function buildNominaPagoSugerido(
  empleado: Pick<Empleado, 'nombre' | 'salarioMensual'>,
  tipo: NominaTipoPago,
  month: string,
): NominaPagoSugerido {
  const label = monthLabel(month)
  const quincena1 = Math.round(empleado.salarioMensual / 2)

  switch (tipo) {
    case 'mes':
      return {
        montoSugerido: empleado.salarioMensual,
        periodo: month,
        concepto: `Nómina ${label} — ${empleado.nombre}`,
      }
    case 'quincena1':
      return {
        montoSugerido: quincena1,
        periodo: `${month}-Q1`,
        concepto: `Nómina quincena 1 ${label} — ${empleado.nombre}`,
      }
    case 'quincena2':
      return {
        montoSugerido: empleado.salarioMensual - quincena1,
        periodo: `${month}-Q2`,
        concepto: `Nómina quincena 2 ${label} — ${empleado.nombre}`,
      }
    case 'adelanto':
      return {
        montoSugerido: 0,
        periodo: month,
        concepto: `Adelanto de nómina — ${empleado.nombre}`,
      }
  }
}

/** Total pagado (gastos activos de nómina) por empleado. */
export function pagadoPorEmpleado(
  gastos: readonly { empleadoId: string | null; monto: number; status: string }[],
): Map<string, number> {
  const totals = new Map<string, number>()
  for (const gasto of gastos) {
    if (gasto.status !== 'active' || !gasto.empleadoId) continue
    totals.set(gasto.empleadoId, (totals.get(gasto.empleadoId) ?? 0) + gasto.monto)
  }
  return totals
}
