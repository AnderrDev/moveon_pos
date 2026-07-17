import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core'
import { getErrorMessage } from '@/shared/lib/error-message'
import { formatCurrency } from '@/shared/lib/format'
import { DialogComponent } from '../../shared/organisms/dialog.component'
import { ButtonComponent } from '../../shared/atoms/button.component'
import { BadgeComponent } from '../../shared/atoms/badge.component'
import { SessionService } from '../../core/auth/session.service'
import { ToastService } from '../../shared/organisms/toast/toast.service'
import { ExpensesRepository } from './expenses.repository'
import { templateStatusForMonth } from '@/modules/expenses/domain/services/recurrentes'
import type {
  Expense,
  ExpenseCategory,
  ExpenseTemplate,
} from '@/modules/expenses/domain/entities/expense.entity'

/**
 * "Gastos del mes": cruza las plantillas recurrentes con los gastos ya
 * registrados en el mes visible. "Usar" abre el form de gasto prellenado
 * (el padre decide); aquí solo se gestionan las plantillas.
 */
@Component({
  selector: 'mo-recurrentes-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DialogComponent, ButtonComponent, BadgeComponent],
  template: `
    <mo-dialog
      [open]="open()"
      title="Gastos recurrentes del mes"
      description="Plantillas de gastos fijos: registra los pendientes del mes con un clic."
      width="lg"
      (closed)="closed.emit()"
    >
      @if (statuses().length === 0) {
        <p class="text-muted-foreground py-4 text-center text-sm">
          Sin plantillas todavía. Crea una para el arriendo, los servicios o cualquier gasto fijo.
        </p>
      } @else {
        <ul class="divide-y">
          @for (item of statuses(); track item.template.id) {
            <li class="flex flex-wrap items-center justify-between gap-3 py-3">
              <div class="min-w-0">
                <p class="font-semibold">{{ item.template.concepto }}</p>
                <p class="text-muted-foreground text-xs">
                  {{ categoryName(item.template.categoryId) }} ·
                  {{ item.template.frecuencia === 'mensual' ? 'Mensual' : 'Quincenal' }} ·
                  Sugerido: {{ money(item.template.montoSugerido) }}
                </p>
              </div>
              <div class="flex items-center gap-2">
                @if (item.registrado) {
                  <mo-badge variant="success">Registrado este mes</mo-badge>
                } @else {
                  <mo-button size="sm" (click)="useRequested.emit(item.template)">
                    Registrar
                  </mo-button>
                }
                <mo-button size="sm" variant="ghost" (click)="confirmDelete(item.template)">
                  Eliminar
                </mo-button>
              </div>
            </li>
          }
        </ul>
      }

      <div class="flex justify-between gap-2 border-t pt-4">
        <mo-button variant="outline" (click)="newRequested.emit()">+ Nueva plantilla</mo-button>
        <mo-button variant="ghost" (click)="closed.emit()">Cerrar</mo-button>
      </div>
    </mo-dialog>
  `,
})
export class RecurrentesDialog {
  private readonly repo = inject(ExpensesRepository)
  private readonly session = inject(SessionService)
  private readonly toast = inject(ToastService)

  readonly open = input<boolean>(false)
  readonly templates = input.required<ExpenseTemplate[]>()
  readonly categorias = input.required<ExpenseCategory[]>()
  /** Gastos del mes visible (para marcar plantillas ya registradas). */
  readonly expenses = input.required<Expense[]>()
  /** Mes visible `YYYY-MM`. */
  readonly month = input.required<string>()

  readonly closed = output<void>()
  readonly useRequested = output<ExpenseTemplate>()
  readonly newRequested = output<void>()
  readonly deleted = output<string>()

  readonly statuses = computed(() =>
    templateStatusForMonth(this.templates(), this.expenses(), this.month()),
  )

  private readonly nombreById = computed(
    () => new Map(this.categorias().map((c) => [c.id, c.nombre])),
  )

  categoryName(id: string): string {
    return this.nombreById().get(id) ?? 'Sin categoría'
  }

  money(v: number): string {
    return formatCurrency(v)
  }

  async confirmDelete(template: ExpenseTemplate): Promise<void> {
    if (!window.confirm(`¿Eliminar la plantilla "${template.concepto}"?`)) return
    try {
      const auth = await this.session.getAuthContext()
      if (!auth) throw new Error('No autenticado')
      await this.repo.deleteTemplate(template.id, auth.tiendaId)
      this.toast.success('Plantilla eliminada')
      this.deleted.emit(template.id)
    } catch (error) {
      this.toast.error(getErrorMessage(error, 'No se pudo eliminar'))
    }
  }
}
