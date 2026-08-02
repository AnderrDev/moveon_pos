import type { TiendaId } from '@/shared/types'

export type ExpenseMetodoPago = 'efectivo_caja' | 'efectivo_externo' | 'transferencia' | 'tarjeta'

export type ExpenseStatus = 'active' | 'voided'

export type ExpenseCategoryTipo = 'fijo' | 'variable'

export type ExpenseTemplateFrecuencia = 'mensual' | 'quincenal'

export interface ExpenseCategory {
  id: string
  tiendaId: TiendaId
  nombre: string
  slug: string
  tipo: ExpenseCategoryTipo
  isActive: boolean
}

export interface Empleado {
  id: string
  tiendaId: TiendaId
  nombre: string
  cargo: string | null
  salarioMensual: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface Expense {
  id: string
  tiendaId: TiendaId
  categoryId: string
  empleadoId: string | null
  concepto: string
  notas: string | null
  monto: number
  /** Fecha contable del gasto en formato local `YYYY-MM-DD`. */
  fechaGasto: string
  metodoPago: ExpenseMetodoPago
  cashMovementId: string | null
  /** `YYYY-MM` o `YYYY-MM-Q1`/`YYYY-MM-Q2` para nómina y recurrentes. */
  periodo: string | null
  status: ExpenseStatus
  voidedReason: string | null
  voidedAt: Date | null
  createdBy: string
  createdAt: Date
}

export interface ReinvestmentFundSettings {
  tiendaId: TiendaId
  /** Dinero destinado a mercancía al momento de arrancar el fondo. */
  saldoInicial: number
  /** Fecha local `YYYY-MM-DD` desde la que cuentan ventas y compras. */
  fechaInicio: string
  updatedAt: Date
}

export interface ExpenseTemplate {
  id: string
  tiendaId: TiendaId
  categoryId: string
  empleadoId: string | null
  concepto: string
  montoSugerido: number
  frecuencia: ExpenseTemplateFrecuencia
  isActive: boolean
}
