import { ChangeDetectionStrategy, Component, input, output } from '@angular/core'
import { formatTime } from '@/shared/lib/format'
import type { CashMovement } from '@angular-app/features/cash-register/domain/entities/cash-session.entity'
import {
  cashMovementBadge,
  cashMovementLabel,
} from '@angular-app/features/cash-register/presentation/services/cash-movement-labels'
import { BadgeComponent } from '@angular-app/shared/atoms/badge.component'
import { ButtonComponent } from '@angular-app/shared/atoms/button.component'
import { MO_TABLE } from '@angular-app/shared/molecules/table/table.directives'
import { MoneyPipe } from '@angular-app/shared/pipes/money.pipe'

/** "Movimientos del turno" de /caja: lista con acciones Corregir / Anular. */
@Component({
  selector: 'mo-cash-movements-table',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'bg-card flex flex-col overflow-hidden rounded-xl border' },
  imports: [BadgeComponent, ButtonComponent, MoneyPipe, ...MO_TABLE],
  template: `
    <div class="flex shrink-0 items-center justify-between border-b px-4 py-3">
      <h3 class="font-display text-sm font-bold tracking-wide uppercase">Movimientos del turno</h3>
      <mo-badge variant="default">{{ movements().length }}</mo-badge>
    </div>

    @if (movements().length === 0) {
      <p class="text-muted-foreground p-8 text-center text-sm">Sin movimientos registrados.</p>
    } @else {
      <div class="max-h-[28rem] overflow-auto">
        <table moTable>
          <thead moThead>
            <tr>
              <th moTh>Hora</th>
              <th moTh>Tipo</th>
              <th moTh>Motivo</th>
              <th moTh class="text-right">Monto</th>
              <th moTh></th>
            </tr>
          </thead>
          <tbody>
            @for (mov of movements(); track mov.id) {
              <tr moTr [class.opacity-50]="mov.status === 'voided'">
                <td moTd class="text-muted-foreground text-xs">{{ time(mov.createdAt) }}</td>
                <td moTd>
                  <mo-badge [variant]="badge(mov)">{{ label(mov.tipo) }}</mo-badge>
                  @if (mov.status === 'voided') {
                    <mo-badge variant="default" class="ml-1">Anulado</mo-badge>
                  }
                </td>
                <td moTd class="text-muted-foreground">
                  <span [class.line-through]="mov.status === 'voided'">{{ mov.motivo }}</span>
                  @if (mov.status === 'voided') {
                    <p class="text-destructive mt-0.5 text-xs">
                      Motivo de anulación: {{ mov.voidedReason || 'Sin motivo registrado' }}
                    </p>
                  }
                </td>
                <td
                  moTd
                  class="text-right font-semibold tabular-nums"
                  [class.line-through]="mov.status === 'voided'"
                  [class.text-emerald-600]="mov.tipo === 'cash_in' && mov.status === 'active'"
                  [class.text-destructive]="mov.tipo !== 'cash_in' && mov.status === 'active'"
                >
                  {{ mov.tipo === 'cash_in' ? '+' : '−' }}{{ (mov.amount | money) }}
                </td>
                <td moTd class="text-right">
                  @if (mov.status === 'active') {
                    <div class="flex justify-end gap-1.5">
                      <mo-button size="sm" variant="outline" (click)="correct.emit(mov)">Corregir</mo-button>
                      @if (canVoid()) {
                        <mo-button size="sm" variant="outline" (click)="voidRequested.emit(mov)">Anular</mo-button>
                      }
                    </div>
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
  `,
})
export class CashMovementsTableComponent {
  readonly movements = input.required<CashMovement[]>()
  readonly canVoid = input(false)
  readonly correct = output<CashMovement>()
  readonly voidRequested = output<CashMovement>()

  time(d: Date): string {
    return formatTime(d)
  }

  label(tipo: string): string {
    return cashMovementLabel(tipo)
  }

  badge(mov: CashMovement): ReturnType<typeof cashMovementBadge> {
    return cashMovementBadge(mov)
  }
}
