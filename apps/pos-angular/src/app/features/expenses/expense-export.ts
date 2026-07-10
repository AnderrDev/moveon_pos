import type {
  Expense,
  ExpenseCategory,
  ExpenseMetodoPago,
} from '@/modules/expenses/domain/entities/expense.entity'
import type { FinancialSummary } from '@/modules/expenses/domain/services/financial-summary'
import type { MonthlyComparisonRow } from '@/modules/expenses/domain/services/monthly-comparison'
import type { ReinvestmentFund } from '@/modules/expenses/domain/services/reinvestment-fund'
import type {
  ExcelCellValue,
  ExcelWorkbookDefinition,
} from '../../shared/export/excel-export.service'
import { buildExportFilename } from '../../shared/export/export-filename'
import { getPaymentMethodLabel } from '@/shared/lib/payment-methods'

const METODO_LABEL: Record<ExpenseMetodoPago, string> = {
  efectivo_caja: 'Efectivo (caja)',
  efectivo_externo: 'Efectivo',
  transferencia: 'Transferencia',
  tarjeta: 'Tarjeta',
}

export interface FinanzasExportInput {
  monthLabel: string
  summary: FinancialSummary
  expenses: readonly Expense[]
  categorias: readonly ExpenseCategory[]
  comparison: readonly MonthlyComparisonRow[]
  /** `null` mientras la tienda no configure el fondo de reinversión. */
  fund: ReinvestmentFund | null
}

/** Libro de finanzas del mes: Resumen, Gastos y Comparativa (datos ya cargados — ADR 0011). */
export function buildFinanzasWorkbook(input: FinanzasExportInput): ExcelWorkbookDefinition {
  const nombres = new Map(input.categorias.map((c) => [c.id, c.nombre]))
  const { summary } = input

  const resumenRows: (readonly ExcelCellValue[])[] = [
    ['Entradas totales (ventas completadas)', summary.entradasTotales, null],
    ...summary.entradasPorMetodo.map((payment) => [
      `Entradas — ${getPaymentMethodLabel(payment.metodo)}`,
      payment.total,
      payment.pctSobreEntradas,
    ]),
    ['Costo de productos vendidos', summary.costoProductosVendidos, null],
    ['Gastos del negocio', summary.gastosTotal, summary.pctGastosSobreEntradas],
    ...summary.porCategoria.map((cat) => [
      `Gastos — ${cat.nombre}`,
      cat.total,
      cat.pctSobreEntradas,
    ]),
    ['Utilidad neta', summary.utilidadNeta, summary.margenNeto],
  ]

  if (input.fund) {
    resumenRows.push(
      ['Fondo de reinversión — Saldo inicial', input.fund.saldoInicial, null],
      ['Fondo de reinversión — Apartado por ventas (acumulado)', input.fund.apartadoAcumulado, null],
      ['Fondo de reinversión — Invertido en mercancía (acumulado)', input.fund.invertidoAcumulado, null],
      ['Fondo de reinversión — Disponible para reinvertir', input.fund.disponible, null],
      ['Fondo de reinversión — Apartado este mes', input.fund.apartadoMes, null],
      ['Fondo de reinversión — Invertido este mes', input.fund.invertidoMes, null],
    )
  }

  return {
    filename: buildExportFilename('finanzas'),
    sheets: [
      {
        name: 'Resumen',
        title: `Finanzas — ${input.monthLabel}`,
        subtitle: 'Gastos del negocio en relación a las entradas totales',
        columns: [
          { header: 'Concepto', width: 42 },
          { header: 'Valor', width: 20, format: 'currency' },
          { header: '% sobre entradas', width: 18, format: 'percent' },
        ],
        rows: resumenRows,
      },
      {
        name: 'Gastos',
        title: `Gastos — ${input.monthLabel}`,
        subtitle: `${input.expenses.length} registros (incluye anulados)`,
        columns: [
          { header: 'Fecha', width: 14 },
          { header: 'Categoría', width: 22 },
          { header: 'Concepto', width: 40 },
          { header: 'Método', width: 18 },
          { header: 'Período', width: 14 },
          { header: 'Monto', width: 18, format: 'currency' },
          { header: 'Estado', width: 12 },
          { header: 'Motivo anulación', width: 34 },
          { header: 'Notas', width: 34 },
        ],
        rows: input.expenses.map((g) => [
          g.fechaGasto,
          nombres.get(g.categoryId) ?? 'Sin categoría',
          g.concepto,
          METODO_LABEL[g.metodoPago],
          g.periodo,
          g.monto,
          g.status === 'voided' ? 'Anulado' : 'Activo',
          g.voidedReason,
          g.notas,
        ]),
      },
      {
        name: 'Comparativa',
        title: 'Comparativa mensual',
        subtitle: 'Balance = entradas − gastos (no descuenta costo de productos)',
        columns: [
          { header: 'Mes', width: 12 },
          { header: 'Entradas', width: 18, format: 'currency' },
          { header: 'Gastos', width: 18, format: 'currency' },
          { header: 'Gastos/Entradas', width: 16, format: 'percent' },
          { header: 'Balance', width: 18, format: 'currency' },
        ],
        rows: input.comparison.map((row) => [
          row.month,
          row.entradas,
          row.gastos,
          row.pctGastos,
          row.balance,
        ]),
      },
    ],
  }
}
