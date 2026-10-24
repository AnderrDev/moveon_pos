import { ChangeDetectionStrategy, Component, input } from '@angular/core'
import { CardComponent } from '@angular-app/shared/atoms/card.component'
import type { CashierSalesSummary } from '@angular-app/features/reports/domain/services/group-sales-by-cashier'
import { MoneyPipe } from '@angular-app/shared/pipes/money.pipe'

/** Lista "Por cajero": ventas/IVA agregados por cajero. */
@Component({
  selector: 'mo-cashier-breakdown-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MoneyPipe, CardComponent],
  template: `
    <mo-card>
      <h3 class="font-display mb-3 text-sm font-bold">Por cajero</h3>
      @if (cashierBreakdown().length === 0) {
        <p class="text-muted-foreground text-sm">Sin ventas registradas.</p>
      } @else {
        <ul class="space-y-2 text-sm">
          @for (c of cashierBreakdown(); track c.cashierId) {
            <li class="flex justify-between gap-3">
              <span class="truncate">
                {{ cashierLabel(c.cashierId) }}
                <span class="text-muted-foreground">
                  ({{ c.countCompleted }} ventas
                  @if (c.countVoided > 0) {
                    · {{ c.countVoided }} anuladas
                  }
                  )
                </span>
              </span>
              <span class="text-right">
                <span class="font-mono font-semibold tabular-nums">{{
                  (c.totalVentas | money)
                }}</span>
              </span>
            </li>
          }
        </ul>
      }
    </mo-card>
  `,
})
export class CashierBreakdownListComponent {
  readonly cashierBreakdown = input.required<CashierSalesSummary[]>()


  cashierLabel(id: string): string {
    return `Cajero ${id.slice(0, 8)}`
  }
}
