import { ChangeDetectionStrategy, Component, ElementRef, effect, input, output, signal, viewChild } from '@angular/core'
import { ButtonComponent } from '@angular-app/shared/atoms/button.component'
import { BadgeComponent } from '@angular-app/shared/atoms/badge.component'
import { SpinnerComponent } from '@angular-app/shared/atoms/spinner.component'
import { SaleDetailListComponent } from '@angular-app/shared/organisms/sale-detail-list.component'
import { formatCurrency } from '@/shared/lib/format'
import type { CashSession, CashMovement } from '../../domain/entities/cash-session.entity'
import type { Sale } from '@angular-app/features/sales/domain/entities/sale.entity'
import { getCashMovementSummary } from '../../domain/services/cash-movement-summary'
@Component({
 selector: 'mo-cash-session-detail', standalone: true, changeDetection: ChangeDetectionStrategy.OnPush,
 imports: [ButtonComponent, BadgeComponent, SpinnerComponent, SaleDetailListComponent],
 template: `
  <dialog #dialog aria-labelledby="cash-session-detail-title" tabindex="-1" (keydown.escape)="$event.preventDefault(); closed.emit()"
    class="bg-card fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-none w-full max-w-[44rem] border-l p-0 text-foreground shadow-2xl backdrop:bg-black/50"
    (cancel)="$event.preventDefault(); closed.emit()" (click)="onBackdrop($event)">
    @if (session(); as s) {
      <div class="flex h-full flex-col">
        <header class="flex shrink-0 items-center justify-between gap-3 border-b px-5 py-4">
          <div><h2 id="cash-session-detail-title" class="font-display text-lg font-bold">Detalle del turno</h2><p class="text-muted-foreground text-xs">{{ date(s.closedAt) }}</p></div>
          <mo-button variant="ghost" size="sm" (click)="closed.emit()">Cerrar detalle</mo-button>
        </header>
        <div class="min-h-0 flex-1 space-y-6 overflow-y-auto p-5">
          <section>
            <p class="text-muted-foreground text-xs">Responsable del cierre</p>
            <p class="mt-1 break-all font-semibold">{{ s.closedByEmail ?? s.closedBy ?? 'No disponible' }}</p>
            <p class="text-muted-foreground mt-2 text-xs">Apertura {{ date(s.openedAt) }}</p>
          </section>
          <section aria-label="Resumen de cierre">
            <div class="mb-3 flex items-center justify-between"><h3 class="font-semibold">Resumen de cierre</h3><mo-badge [variant]="hasDifference(s) ? 'warning' : 'success'">{{ hasDifference(s) ? 'Con diferencia' : 'Cuadrado' }}</mo-badge></div>
            <dl class="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              @for (item of summary(s); track item.label) {
                <div><dt class="text-muted-foreground text-xs">{{ item.label }}</dt><dd class="mt-1 font-semibold tabular-nums">{{ money(item.value) }}</dd></div>
              }
            </dl>
          </section>
          @if (s.notasCierre) { <section><h3 class="mb-2 font-semibold">Nota del cierre</h3><p class="bg-muted rounded-lg p-3 text-sm whitespace-pre-wrap">{{ s.notasCierre }}</p></section> }
          @if (loading()) { <div class="flex items-center gap-2 py-6" role="status"><mo-spinner />Cargando ventas y movimientos...</div> }
          @else if (error()) { <div role="alert" class="text-destructive"><p>{{ error() }}</p><mo-button variant="outline" size="sm" (click)="retried.emit()">Reintentar detalle</mo-button></div> }
          @else {
            <section aria-label="Ingresos y gastos del turno"><h3 class="mb-3 font-semibold">Ingresos y gastos del turno</h3><dl class="grid grid-cols-2 gap-3 text-sm"><div><dt class="text-muted-foreground text-xs">Ingresos extra</dt><dd class="font-semibold tabular-nums">{{ money(flows().extraIncome) }}</dd></div><div><dt class="text-muted-foreground text-xs">Gastos</dt><dd class="font-semibold tabular-nums">{{ money(flows().expenses) }}</dd></div><div><dt class="text-muted-foreground text-xs">Retiros durante el turno</dt><dd class="font-semibold tabular-nums">{{ money(flows().withdrawals) }}</dd></div></dl><p class="text-muted-foreground mt-2 text-xs">Solo movimientos vigentes. El retiro al cierre se muestra en el resumen de cierre.</p></section>
            <mo-sale-detail-list [sales]="sales()" [expandedSaleId]="expandedSaleId()" emptyMessage="Sin ventas registradas en este turno" (toggleSale)="toggleSale($event)" />
            <section><h3 class="mb-3 font-semibold">Movimientos de efectivo</h3>
              @if (movements().length === 0) { <p class="text-muted-foreground text-sm">Sin movimientos registrados en este turno.</p> }
              @for (movement of movements(); track movement.id) {
                <div class="flex items-start justify-between gap-3 border-b py-3 text-sm"><div><p class="font-semibold">{{ movement.tipo === 'cash_in' ? 'Ingreso' : movement.tipo === 'cash_out' ? 'Retiro' : 'Gasto' }} @if (movement.status === 'voided') { <mo-badge variant="outline">Anulado</mo-badge> }</p><p class="text-muted-foreground mt-1">{{ movement.motivo }}</p><p class="text-muted-foreground text-xs">{{ date(movement.createdAt) }}</p>@if (movement.status === 'voided' && movement.voidedReason) { <p class="mt-2 text-xs"><span class="font-semibold">Motivo de anulación:</span> {{ movement.voidedReason }}</p> }</div><p class="shrink-0 tabular-nums">{{ money(movement.amount) }}</p></div>
              }
            </section>
          }
        </div>
        <footer class="shrink-0 border-t p-4"><mo-button variant="outline" [disabled]="loading() || !!error()" [loading]="exporting()" (click)="exportRequested.emit()">Descargar Excel del turno</mo-button></footer>
      </div>
    }
  </dialog>
 `,
})
export class CashSessionDetailDrawer {
 readonly session = input<CashSession | null>(null)
 readonly sales = input.required<Sale[]>()
 readonly movements = input.required<CashMovement[]>()
 readonly loading = input(false)
 readonly exporting = input(false)
 readonly error = input<string | null>(null)
 readonly timezone = input('America/Bogota')
 readonly closed = output<void>()
 readonly retried = output<void>()
 readonly exportRequested = output<void>()
 readonly expandedSaleId = signal<string | null>(null)
 flows(): ReturnType<typeof getCashMovementSummary> { return getCashMovementSummary(this.movements()) }
 private readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('dialog')
 constructor() {
   effect(() => {
     const selected = this.session()
     const dialog = this.dialog()?.nativeElement
     this.expandedSaleId.set(null)
     if (!dialog) return
     if (selected && !dialog.open) dialog.showModal()
     if (!selected && dialog.open) dialog.close()
   })
 }
 onBackdrop(event: MouseEvent): void {
   if (event.target !== this.dialog()?.nativeElement) return
   const rect = this.dialog()!.nativeElement.getBoundingClientRect()
   if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) this.closed.emit()
 }
 toggleSale(sale: Sale): void { this.expandedSaleId.update((id) => id === sale.id ? null : sale.id) }
 money(value: number | null): string { return value === null ? '—' : formatCurrency(value) }
 date(value: Date | null): string { return value ? new Intl.DateTimeFormat('es-CO', { timeZone: this.timezone(), dateStyle: 'short', timeStyle: 'short' }).format(value) : '—' }
 hasDifference(s: CashSession): boolean { return (s.difference ?? 0) !== 0 || (s.salesDifference ?? 0) !== 0 }
 summary(s: CashSession): { label: string; value: number | null }[] {
   return [{ label: 'Base de apertura', value: s.openingAmount }, { label: 'Total vendido', value: s.expectedSalesAmount }, { label: 'Efectivo esperado', value: s.expectedCashAmount }, { label: 'Efectivo contado', value: s.actualCashAmount }, { label: 'Retirado al cierre', value: s.closingWithdrawalAmount }, { label: 'Quedó en caja', value: s.cashLeftAmount }, { label: 'Diferencia de caja', value: s.difference }, { label: 'Diferencia de ventas', value: s.salesDifference }]
 }
}
