import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core'
import { ButtonComponent } from '@angular-app/shared/atoms/button.component'
import { CardComponent } from '@angular-app/shared/atoms/card.component'
import { EmptyStateComponent } from '@angular-app/shared/molecules/empty-state.component'
import { TableShellComponent } from '@angular-app/shared/molecules/table/table-shell.component'
import { MO_TABLE } from '@angular-app/shared/molecules/table/table.directives'
import { formatCurrency } from '@/shared/lib/format'
import type { CashHistoryDay, CashHistoryDaysPage } from '../../domain/services/cash-history'

@Component({
 selector: 'mo-cash-history-days', standalone: true, changeDetection: ChangeDetectionStrategy.OnPush,
 imports: [ButtonComponent, CardComponent, EmptyStateComponent, TableShellComponent, MO_TABLE],
 template: `
  <p class="text-muted-foreground mb-3 text-xs">Agrupado por fecha de cierre. El efectivo final corresponde al último cierre del día, después de retirar efectivo.</p>
  @if (!page().items.length) { <mo-empty-state title="No hay cierres en este rango" description="Cambia las fechas o limpia los filtros." /> }
  @else {
   <div class="hidden lg:block"><mo-table-shell><table moTable density="compact">
    <caption class="sr-only">Seguimiento diario de caja</caption>
    <thead moThead><tr><th moTh>Fecha</th><th moTh class="text-right">Venta total</th><th moTh class="text-right">Efectivo</th><th moTh class="text-right">Transferencia</th><th moTh class="text-right">Gastos</th><th moTh class="text-right">Ingreso extra</th><th moTh class="text-right">Efectivo final</th><th moTh>Observaciones</th><th moTh><span class="sr-only">Turnos</span></th></tr></thead>
    <tbody>@for (d of page().items; track d.day) {
     <tr moTr [hover]="true"><td moTd class="whitespace-nowrap"><p class="font-semibold">{{ date(d.day) }}</p><p class="text-muted-foreground text-xs">{{ d.turnCount }} turnos</p></td>
      <td moTd class="text-right font-semibold tabular-nums">{{ money(d.salesTotal) }}</td><td moTd class="text-right tabular-nums">{{ money(d.cashTotal) }}</td><td moTd class="text-right tabular-nums">{{ money(d.transferTotal) }}</td><td moTd class="text-right tabular-nums">{{ money(d.expensesTotal) }}</td><td moTd class="text-right tabular-nums">{{ money(d.extraIncomeTotal) }}</td><td moTd class="text-right tabular-nums"><p class="font-semibold">{{ money(d.finalCashLeft) }}</p><p class="text-muted-foreground mt-1 whitespace-nowrap text-xs">Retiros {{ money(d.withdrawalsTotal) }}</p></td><td moTd class="max-w-48 break-words text-xs">{{ d.notes.join(' · ') || '—' }}</td><td moTd><mo-button size="xs" variant="outline" (click)="selected.emit(d.day)">{{ selectedDay() === d.day ? 'Ocultar turnos' : 'Ver turnos' }}</mo-button></td>
     </tr>
    }</tbody>
   </table></mo-table-shell></div>
   <div class="space-y-3 lg:hidden">@for (d of page().items; track d.day) {
    <mo-card><div class="flex items-center justify-between gap-2"><h2 class="font-semibold">{{ date(d.day) }}</h2><span class="text-muted-foreground text-xs">{{ d.turnCount }} turnos</span></div>
     <dl class="mt-3 grid grid-cols-2 gap-3 text-sm">@for (field of fields(d); track field.label) { <div><dt class="text-muted-foreground text-xs">{{ field.label }}</dt><dd class="font-semibold tabular-nums">{{ money(field.value) }}</dd></div> }</dl>
     @if (d.notes.length) { <p class="text-muted-foreground mt-3 break-words text-xs">{{ d.notes.join(' · ') }}</p> }
     <mo-button class="mt-3 block" size="sm" variant="outline" (click)="selected.emit(d.day)">{{ selectedDay() === d.day ? 'Ocultar turnos' : 'Ver turnos' }}</mo-button>
    </mo-card>
   }</div>
  }
  <div class="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm"><p class="text-muted-foreground">{{ page().items.length }} de {{ page().total }} días</p><div class="flex items-center gap-3"><mo-button size="sm" variant="outline" [disabled]="page().page <= 1" (click)="pageChanged.emit(page().page - 1)">Anterior</mo-button><span>Página {{ page().page }} de {{ totalPages() }}</span><mo-button size="sm" variant="outline" [disabled]="page().page >= totalPages()" (click)="pageChanged.emit(page().page + 1)">Siguiente</mo-button></div></div>
 `,
})
export class CashHistoryDaysComponent {
 readonly page = input.required<CashHistoryDaysPage>()
 readonly selectedDay = input<string | null>(null)
 readonly selected = output<string>()
 readonly pageChanged = output<number>()
 readonly totalPages = computed(() => Math.max(1, Math.ceil(this.page().total / this.page().pageSize)))
 money(value: number | null): string { return value === null ? '—' : formatCurrency(value) }
 date(day: string): string { return day.split('-').reverse().join('/') }
 fields(d: CashHistoryDay): { label: string; value: number | null }[] { return [
  { label: 'Venta total', value: d.salesTotal }, { label: 'Efectivo final', value: d.finalCashLeft },
  { label: 'Venta efectivo', value: d.cashTotal }, { label: 'Transferencia', value: d.transferTotal },
  { label: 'Gastos', value: d.expensesTotal }, { label: 'Ingreso extra', value: d.extraIncomeTotal },
  { label: 'Retiros del día', value: d.withdrawalsTotal },
 ] }
}
