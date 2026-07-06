import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core'
import { getErrorMessage } from '@/shared/lib/error-message'
import { PageHeaderComponent } from '../../shared/layout/page-header.component'
import { ButtonComponent } from '../../shared/ui/button.component'
import { EmptyStateComponent } from '../../shared/feedback/empty-state.component'
import { VoidReasonDialog } from '../../shared/feedback/void-reason.dialog'
import { ToastService } from '../../shared/feedback/toast.service'
import { SessionService } from '../../core/auth/session.service'
import { ReportsService } from '../reports/reports.service'
import { ExpensesRepository } from './expenses.repository'
import { ExpenseFormDialog } from './expense-form.dialog'
import { ExpenseListComponent } from './expense-list.component'
import { FinancialSummaryComponent } from './financial-summary.component'
import { NominaSectionComponent } from './nomina-section.component'
import { MonthlyComparisonComponent } from './monthly-comparison.component'
import { RecurrentesDialog } from './recurrentes.dialog'
import { TemplateFormDialog } from './template-form.dialog'
import { ExcelExportService } from '../../shared/export/excel-export.service'
import { buildFinanzasWorkbook } from './expense-export'
import type { ExpenseFormValue } from '@/modules/expenses/forms/expense-form.factory'
import { EmpleadoFormDialog } from './empleado-form.dialog'
import { NominaPagoDialog } from './nomina-pago.dialog'
import { voidExpense } from '@/modules/expenses/application/use-cases/void-expense.use-case'
import {
  buildFinancialSummary,
  type FinancialSummary,
} from '@/modules/expenses/domain/services/financial-summary'
import { pagadoPorEmpleado } from '@/modules/expenses/domain/services/nomina'
import {
  buildMonthlyComparison,
  lastMonths,
  type MonthlyComparisonRow,
} from '@/modules/expenses/domain/services/monthly-comparison'
import type {
  Empleado,
  Expense,
  ExpenseCategory,
  ExpenseTemplate,
} from '@/modules/expenses/domain/entities/expense.entity'

function currentMonthLocal(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split('-').map(Number)
  const lastDay = new Date(y, m, 0).getDate()
  return { from: `${month}-01`, to: `${month}-${String(lastDay).padStart(2, '0')}` }
}

@Component({
  selector: 'mo-finanzas-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PageHeaderComponent,
    ButtonComponent,
    EmptyStateComponent,
    VoidReasonDialog,
    ExpenseFormDialog,
    ExpenseListComponent,
    FinancialSummaryComponent,
    NominaSectionComponent,
    EmpleadoFormDialog,
    NominaPagoDialog,
    MonthlyComparisonComponent,
    RecurrentesDialog,
    TemplateFormDialog,
  ],
  template: `
    <section class="flex h-full min-h-0 flex-col">
      <mo-page-header
        title="Finanzas"
        subtitle="Gastos del negocio en relación a las entradas totales"
      >
        <div class="bg-card flex items-center rounded-lg border">
          <button
            type="button"
            class="hover:bg-muted h-10 rounded-l-lg px-3 text-sm"
            aria-label="Mes anterior"
            (click)="goPrevMonth()"
          >
            ‹
          </button>
          <span class="min-w-36 px-2 text-center text-sm font-semibold capitalize">
            {{ monthLabel() }}
          </span>
          <button
            type="button"
            class="hover:bg-muted h-10 rounded-r-lg px-3 text-sm disabled:opacity-40"
            aria-label="Mes siguiente"
            [disabled]="isCurrentMonth()"
            (click)="goNextMonth()"
          >
            ›
          </button>
        </div>
        <mo-button variant="outline" (click)="recurrentesOpen.set(true)">Gastos del mes</mo-button>
        <mo-button
          variant="outline"
          [loading]="exporting()"
          loadingText="Generando..."
          [disabled]="loading()"
          (click)="exportFinanzas()"
        >
          Descargar Excel
        </mo-button>
        <mo-button (click)="openNewExpense()">+ Registrar gasto</mo-button>
      </mo-page-header>

      @if (loading()) {
        <div class="bg-card flex-1 animate-pulse rounded-xl border p-8">
          <div class="bg-muted/50 h-72 rounded-xl"></div>
        </div>
      } @else if (loadError()) {
        <mo-empty-state title="Error al cargar finanzas" [description]="loadError()">
          <mo-button (click)="load()">Reintentar</mo-button>
        </mo-empty-state>
      } @else {
        <div class="min-h-0 flex-1 space-y-4 overflow-auto pb-4">
          <mo-financial-summary [s]="summary()" />

          <mo-nomina-section
            [empleados]="empleados()"
            [pagado]="pagadoEmpleados()"
            (addRequested)="openNewEmpleado()"
            (editRequested)="openEditEmpleado($event)"
            (payRequested)="payingEmpleado.set($event)"
          />

          <div>
            <h3 class="text-muted-foreground mb-2 text-xs tracking-wide uppercase">
              Gastos del mes ({{ expenses().length }})
            </h3>
            @if (expenses().length === 0) {
              <mo-empty-state
                title="Sin gastos este mes"
                description="Registra nómina, arriendo, mantenimiento y demás gastos para ver la utilidad neta real."
              >
                <mo-button (click)="openNewExpense()">+ Registrar gasto</mo-button>
              </mo-empty-state>
            } @else {
              <mo-expense-list
                [expenses]="expenses()"
                [categorias]="categorias()"
                (voidRequested)="askVoid($event)"
              />
            }
          </div>

          <mo-monthly-comparison [rows]="comparison()" />
        </div>
      }
    </section>

    <mo-expense-form-dialog
      [open]="dialogOpen()"
      [categorias]="categorias()"
      [initial]="expenseInitial()"
      [periodo]="expensePeriodo()"
      (closed)="dialogOpen.set(false)"
      (saved)="onExpenseSaved($event)"
    />

    <mo-recurrentes-dialog
      [open]="recurrentesOpen()"
      [templates]="templates()"
      [categorias]="categorias()"
      [expenses]="expenses()"
      [month]="month()"
      (closed)="recurrentesOpen.set(false)"
      (useRequested)="useTemplate($event)"
      (newRequested)="templateFormOpen.set(true)"
      (deleted)="onTemplateDeleted($event)"
    />

    <mo-template-form-dialog
      [open]="templateFormOpen()"
      [categorias]="categorias()"
      (closed)="templateFormOpen.set(false)"
      (saved)="onTemplateSaved($event)"
    />

    <mo-empleado-form-dialog
      [open]="empleadoDialogOpen()"
      [empleado]="editingEmpleado()"
      (closed)="closeEmpleadoDialog()"
      (saved)="onEmpleadoSaved($event)"
    />

    <mo-nomina-pago-dialog
      [open]="payingEmpleado() !== null"
      [empleado]="payingEmpleado()"
      [nominaCategoryId]="nominaCategoryId()"
      (closed)="payingEmpleado.set(null)"
      (saved)="onExpenseSaved($event)"
    />

    <mo-void-reason-dialog
      [open]="voiding() !== null"
      title="Anular gasto"
      [targetLabel]="voidTargetLabel()"
      placeholder="Ej: se registró dos veces, monto equivocado"
      (closed)="voiding.set(null)"
      (confirmed)="confirmVoid($event)"
    />
  `,
})
export class FinanzasPage {
  private readonly repo = inject(ExpensesRepository)
  private readonly reportsService = inject(ReportsService)
  private readonly session = inject(SessionService)
  private readonly toast = inject(ToastService)
  private readonly excel = inject(ExcelExportService)

  readonly month = signal(currentMonthLocal())
  readonly loading = signal(true)
  readonly loadError = signal<string | null>(null)
  readonly categorias = signal<ExpenseCategory[]>([])
  readonly expenses = signal<Expense[]>([])
  readonly empleados = signal<Empleado[]>([])
  readonly entradasTotales = signal(0)
  readonly costoProductos = signal<number | null>(null)
  readonly dialogOpen = signal(false)
  readonly voiding = signal<Expense | null>(null)
  readonly empleadoDialogOpen = signal(false)
  readonly editingEmpleado = signal<Empleado | null>(null)
  readonly payingEmpleado = signal<Empleado | null>(null)
  readonly comparison = signal<MonthlyComparisonRow[]>([])
  readonly templates = signal<ExpenseTemplate[]>([])
  readonly recurrentesOpen = signal(false)
  readonly templateFormOpen = signal(false)
  readonly expenseInitial = signal<Partial<ExpenseFormValue> | null>(null)
  readonly expensePeriodo = signal<string | null>(null)
  readonly exporting = signal(false)

  readonly pagadoEmpleados = computed(() => pagadoPorEmpleado(this.expenses()))

  readonly nominaCategoryId = computed(
    () => this.categorias().find((c) => c.slug === 'nomina')?.id ?? null,
  )

  readonly monthLabel = computed(() => {
    const [y, m] = this.month().split('-').map(Number)
    return new Date(y, m - 1, 1).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })
  })

  readonly isCurrentMonth = computed(() => this.month() >= currentMonthLocal())

  readonly summary = computed<FinancialSummary>(() =>
    buildFinancialSummary({
      entradasTotales: this.entradasTotales(),
      costoProductosVendidos: this.costoProductos(),
      gastos: this.expenses(),
      categorias: this.categorias(),
    }),
  )

  readonly voidTargetLabel = computed(() => {
    const gasto = this.voiding()
    return gasto ? `el gasto "${gasto.concepto}"` : null
  })

  constructor() {
    void this.load()
  }

  goPrevMonth(): void {
    this.month.set(shiftMonth(this.month(), -1))
    void this.load()
  }

  goNextMonth(): void {
    if (this.isCurrentMonth()) return
    this.month.set(shiftMonth(this.month(), 1))
    void this.load()
  }

  async load(): Promise<void> {
    this.loading.set(true)
    this.loadError.set(null)
    try {
      const auth = await this.session.getAuthContext()
      if (!auth) throw new Error('No autenticado')
      const { from, to } = monthRange(this.month())
      const [categorias, expenses, empleados, templates, report] = await Promise.all([
        this.repo.listCategories(auth.tiendaId),
        this.repo.listExpenses(auth.tiendaId, from, to),
        this.repo.listEmpleados(auth.tiendaId),
        this.repo.listTemplates(auth.tiendaId),
        this.reportsService.getDailyReport(auth.tiendaId, from, to),
      ])
      this.categorias.set(categorias)
      this.expenses.set(expenses)
      this.empleados.set(empleados)
      this.templates.set(templates)
      this.entradasTotales.set(report.totalVentas)

      const costos = report.productSales
        .map((p) => p.costoTotal)
        .filter((c): c is number => c !== null)
      this.costoProductos.set(costos.length > 0 ? costos.reduce((s, c) => s + c, 0) : null)

      await this.loadComparison(auth.tiendaId)
    } catch (error) {
      this.loadError.set(getErrorMessage(error, 'Error al cargar'))
    } finally {
      this.loading.set(false)
    }
  }

  /** Últimos 6 meses (siempre relativos a hoy) para la comparativa. */
  private async loadComparison(tiendaId: string): Promise<void> {
    const months = lastMonths(6)
    const fromDate = `${months[0]}-01`
    const fromIso = new Date(`${fromDate}T00:00:00`).toISOString()
    const { to } = monthRange(months[months.length - 1])
    const [sales, gastos] = await Promise.all([
      this.repo.listSalesTotalsSince(tiendaId, fromIso),
      this.repo.listExpenses(tiendaId, fromDate, to),
    ])
    this.comparison.set(buildMonthlyComparison({ sales, gastos, months }))
  }

  onExpenseSaved(expense: Expense): void {
    const { from, to } = monthRange(this.month())
    if (expense.fechaGasto >= from && expense.fechaGasto <= to) {
      this.expenses.set([expense, ...this.expenses()])
    } else {
      this.toast.success('El gasto quedó registrado en otro mes')
    }
  }

  askVoid(expense: Expense): void {
    this.voiding.set(expense)
  }

  openNewExpense(): void {
    this.expenseInitial.set(null)
    this.expensePeriodo.set(null)
    this.dialogOpen.set(true)
  }

  /** Abre el form de gasto prellenado desde una plantilla recurrente. */
  useTemplate(template: ExpenseTemplate): void {
    this.recurrentesOpen.set(false)
    this.expenseInitial.set({
      categoryId: template.categoryId,
      concepto: template.concepto,
      monto: template.montoSugerido,
    })
    this.expensePeriodo.set(this.month())
    this.dialogOpen.set(true)
  }

  onTemplateSaved(template: ExpenseTemplate): void {
    this.templates.set(
      [...this.templates(), template].sort((a, b) => a.concepto.localeCompare(b.concepto)),
    )
    this.recurrentesOpen.set(true)
  }

  onTemplateDeleted(templateId: string): void {
    this.templates.set(this.templates().filter((t) => t.id !== templateId))
  }

  async exportFinanzas(): Promise<void> {
    if (this.exporting()) return
    this.exporting.set(true)
    try {
      await this.excel.download(
        buildFinanzasWorkbook({
          monthLabel: this.monthLabel(),
          summary: this.summary(),
          expenses: this.expenses(),
          categorias: this.categorias(),
          comparison: this.comparison(),
        }),
      )
      this.toast.success('Archivo de finanzas descargado')
    } catch (error) {
      this.toast.error(getErrorMessage(error, 'No se pudo generar el archivo'))
    } finally {
      this.exporting.set(false)
    }
  }

  openNewEmpleado(): void {
    this.editingEmpleado.set(null)
    this.empleadoDialogOpen.set(true)
  }

  openEditEmpleado(empleado: Empleado): void {
    this.editingEmpleado.set(empleado)
    this.empleadoDialogOpen.set(true)
  }

  closeEmpleadoDialog(): void {
    this.empleadoDialogOpen.set(false)
    this.editingEmpleado.set(null)
  }

  onEmpleadoSaved(empleado: Empleado): void {
    const current = this.empleados()
    const idx = current.findIndex((e) => e.id === empleado.id)
    if (idx >= 0) {
      const next = [...current]
      next[idx] = empleado
      this.empleados.set(next)
    } else {
      this.empleados.set([...current, empleado].sort((a, b) => a.nombre.localeCompare(b.nombre)))
    }
  }

  async confirmVoid(motivo: string): Promise<void> {
    const gasto = this.voiding()
    if (!gasto) return
    this.voiding.set(null)
    try {
      const auth = await this.session.getAuthContext()
      if (!auth) throw new Error('No autenticado')
      const result = await voidExpense(
        { repo: this.repo, userId: auth.userId },
        { expenseId: gasto.id, tiendaId: auth.tiendaId, motivo },
      )
      if (!result.ok) {
        this.toast.error(result.error.message)
        return
      }
      this.expenses.set(this.expenses().map((g) => (g.id === result.value.id ? result.value : g)))
      this.toast.success('Gasto anulado')
    } catch (error) {
      this.toast.error(getErrorMessage(error, 'No se pudo anular el gasto'))
    }
  }
}
