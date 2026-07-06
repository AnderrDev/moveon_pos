import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core'
import { formatCurrency } from '@/shared/lib/format'
import { BadgeComponent } from '../../shared/ui/badge.component'
import { ButtonComponent } from '../../shared/ui/button.component'
import type {
  Expense,
  ExpenseCategory,
  ExpenseMetodoPago,
} from '@/modules/expenses/domain/entities/expense.entity'

const METODO_LABEL: Record<ExpenseMetodoPago, string> = {
  efectivo_caja: 'Efectivo (caja)',
  efectivo_externo: 'Efectivo',
  transferencia: 'Transferencia',
  tarjeta: 'Tarjeta',
}

/** Tabla de gastos del período. Presentacional — la anulación la decide el padre. */
@Component({
  selector: 'mo-expense-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BadgeComponent, ButtonComponent],
  template: `
    <div class="bg-card overflow-auto rounded-xl border">
      <table class="w-full text-sm">
        <thead
          class="bg-muted/50 text-muted-foreground sticky top-0 text-left text-xs tracking-wide uppercase"
        >
          <tr>
            <th class="px-4 py-3">Fecha</th>
            <th class="px-4 py-3">Categoría</th>
            <th class="px-4 py-3">Concepto</th>
            <th class="px-4 py-3">Método</th>
            <th class="px-4 py-3 text-right">Monto</th>
            <th class="px-4 py-3 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody class="divide-y">
          @for (g of expenses(); track g.id) {
            <tr class="hover:bg-muted/30" [class.opacity-60]="g.status === 'voided'">
              <td class="text-muted-foreground px-4 py-3 whitespace-nowrap">{{ g.fechaGasto }}</td>
              <td class="px-4 py-3">{{ categoryName(g.categoryId) }}</td>
              <td class="px-4 py-3">
                <span [class.line-through]="g.status === 'voided'">{{ g.concepto }}</span>
                @if (g.status === 'voided' && g.voidedReason) {
                  <p class="text-destructive mt-0.5 text-xs">Anulado: {{ g.voidedReason }}</p>
                } @else if (g.notas) {
                  <p class="text-muted-foreground mt-0.5 text-xs">{{ g.notas }}</p>
                }
              </td>
              <td class="text-muted-foreground px-4 py-3 whitespace-nowrap">
                {{ metodoLabel(g.metodoPago) }}
              </td>
              <td
                class="px-4 py-3 text-right font-semibold whitespace-nowrap"
                [class.line-through]="g.status === 'voided'"
              >
                {{ money(g.monto) }}
              </td>
              <td class="px-4 py-3 text-right">
                @if (g.status === 'active') {
                  <mo-button size="sm" variant="ghost" (click)="voidRequested.emit(g)">
                    Anular
                  </mo-button>
                } @else {
                  <mo-badge variant="destructive">Anulado</mo-badge>
                }
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
})
export class ExpenseListComponent {
  readonly expenses = input.required<Expense[]>()
  readonly categorias = input.required<ExpenseCategory[]>()

  readonly voidRequested = output<Expense>()

  private readonly nombreById = computed(() => new Map(this.categorias().map((c) => [c.id, c.nombre])))

  categoryName(id: string): string {
    return this.nombreById().get(id) ?? 'Sin categoría'
  }

  metodoLabel(metodo: ExpenseMetodoPago): string {
    return METODO_LABEL[metodo]
  }

  money(v: number): string {
    return formatCurrency(v)
  }
}
