import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core'
import { ReactiveFormsModule } from '@angular/forms'
import { ButtonComponent } from '@angular-app/shared/atoms/button.component'
import { CardComponent } from '@angular-app/shared/atoms/card.component'
import { FieldWrapperComponent } from '@angular-app/shared/molecules/field-wrapper.component'
import { FormSelectComponent } from '@angular-app/shared/molecules/form-select.component'
import { CashHistoryFormPresenter } from '../presenters/cash-history-form.presenter'
import type { CashCloser } from '../../domain/services/cash-history'
@Component({
  selector: 'mo-cash-history-filters', standalone: true, changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, ButtonComponent, CardComponent, FieldWrapperComponent, FormSelectComponent],
  template: `
    <mo-card>
      <form [formGroup]="presenter().form" (ngSubmit)="apply()" class="space-y-4">
        <div class="flex flex-wrap gap-2">
          @for (preset of presets; track preset.value) {
            <mo-button size="sm" variant="outline" (click)="presenter().setPreset(preset.value)">{{ preset.label }}</mo-button>
          }
        </div>
        <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <mo-field-wrapper [error]="presenter().errors().from ?? null">
            <label for="cash-history-from" class="text-sm font-semibold">Desde</label>
            <input id="cash-history-from" type="date" formControlName="from" (change)="presenter().setCustom()" class="border-input bg-card focus:ring-ring h-11 w-full rounded-lg border px-3 text-sm focus:ring-2 focus:outline-none" />
          </mo-field-wrapper>
          <mo-field-wrapper [error]="presenter().errors().to ?? null">
            <label for="cash-history-to" class="text-sm font-semibold">Hasta</label>
            <input id="cash-history-to" type="date" formControlName="to" (change)="presenter().setCustom()" class="border-input bg-card focus:ring-ring h-11 w-full rounded-lg border px-3 text-sm focus:ring-2 focus:outline-none" />
          </mo-field-wrapper>
          <div class="flex flex-col gap-1.5"><label for="cash-history-closer" class="text-sm font-semibold">Responsable</label><mo-form-select inputId="cash-history-closer" controlName="closedBy" [options]="closerOptions()" [placeholder]="null" /></div>
          <div class="flex flex-col gap-1.5"><label for="cash-history-balance" class="text-sm font-semibold">Estado del cuadre</label><mo-form-select inputId="cash-history-balance" controlName="balanceStatus" [options]="balanceOptions" [placeholder]="null" /></div>
        </div>
        <div class="flex flex-wrap items-center justify-between gap-3">
          <p class="text-muted-foreground text-xs">Fecha del cierre · Horario de la tienda</p>
          <div class="flex gap-2">
            <mo-button variant="ghost" size="sm" (click)="cleared.emit()">Limpiar</mo-button>
            <mo-button type="submit" size="sm">Aplicar filtros</mo-button>
          </div>
        </div>
      </form>
    </mo-card>
  `,
})
export class CashHistoryFiltersComponent {
  readonly presenter = input.required<CashHistoryFormPresenter>()
  readonly closers = input.required<CashCloser[]>()
  readonly applied = output<void>()
  readonly cleared = output<void>()
  readonly presets = [{ value: 'today', label: 'Hoy' }, { value: 'yesterday', label: 'Ayer' }, { value: 'week', label: 'Últimos 7 días' }, { value: 'month', label: 'Últimos 30 días' }] as const
  readonly balanceOptions = [{ value: 'all', label: 'Todos' }, { value: 'balanced', label: 'Cuadrados' }, { value: 'difference', label: 'Con diferencia' }]
  readonly closerOptions = computed(() => [{ value: '', label: 'Todos los responsables' }, ...Array.from(new Map(this.closers().map((closer) => [closer.userId, { value: closer.userId, label: closer.email }])).values())])
  apply(): void { if (this.presenter().validate()) this.applied.emit() }
}
