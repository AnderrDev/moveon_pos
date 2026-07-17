import { ChangeDetectionStrategy, Component, input, output } from '@angular/core'
import { formatCurrency } from '@/shared/lib/format'
import { BadgeComponent } from '@angular-app/shared/atoms/badge.component'
import { ButtonComponent } from '@angular-app/shared/atoms/button.component'
import { CardComponent } from '@angular-app/shared/atoms/card.component'
import type { Empleado } from '@angular-app/features/expenses/domain/entities/expense.entity'

/**
 * Sección de nómina: empleados con salario acordado y lo pagado en el mes
 * visible. Presentacional — `pagado` viene calculado del padre.
 */
@Component({
  selector: 'mo-nomina-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BadgeComponent, ButtonComponent, CardComponent],
  template: `
    <mo-card padding="none">
      <div class="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h3 class="text-sm font-semibold">Nómina</h3>
          <p class="text-muted-foreground text-xs">
            Pagos del mes visible vs. salario acordado (sin cálculos legales)
          </p>
        </div>
        <mo-button size="sm" variant="outline" (click)="addRequested.emit()">+ Empleado</mo-button>
      </div>

      @if (empleados().length === 0) {
        <p class="text-muted-foreground px-4 py-6 text-center text-sm">
          Sin empleados registrados. Crea el primero para pagar nómina con un clic.
        </p>
      } @else {
        <ul class="divide-y">
          @for (emp of empleados(); track emp.id) {
            <li class="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div class="min-w-0">
                <p class="font-semibold" [class.opacity-60]="!emp.isActive">
                  {{ emp.nombre }}
                  @if (!emp.isActive) {
                    <mo-badge variant="outline">Inactivo</mo-badge>
                  }
                </p>
                <p class="text-muted-foreground text-xs">
                  {{ emp.cargo ?? 'Sin cargo' }} · Acordado: {{ money(emp.salarioMensual) }}/mes
                </p>
              </div>
              <div class="flex items-center gap-3">
                <div class="text-right">
                  <p class="text-muted-foreground text-xs">Pagado este mes</p>
                  <p
                    class="text-sm font-semibold"
                    [class.text-emerald-600]="pagadoDe(emp) >= emp.salarioMensual && emp.salarioMensual > 0"
                  >
                    {{ money(pagadoDe(emp)) }}
                  </p>
                </div>
                <div class="flex gap-1">
                  <mo-button size="sm" variant="ghost" (click)="editRequested.emit(emp)">
                    Editar
                  </mo-button>
                  @if (emp.isActive) {
                    <mo-button size="sm" (click)="payRequested.emit(emp)">Pagar</mo-button>
                  }
                </div>
              </div>
            </li>
          }
        </ul>
      }
    </mo-card>
  `,
})
export class NominaSectionComponent {
  readonly empleados = input.required<Empleado[]>()
  /** Total pagado (gastos activos con empleado) en el mes visible, por empleado. */
  readonly pagado = input.required<Map<string, number>>()

  readonly addRequested = output<void>()
  readonly editRequested = output<Empleado>()
  readonly payRequested = output<Empleado>()

  pagadoDe(emp: Empleado): number {
    return this.pagado().get(emp.id) ?? 0
  }

  money(v: number): string {
    return formatCurrency(v)
  }
}
