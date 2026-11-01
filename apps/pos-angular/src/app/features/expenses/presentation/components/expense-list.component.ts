import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core'
import { BadgeComponent } from '@angular-app/shared/atoms/badge.component'
import { ButtonComponent } from '@angular-app/shared/atoms/button.component'
import { TableShellComponent } from '@angular-app/shared/molecules/table/table-shell.component'
import { MO_TABLE } from '@angular-app/shared/molecules/table/table.directives'
import type {
  Expense,
  ExpenseCategory,
  ExpenseMetodoPago,
} from '@angular-app/features/expenses/domain/entities/expense.entity'
import { MoneyPipe } from '@angular-app/shared/pipes/money.pipe'
import { LocalDatePipe } from '@angular-app/shared/pipes/local-date.pipe'

const METODO_LABEL: Record<ExpenseMetodoPago, string> = {
  efectivo_caja: 'Efectivo (caja)',
  efectivo_externo: 'Efectivo',
  transferencia: 'Transferencia',
  tarjeta: 'Tarjeta',
}

/**
 * Gastos del período. Tabla en pantallas medianas y grandes; en pantallas
 * pequeñas una lista compacta (la tabla de seis columnas escondía "Anular"
 * tras un scroll horizontal). Presentacional — la anulación la decide el padre.
 */
@Component({
  selector: 'mo-expense-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MoneyPipe, LocalDatePipe, BadgeComponent, ButtonComponent, TableShellComponent, MO_TABLE],
  template: `
    <ul class="bg-card divide-y rounded-xl border md:hidden">
      @for (g of expenses(); track g.id) {
        <li class="flex items-start justify-between gap-3 px-3 py-2.5" [class.opacity-60]="g.status === 'voided'">
          <div class="min-w-0">
            <p class="truncate text-sm font-medium" [class.line-through]="g.status === 'voided'">{{ g.concepto }}</p>
            <p class="text-muted-foreground text-xs">
              {{ g.fechaGasto | localDate }} · {{ categoryName(g.categoryId) }} · {{ metodoLabel(g.metodoPago) }}
            </p>
            @if (g.status === 'voided' && g.voidedReason) {
              <p class="text-destructive mt-0.5 text-xs">Anulado: {{ g.voidedReason }}</p>
            } @else if (g.notas) {
              <p class="text-muted-foreground mt-0.5 text-xs">{{ g.notas }}</p>
            }
          </div>
          <div class="flex shrink-0 flex-col items-end gap-1">
            <span class="text-sm font-semibold tabular-nums" [class.line-through]="g.status === 'voided'">
              {{ (g.monto | money) }}
            </span>
            @if (g.status === 'active') {
              <mo-button size="xs" variant="ghost" (click)="voidRequested.emit(g)">Anular</mo-button>
            } @else {
              <mo-badge variant="destructive">Anulado</mo-badge>
            }
          </div>
        </li>
      }
    </ul>

    <mo-table-shell class="hidden md:block">
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
              <td moTd class="text-muted-foreground whitespace-nowrap">{{ g.fechaGasto | localDate }}</td>
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
                {{ (g.monto | money) }}
              </td>
              <td moTd class="text-right whitespace-nowrap">
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
}
