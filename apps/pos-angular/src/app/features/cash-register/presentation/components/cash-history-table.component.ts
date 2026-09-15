import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core'
import { ButtonComponent } from '@angular-app/shared/atoms/button.component'
import { BadgeComponent } from '@angular-app/shared/atoms/badge.component'
import { CardComponent } from '@angular-app/shared/atoms/card.component'
import { EmptyStateComponent } from '@angular-app/shared/molecules/empty-state.component'
import { TableShellComponent } from '@angular-app/shared/molecules/table/table-shell.component'
import { MO_TABLE } from '@angular-app/shared/molecules/table/table.directives'
import { formatCurrency } from '@/shared/lib/format'
import { getClosedPaymentSummary, type CashHistoryPage } from '../../domain/services/cash-history'
import type { CashSession } from '../../domain/entities/cash-session.entity'
@Component({
 selector: 'mo-cash-history-table', standalone: true, changeDetection: ChangeDetectionStrategy.OnPush,
 imports: [ButtonComponent, BadgeComponent, CardComponent, EmptyStateComponent, TableShellComponent, MO_TABLE],
 template: `
  @if (page().items.length === 0) {
    <mo-empty-state title="No hay cierres en este rango" description="Cambia las fechas o limpia los filtros para buscar otros turnos." />
  } @else {
    <div class="hidden lg:block">
      <mo-table-shell>
        <table moTable density="compact">
          <caption class="sr-only">Turnos cerrados y resumen de pagos</caption>
          <thead moThead><tr>
            <th moTh scope="col">Horario / responsable</th><th moTh scope="col" class="text-right">Ventas</th>
            <th moTh scope="col" class="text-right">Efectivo</th><th moTh scope="col" class="text-right">Transferencia</th>
            <th moTh scope="col" class="text-right">Caja al cierre</th><th moTh scope="col" class="text-right">Retiro / quedó</th>
            <th moTh scope="col">Cuadre</th><th moTh scope="col"><span class="sr-only">Detalle</span></th>
          </tr></thead>
          <tbody>
            @for (s of page().items; track s.id) {
              <tr moTr [hover]="true">
                <td moTd><dl class="space-y-1 text-xs"><div><dt class="text-muted-foreground">Apertura</dt><dd class="font-semibold">{{ date(s.openedAt) }}</dd></div><div><dt class="text-muted-foreground">Cierre</dt><dd class="font-semibold">{{ date(s.closedAt) }}</dd></div></dl><p class="mt-2 max-w-56 break-all text-xs">{{ closer(s) }}</p></td>
                <td moTd class="text-right font-semibold tabular-nums">{{ money(s.expectedSalesAmount) }}</td>
                <td moTd class="text-right tabular-nums">{{ money(payments(s.paymentClosure).cash.total) }}<p class="text-muted-foreground text-xs">{{ payments(s.paymentClosure).cash.count }} pagos</p></td>
                <td moTd class="text-right tabular-nums">{{ money(payments(s.paymentClosure).transfer.total) }}<p class="text-muted-foreground text-xs">{{ payments(s.paymentClosure).transfer.count }} pagos</p></td>
                <td moTd class="text-right text-xs tabular-nums"><p>Esperado {{ money(s.expectedCashAmount) }}</p><p class="mt-1 font-semibold">Contado {{ money(s.actualCashAmount) }}</p></td>
                <td moTd class="text-right text-xs tabular-nums"><p>Retiro {{ money(s.closingWithdrawalAmount) }}</p><p class="mt-1 font-semibold">Quedó {{ money(s.cashLeftAmount) }}</p></td>
                <td moTd><mo-badge [variant]="hasDifference(s) ? 'warning' : 'success'">{{ hasDifference(s) ? 'Con diferencia' : 'Cuadrado' }}</mo-badge><p class="mt-1 text-xs tabular-nums">Caja {{ money(s.difference) }}</p><p class="text-muted-foreground text-xs tabular-nums">Ventas {{ money(s.salesDifference) }}</p></td>
                <td moTd><mo-button size="xs" variant="outline" (click)="selected.emit(s)">Ver detalle</mo-button></td>
              </tr>
            }
          </tbody>
        </table>
      </mo-table-shell>
    </div>
    <div class="space-y-3 lg:hidden">
      @for (s of page().items; track s.id) {
        <mo-card>
          <div class="flex flex-wrap items-start justify-between gap-2"><p class="min-w-0 break-all text-xs">{{ closer(s) }}</p><mo-badge [variant]="hasDifference(s) ? 'warning' : 'success'">{{ hasDifference(s) ? 'Con diferencia' : 'Cuadrado' }}</mo-badge></div>
          <dl class="border-border mt-3 grid grid-cols-2 gap-3 border-b pb-3 text-sm"><div><dt class="text-muted-foreground text-xs">Apertura</dt><dd class="mt-1 font-semibold">{{ date(s.openedAt) }}</dd></div><div><dt class="text-muted-foreground text-xs">Cierre</dt><dd class="mt-1 font-semibold">{{ date(s.closedAt) }}</dd></div></dl>
          <dl class="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div><dt class="text-muted-foreground text-xs">Efectivo · {{ payments(s.paymentClosure).cash.count }} pagos</dt><dd class="font-semibold tabular-nums">{{ money(payments(s.paymentClosure).cash.total) }}</dd></div>
            <div><dt class="text-muted-foreground text-xs">Transferencia · {{ payments(s.paymentClosure).transfer.count }} pagos</dt><dd class="font-semibold tabular-nums">{{ money(payments(s.paymentClosure).transfer.total) }}</dd></div>
            <div><dt class="text-muted-foreground text-xs">Total vendido</dt><dd class="tabular-nums">{{ money(s.expectedSalesAmount) }}</dd></div>
            <div><dt class="text-muted-foreground text-xs">Esperado / contado</dt><dd class="text-xs tabular-nums">{{ money(s.expectedCashAmount) }} / {{ money(s.actualCashAmount) }}</dd></div>
            <div><dt class="text-muted-foreground text-xs">Retirado / quedó</dt><dd class="text-xs tabular-nums">{{ money(s.closingWithdrawalAmount) }} / {{ money(s.cashLeftAmount) }}</dd></div>
            <div><dt class="text-muted-foreground text-xs">Diferencia caja / ventas</dt><dd class="text-xs tabular-nums">{{ money(s.difference) }} / {{ money(s.salesDifference) }}</dd></div>
          </dl>
          <mo-button variant="outline" size="sm" class="mt-3 block" (click)="selected.emit(s)">Ver detalle</mo-button>
        </mo-card>
      }
    </div>
  }
  <div class="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
    <p class="text-muted-foreground">{{ page().items.length }} de {{ page().total }} turnos</p>
    <div class="flex items-center gap-3">
      <mo-button variant="outline" size="sm" [disabled]="page().page <= 1" (click)="pageChanged.emit(page().page - 1)">Anterior</mo-button>
      <span>Página {{ page().page }} de {{ totalPages() }}</span>
      <mo-button variant="outline" size="sm" [disabled]="page().page >= totalPages()" (click)="pageChanged.emit(page().page + 1)">Siguiente</mo-button>
    </div>
  </div>
 `,
})
export class CashHistoryTableComponent {
 readonly page = input.required<CashHistoryPage>()
 readonly timezone = input('America/Bogota')
 readonly selected = output<CashSession>()
 readonly pageChanged = output<number>()
 readonly totalPages = computed(() => Math.max(1, Math.ceil(this.page().total / this.page().pageSize)))
 readonly payments = getClosedPaymentSummary
 money(value: number | null): string { return value === null ? '—' : formatCurrency(value) }
 closer(s: CashSession): string { return s.closedByEmail ?? (s.closedBy ? `Usuario ${s.closedBy.slice(0, 8)}` : 'No disponible') }
 hasDifference(s: CashSession): boolean { return (s.difference ?? 0) !== 0 || (s.salesDifference ?? 0) !== 0 }
 date(value: Date | null): string { return value ? new Intl.DateTimeFormat('es-CO', { timeZone: this.timezone(), dateStyle: 'short', timeStyle: 'short' }).format(value) : '—' }
}
