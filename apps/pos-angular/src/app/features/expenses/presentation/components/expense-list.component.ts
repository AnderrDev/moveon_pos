import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core'
import { formatCurrency } from '@/shared/lib/format'
import { BadgeComponent } from '@angular-app/shared/atoms/badge.component'
import { ButtonComponent } from '@angular-app/shared/atoms/button.component'
import { TableShellComponent } from '@angular-app/shared/molecules/table/table-shell.component'
import { MO_TABLE } from '@angular-app/shared/molecules/table/table.directives'
import type {
  Expense,
  ExpenseCategory,
  ExpenseMetodoPago,
} from '@angular-app/features/expenses/domain/entities/expense.entity'

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
  imports: [BadgeComponent, ButtonComponent, TableShellComponent, MO_TABLE],
  template: `
    <mo-table-shell>
      <table moTable>
        <thead moThead>
          <tr>
            <th moTh>Fecha</th>
            <th moTh>Categoría</th>
            <th moTh>Concepto</th>
            <th moTh>Método</th>
            <th moTh class="text-right">Monto</th>
            <th moTh class="text-right">Acciones</th>
          </tr>
        </thead>
        <tbody class="divide-y">
          @for (g of expenses(); track g.id) {
            <tr class="hover:bg-muted/30" [class.opacity-60]="g.status === 'voided'">
              <td moTd class="text-muted-foreground whitespace-nowrap">{{ g.fechaGasto }}</td>
              <td moTd>{{ categoryName(g.categoryId) }}</td>
              <td moTd>
                <span [class.line-through]="g.status === 'voided'">{{ g.concepto }}</span>
                @if (g.status === 'voided' && g.voidedReason) {
                  <p class="text-destructive mt-0.5 text-xs">Anulado: {{ g.voidedReason }}</p>
                } @else if (g.notas) {
                  <p class="text-muted-foreground mt-0.5 text-xs">{{ g.notas }}</p>
                }
              </td>
              <td moTd class="text-muted-foreground whitespace-nowrap">
                {{ metodoLabel(g.metodoPago) }}
              </td>
              <td
                moTd
                class="text-right font-semibold whitespace-nowrap"
                [class.line-through]="g.status === 'voided'"
              >
                {{ money(g.monto) }}
              </td>
              <td moTd class="text-right">
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
    </mo-table-shell>
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
