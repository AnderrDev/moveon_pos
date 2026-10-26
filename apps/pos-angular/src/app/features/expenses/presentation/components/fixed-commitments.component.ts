import { ChangeDetectionStrategy, Component, input, output } from '@angular/core'
import { ButtonComponent } from '@angular-app/shared/atoms/button.component'
import { BadgeComponent } from '@angular-app/shared/atoms/badge.component'
import { MoneyPipe } from '@angular-app/shared/pipes/money.pipe'
import type { FixedCommitments } from '@angular-app/features/expenses/domain/services/fixed-commitments'

/**
 * Gastos fijos del mes (plantillas + nómina): cuánto toca pagar, cuánto va
 * pagado y cuánto queda por pagar. El resumen avisa cómo queda la ganancia al pagarlo.
 * Presentacional.
 */
@Component({
  selector: 'mo-fixed-commitments',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, BadgeComponent, MoneyPipe],
  template: `
    <div class="bg-card rounded-xl border p-4">
      <div class="flex items-center justify-between gap-2">
        <div>
          <h3 class="text-sm font-semibold">Gastos fijos del mes</h3>
          <p class="text-muted-foreground text-xs">Arriendo y nómina del mes: lo que falta por pagar se avisa en el resumen</p>
        </div>
        <mo-button variant="outline" size="sm" (click)="manageRequested.emit()">Registrar pagos</mo-button>
      </div>

      @if (c().items.length === 0) {
        <p class="text-muted-foreground mt-3 text-sm">
          No hay fijos configurados. Crea una plantilla mensual (p. ej. arriendo) en "Gastos del mes"
          y registra a los empleados con su salario.
        </p>
      } @else {
        <ul class="mt-3 divide-y text-sm">
          @for (item of c().items; track item.key) {
            <li class="flex items-center justify-between gap-3 py-2">
              <div class="min-w-0">
                <p class="truncate font-medium">{{ item.concepto }}</p>
                <p class="text-muted-foreground text-xs">
                  {{ (item.monto | money) }} al mes · pagado {{ (item.pagado | money) }}
                </p>
              </div>
              @if (item.pendiente > 0) {
                <mo-badge variant="warning">Falta {{ (item.pendiente | money) }}</mo-badge>
              } @else {
                <mo-badge variant="success">Pagado</mo-badge>
              }
            </li>
          }
        </ul>
        <dl class="mt-2 space-y-1.5 border-t pt-2 text-sm">
          <div class="flex items-center justify-between">
            <dt class="text-muted-foreground">Total fijos del mes</dt>
            <dd class="font-semibold">{{ (c().total | money) }}</dd>
          </div>
          <div class="flex items-center justify-between">
            <dt class="font-semibold">Por pagar</dt>
            <dd class="font-bold" [class.text-amber-700]="c().pendiente > 0">{{ (c().pendiente | money) }}</dd>
          </div>
        </dl>
      }
    </div>
  `,
})
export class FixedCommitmentsComponent {
  readonly c = input.required<FixedCommitments>()
  readonly manageRequested = output<void>()
}
