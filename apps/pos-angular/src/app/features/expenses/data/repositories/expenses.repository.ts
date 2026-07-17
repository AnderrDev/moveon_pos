import { inject, Injectable } from '@angular/core'
import { SupabaseClientService } from '@angular-app/core/supabase/supabase-client.service'
import type {
  Empleado,
  Expense,
  ExpenseCategory,
  ExpenseCategoryTipo,
  ExpenseMetodoPago,
  ExpenseStatus,
  ExpenseTemplate,
  ExpenseTemplateFrecuencia,
  ReinvestmentFundSettings,
} from '@angular-app/features/expenses/domain/entities/expense.entity'
import { ExpenseRepository } from '@angular-app/features/expenses/domain/repositories/expense.repository'
import type { ReinvestmentFundTotals } from '@angular-app/features/expenses/domain/services/reinvestment-fund'
import type { CreateExpenseDto, VoidExpenseDto } from '@angular-app/features/expenses/domain/dtos/expense.dto'
import type { SaveEmpleadoDto } from '@angular-app/features/expenses/domain/dtos/empleado.dto'
import type { SaveFundSettingsDto } from '@angular-app/features/expenses/domain/dtos/fund-settings.dto'
import type { SaveTemplateDto } from '@angular-app/features/expenses/domain/dtos/template.dto'

interface ExpenseRow {
  id: string
  tienda_id: string
  category_id: string
  empleado_id: string | null
  concepto: string
  notas: string | null
  monto: number
  fecha_gasto: string
  metodo_pago: string
  cash_movement_id: string | null
  periodo: string | null
  status: string
  voided_reason: string | null
  voided_at: string | null
  created_by: string
  created_at: string
}

const EXPENSE_COLS =
  'id, tienda_id, category_id, empleado_id, concepto, notas, monto, fecha_gasto, metodo_pago, cash_movement_id, periodo, status, voided_reason, voided_at, created_by, created_at'

function rowToExpense(row: ExpenseRow): Expense {
  return {
    id: row.id,
    tiendaId: row.tienda_id,
    categoryId: row.category_id,
    empleadoId: row.empleado_id,
    concepto: row.concepto,
    notas: row.notas,
    monto: Number(row.monto),
    fechaGasto: row.fecha_gasto,
    metodoPago: row.metodo_pago as ExpenseMetodoPago,
    cashMovementId: row.cash_movement_id,
    periodo: row.periodo,
    status: row.status as ExpenseStatus,
    voidedReason: row.voided_reason,
    voidedAt: row.voided_at ? new Date(row.voided_at) : null,
    createdBy: row.created_by,
    createdAt: new Date(row.created_at),
  }
}

interface EmpleadoRow {
  id: string
  tienda_id: string
  nombre: string
  cargo: string | null
  salario_mensual: number
  is_active: boolean
  created_at: string
  updated_at: string
}

const EMPLEADO_COLS = 'id, tienda_id, nombre, cargo, salario_mensual, is_active, created_at, updated_at'

function rowToEmpleado(row: EmpleadoRow): Empleado {
  return {
    id: row.id,
    tiendaId: row.tienda_id,
    nombre: row.nombre,
    cargo: row.cargo,
    salarioMensual: Number(row.salario_mensual),
    isActive: row.is_active,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }
}

@Injectable({ providedIn: 'root' })
export class ExpensesRepository extends ExpenseRepository {
  private readonly supabaseClient = inject(SupabaseClientService)

  async listCategories(tiendaId: string): Promise<ExpenseCategory[]> {
    const { data, error } = await this.supabaseClient.supabase
      .from('expense_categories')
      .select('id, tienda_id, nombre, slug, tipo, is_active')
      .eq('tienda_id', tiendaId)
      .eq('is_active', true)
      .order('nombre', { ascending: true })
    if (error) throw new Error(error.message)
    return (data ?? []).map((row) => ({
      id: row.id,
      tiendaId: row.tienda_id,
      nombre: row.nombre,
      slug: row.slug,
      tipo: row.tipo as ExpenseCategoryTipo,
      isActive: row.is_active,
    }))
  }

  async listExpenses(tiendaId: string, fromDate: string, toDate: string): Promise<Expense[]> {
    const { data, error } = await this.supabaseClient.supabase
      .from('expenses')
      .select(EXPENSE_COLS)
      .eq('tienda_id', tiendaId)
      .gte('fecha_gasto', fromDate)
      .lte('fecha_gasto', toDate)
      .order('fecha_gasto', { ascending: false })
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return ((data ?? []) as ExpenseRow[]).map(rowToExpense)
  }

  /**
   * Registra el gasto vía RPC atómica: si el método es `efectivo_caja`,
   * el egreso de caja se crea en la misma transacción (requiere caja abierta).
   * `created_by` lo resuelve la RPC con `auth.uid()` — el parámetro se
   * mantiene por el contrato del dominio.
   */
  async createExpense(dto: CreateExpenseDto, _userId: string): Promise<Expense> {
    const { data, error } = await this.supabaseClient.supabase.rpc('register_expense_atomic', {
      p_tienda_id: dto.tiendaId,
      p_category_id: dto.categoryId,
      p_empleado_id: dto.empleadoId ?? undefined,
      p_concepto: dto.concepto,
      p_notas: dto.notas ?? undefined,
      p_monto: dto.monto,
      p_fecha_gasto: dto.fechaGasto,
      p_metodo_pago: dto.metodoPago,
      p_periodo: dto.periodo ?? undefined,
    })
    if (error) {
      if (error.message.includes('NO_OPEN_CASH_SESSION')) {
        throw new Error('No hay una caja abierta: abre la caja o usa otro método de pago')
      }
      throw new Error(error.message)
    }
    if (!data) throw new Error('Gasto creado sin respuesta')
    return rowToExpense(data as unknown as ExpenseRow)
  }

  async voidExpense(dto: VoidExpenseDto, userId: string): Promise<Expense> {
    const { data, error } = await this.supabaseClient.supabase
      .from('expenses')
      .update({
        status: 'voided',
        voided_by: userId,
        voided_at: new Date().toISOString(),
        voided_reason: dto.motivo,
      })
      .eq('id', dto.expenseId)
      .eq('tienda_id', dto.tiendaId)
      .eq('status', 'active')
      .select(EXPENSE_COLS)
      .single()
    if (error) throw new Error(error.message)
    if (!data) throw new Error('El gasto ya estaba anulado')
    return rowToExpense(data as ExpenseRow)
  }

  /** Totales de ventas completadas desde una fecha (para la comparativa mensual). */
  async listSalesTotalsSince(
    tiendaId: string,
    fromIso: string,
  ): Promise<{ total: number; createdAt: Date }[]> {
    const { data, error } = await this.supabaseClient.supabase
      .from('sales')
      .select('total, created_at')
      .eq('tienda_id', tiendaId)
      .eq('status', 'completed')
      .gte('created_at', fromIso)
    if (error) throw new Error(error.message)
    return (data ?? []).map((row) => ({
      total: Number(row.total),
      createdAt: new Date(row.created_at),
    }))
  }

  async listEmpleados(tiendaId: string): Promise<Empleado[]> {
    const { data, error } = await this.supabaseClient.supabase
      .from('empleados')
      .select(EMPLEADO_COLS)
      .eq('tienda_id', tiendaId)
      .order('nombre', { ascending: true })
    if (error) throw new Error(error.message)
    return ((data ?? []) as EmpleadoRow[]).map(rowToEmpleado)
  }

  async saveEmpleado(dto: SaveEmpleadoDto): Promise<Empleado> {
    const values = {
      nombre: dto.nombre,
      cargo: dto.cargo ?? null,
      salario_mensual: dto.salarioMensual,
      is_active: dto.isActive,
    }
    const query = dto.id
      ? this.supabaseClient.supabase
          .from('empleados')
          .update(values)
          .eq('id', dto.id)
          .eq('tienda_id', dto.tiendaId)
      : this.supabaseClient.supabase
          .from('empleados')
          .insert({ ...values, tienda_id: dto.tiendaId })
    const { data, error } = await query.select(EMPLEADO_COLS).single()
    if (error) throw new Error(error.message)
    if (!data) throw new Error('Empleado guardado sin respuesta')
    return rowToEmpleado(data as EmpleadoRow)
  }

  async saveTemplate(dto: SaveTemplateDto): Promise<ExpenseTemplate> {
    const values = {
      category_id: dto.categoryId,
      concepto: dto.concepto,
      monto_sugerido: dto.montoSugerido,
      frecuencia: dto.frecuencia,
    }
    const query = dto.id
      ? this.supabaseClient.supabase
          .from('expense_templates')
          .update(values)
          .eq('id', dto.id)
          .eq('tienda_id', dto.tiendaId)
      : this.supabaseClient.supabase
          .from('expense_templates')
          .insert({ ...values, tienda_id: dto.tiendaId })
    const { data, error } = await query
      .select('id, tienda_id, category_id, empleado_id, concepto, monto_sugerido, frecuencia, is_active')
      .single()
    if (error) throw new Error(error.message)
    if (!data) throw new Error('Plantilla guardada sin respuesta')
    return {
      id: data.id,
      tiendaId: data.tienda_id,
      categoryId: data.category_id,
      empleadoId: data.empleado_id,
      concepto: data.concepto,
      montoSugerido: Number(data.monto_sugerido),
      frecuencia: data.frecuencia as ExpenseTemplateFrecuencia,
      isActive: data.is_active,
    }
  }

  async deleteTemplate(id: string, tiendaId: string): Promise<void> {
    const { error } = await this.supabaseClient.supabase
      .from('expense_templates')
      .delete()
      .eq('id', id)
      .eq('tienda_id', tiendaId)
    if (error) throw new Error(error.message)
  }

  async getFundSettings(tiendaId: string): Promise<ReinvestmentFundSettings | null> {
    const { data, error } = await this.supabaseClient.supabase
      .from('reinvestment_fund_settings')
      .select('tienda_id, saldo_inicial, fecha_inicio, updated_at')
      .eq('tienda_id', tiendaId)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) return null
    return {
      tiendaId: data.tienda_id,
      saldoInicial: Number(data.saldo_inicial),
      fechaInicio: data.fecha_inicio,
      updatedAt: new Date(data.updated_at),
    }
  }

  async saveFundSettings(dto: SaveFundSettingsDto): Promise<ReinvestmentFundSettings> {
    const { data, error } = await this.supabaseClient.supabase
      .from('reinvestment_fund_settings')
      .upsert(
        {
          tienda_id: dto.tiendaId,
          saldo_inicial: dto.saldoInicial,
          fecha_inicio: dto.fechaInicio,
        },
        { onConflict: 'tienda_id' },
      )
      .select('tienda_id, saldo_inicial, fecha_inicio, updated_at')
      .single()
    if (error) throw new Error(error.message)
    if (!data) throw new Error('Configuración del fondo guardada sin respuesta')
    return {
      tiendaId: data.tienda_id,
      saldoInicial: Number(data.saldo_inicial),
      fechaInicio: data.fecha_inicio,
      updatedAt: new Date(data.updated_at),
    }
  }

  async getFundTotals(
    tiendaId: string,
    desdeIso: string,
    mesDesdeIso: string,
    mesHastaIso: string,
  ): Promise<ReinvestmentFundTotals> {
    const { data, error } = await this.supabaseClient.supabase.rpc(
      'get_reinvestment_fund_totals',
      {
        p_tienda_id: tiendaId,
        p_desde: desdeIso,
        p_mes_desde: mesDesdeIso,
        p_mes_hasta: mesHastaIso,
      },
    )
    if (error) throw new Error(error.message)
    const row = data?.[0]
    if (!row) throw new Error('El fondo de reinversión no devolvió totales')
    return {
      cogsAcumulado: Number(row.cogs_acumulado),
      comprasAcumuladas: Number(row.compras_acumuladas),
      cogsMes: Number(row.cogs_mes),
      comprasMes: Number(row.compras_mes),
      // El RPC no devuelve ventas_sin_costo (migración 20260708173522,
      // reconciliada con el remoto el 2026-07-16): 0 mientras no exista.
      ventasSinCosto: Number((row as { ventas_sin_costo?: number }).ventas_sin_costo ?? 0),
      entradasSinCosto: Number(row.entradas_sin_costo),
    }
  }

  async listTemplates(tiendaId: string): Promise<ExpenseTemplate[]> {
    const { data, error } = await this.supabaseClient.supabase
      .from('expense_templates')
      .select('id, tienda_id, category_id, empleado_id, concepto, monto_sugerido, frecuencia, is_active')
      .eq('tienda_id', tiendaId)
      .eq('is_active', true)
      .order('concepto', { ascending: true })
    if (error) throw new Error(error.message)
    return (data ?? []).map((row) => ({
      id: row.id,
      tiendaId: row.tienda_id,
      categoryId: row.category_id,
      empleadoId: row.empleado_id,
      concepto: row.concepto,
      montoSugerido: Number(row.monto_sugerido),
      frecuencia: row.frecuencia as ExpenseTemplateFrecuencia,
      isActive: row.is_active,
    }))
  }
}
