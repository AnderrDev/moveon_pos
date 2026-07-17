import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core'
import { getErrorMessage } from '@/shared/lib/error-message'
import { PageHeaderComponent } from '@angular-app/shared/molecules/page-header.component'
import { ButtonComponent } from '@angular-app/shared/atoms/button.component'
import { EmptyStateComponent } from '@angular-app/shared/molecules/empty-state.component'
import { VoidReasonDialog } from '@angular-app/shared/organisms/void-reason/void-reason.dialog'
import { ToastService } from '@angular-app/shared/organisms/toast/toast.service'
import { SessionService } from '@angular-app/core/auth/session.service'
import { ReportsService } from '@angular-app/features/reports/presentation/services/reports.service'
import { ExpensesRepository } from '@angular-app/features/expenses/data/repositories/expenses.repository'
import { ExpenseFormDialog } from '@angular-app/features/expenses/presentation/dialogs/expense-form.dialog'
import { ExpenseListComponent } from '@angular-app/features/expenses/presentation/components/expense-list.component'
import { FinancialSummaryComponent } from '@angular-app/features/expenses/presentation/components/financial-summary.component'
import { NominaSectionComponent } from '@angular-app/features/expenses/presentation/components/nomina-section.component'
import { MonthlyComparisonComponent } from '@angular-app/features/expenses/presentation/components/monthly-comparison.component'
import { RecurrentesDialog } from '@angular-app/features/expenses/presentation/dialogs/recurrentes.dialog'
import { TemplateFormDialog } from '@angular-app/features/expenses/presentation/dialogs/template-form.dialog'
import { ReinvestmentFundComponent } from '@angular-app/features/expenses/presentation/components/reinvestment-fund.component'
import { FundSettingsDialog } from '@angular-app/features/expenses/presentation/dialogs/fund-settings.dialog'
import { ExcelExportService } from '@angular-app/shared/services/export/excel-export.service'
import { buildFinanzasWorkbook } from '@angular-app/features/expenses/presentation/services/expense-export'
import type { ExpenseFormValue } from '@angular-app/features/expenses/presentation/forms/expense-form.factory'
import { EmpleadoFormDialog } from '@angular-app/features/expenses/presentation/dialogs/empleado-form.dialog'
import { NominaPagoDialog } from '@angular-app/features/expenses/presentation/dialogs/nomina-pago.dialog'
import { voidExpense } from '@angular-app/features/expenses/domain/usecases/void-expense.use-case'
import {
  buildFinancialSummary,
  type FinancialSummary,
  type PaymentBreakdownInput,
} from '@angular-app/features/expenses/domain/services/financial-summary'
import {
  buildReinvestmentFund,
  type ReinvestmentFund,
  type ReinvestmentFundTotals,
} from '@angular-app/features/expenses/domain/services/reinvestment-fund'
import { pagadoPorEmpleado } from '@angular-app/features/expenses/domain/services/nomina'
import {
  buildMonthlyComparison,
  lastMonths,
  type MonthlyComparisonRow,
} from '@angular-app/features/expenses/domain/services/monthly-comparison'
import type {
  Empleado,
  Expense,
  ExpenseCategory,
  ExpenseTemplate,
  ReinvestmentFundSettings,
} from '@angular-app/features/expenses/domain/entities/expense.entity'

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
    ReinvestmentFundComponent,
    FundSettingsDialog,
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

          <mo-reinvestment-fund
            [fund]="fund()"
            (configureRequested)="fundDialogOpen.set(true)"
          />

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

    <mo-fund-settings-dialog
      [open]="fundDialogOpen()"
      [settings]="fundSettings()"
      (closed)="fundDialogOpen.set(false)"
      (saved)="onFundSettingsSaved($event)"
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
  readonly entradasPorMetodo = signal<PaymentBreakdownInput[]>([])
  readonly costoProductos = signal<number | null>(null)
  readonly ventasSinCosto = signal(0)
  readonly unidadesSinCosto = signal(0)
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
  readonly fundSettings = signal<ReinvestmentFundSettings | null>(null)
  readonly fundTotals = signal<ReinvestmentFundTotals | null>(null)
  readonly fundDialogOpen = signal(false)

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
      paymentBreakdown: this.entradasPorMetodo(),
      costoProductosVendidos: this.costoProductos(),
      ventasSinCosto: this.ventasSinCosto(),
      unidadesSinCosto: this.unidadesSinCosto(),
      gastos: this.expenses(),
      categorias: this.categorias(),
    }),
  )

  readonly fund = computed<ReinvestmentFund | null>(() => {
    const settings = this.fundSettings()
    const totals = this.fundTotals()
    if (!settings || !totals) return null
    return buildReinvestmentFund({ saldoInicial: settings.saldoInicial, ...totals })
  })

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
      const [categorias, expenses, empleados, templates, report, fundSettings] =
        await Promise.all([
          this.repo.listCategories(auth.tiendaId),
          this.repo.listExpenses(auth.tiendaId, from, to),
          this.repo.listEmpleados(auth.tiendaId),
          this.repo.listTemplates(auth.tiendaId),
          this.reportsService.getDailyReport(auth.tiendaId, from, to),
          this.repo.getFundSettings(auth.tiendaId),
        ])
      this.categorias.set(categorias)
      this.expenses.set(expenses)
      this.empleados.set(empleados)
      this.templates.set(templates)
      this.entradasTotales.set(report.totalVentas)
      this.entradasPorMetodo.set(report.paymentBreakdown.map((p) => ({ metodo: p.metodo, total: p.total })))
      this.fundSettings.set(fundSettings)
      await this.loadFundTotals(auth.tiendaId)

      const costos = report.productSales
        .map((p) => p.costoTotal)
        .filter((c): c is number => c !== null)
      this.costoProductos.set(costos.length > 0 ? costos.reduce((s, c) => s + c, 0) : null)
      const sinCosto = report.productSales.filter((p) => p.costoTotal === null && p.qty > 0)
      this.ventasSinCosto.set(sinCosto.length)
      this.unidadesSinCosto.set(sinCosto.reduce((sum, p) => sum + p.qty, 0))

      await this.loadComparison(auth.tiendaId)
    } catch (error) {
      this.loadError.set(getErrorMessage(error, 'Error al cargar'))
    } finally {
      this.loading.set(false)
    }
  }

  /** Totales del fondo desde su fecha de inicio + desglose del mes visible. */
  private async loadFundTotals(tiendaId: string): Promise<void> {
    const settings = this.fundSettings()
    if (!settings) {
      this.fundTotals.set(null)
      return
    }
    const month = this.month()
    const desdeIso = new Date(`${settings.fechaInicio}T00:00:00`).toISOString()
    const mesDesdeIso = new Date(`${month}-01T00:00:00`).toISOString()
    const mesHastaIso = new Date(`${shiftMonth(month, 1)}-01T00:00:00`).toISOString()
    this.fundTotals.set(await this.repo.getFundTotals(tiendaId, desdeIso, mesDesdeIso, mesHastaIso))
  }

  async onFundSettingsSaved(settings: ReinvestmentFundSettings): Promise<void> {
    this.fundSettings.set(settings)
    try {
      const auth = await this.session.getAuthContext()
      if (auth) await this.loadFundTotals(auth.tiendaId)
    } catch (error) {
      this.toast.error(getErrorMessage(error, 'No se pudo actualizar el fondo'))
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
          fund: this.fund(),
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
