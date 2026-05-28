import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core'
import { getErrorMessage } from '@/shared/lib/error-message'
import { DialogComponent } from '../../shared/ui/dialog.component'
import { ButtonComponent } from '../../shared/ui/button.component'
import { BadgeComponent } from '../../shared/ui/badge.component'
import { SalesRepository } from '../sales/sales.repository'
import { SessionService } from '../../core/auth/session.service'
import { canVoidSale } from '../../core/auth/role-policy'
import { ToastService } from '../../shared/feedback/toast.service'
import { ReceiptPrintService } from './receipt-print.service'
import { VoidReasonDialog } from './void-reason.dialog'
import { selectSessionSales } from './sales-history.session-filter'
import { formatCurrency, formatTime } from '@/shared/lib/format'
import { getPaymentMethodLabel } from '@/shared/lib/payment-methods'
import type { Sale } from '@/modules/sales/domain/entities/sale.entity'

@Component({
  selector: 'mo-sales-history-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DialogComponent, ButtonComponent, BadgeComponent, VoidReasonDialog],
  template: `
    <mo-dialog
      [open]="open()"
      title="Ventas del turno"
      description="Anula o reimprime ventas del cierre actual"
      width="xl"
      (closed)="closed.emit()"
    >
      @if (loading()) {
        <p class="text-muted-foreground py-6 text-center text-sm">Cargando...</p>
      } @else if (loadError()) {
        <p class="text-destructive py-6 text-center text-sm">{{ loadError() }}</p>
      } @else if (sales().length === 0) {
        <p class="text-muted-foreground py-6 text-center text-sm">
          Aun no se registran ventas en este turno.
        </p>
      } @else {
        <div class="max-h-[65vh] overflow-y-auto">
          <table class="w-full text-sm">
            <thead class="bg-muted/50 text-muted-foreground sticky top-0 text-left text-xs uppercase">
              <tr>
                <th class="px-3 py-2">Hora</th>
                <th class="px-3 py-2">No.</th>
                <th class="px-3 py-2">Pago</th>
                <th class="px-3 py-2 text-right">Items</th>
                <th class="px-3 py-2 text-right">Total</th>
                <th class="px-3 py-2">Estado</th>
                <th class="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody class="divide-y">
              @for (sale of sales(); track sale.id) {
                <tr>
                  <td class="text-muted-foreground px-3 py-2 text-xs">
                    {{ time(sale.createdAt) }}
                  </td>
                  <td class="px-3 py-2 font-mono text-xs">{{ sale.saleNumber }}</td>
                  <td class="text-muted-foreground px-3 py-2 text-xs">
                    {{ paymentSummary(sale) }}
                  </td>
                  <td class="px-3 py-2 text-right tabular-nums">
                    {{ itemCount(sale) }}
                  </td>
                  <td class="px-3 py-2 text-right font-bold tabular-nums">
                    {{ money(sale.total) }}
                  </td>
                  <td class="px-3 py-2">
                    @if (sale.status === 'voided') {
                      <mo-badge variant="destructive">Anulada</mo-badge>
                    } @else {
                      <mo-badge variant="success">OK</mo-badge>
                    }
                  </td>
                  <td class="px-3 py-2 text-right">
                    <div class="flex justify-end gap-1">
                      <mo-button size="sm" variant="ghost" (click)="reprint(sale)"
                        >Reimprimir</mo-button
                      >
                      @if (sale.status === 'completed' && canVoid()) {
                        <mo-button size="sm" variant="ghost" (click)="confirmVoid(sale)"
                          >Anular</mo-button
                        >
                      }
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </mo-dialog>

    <mo-void-reason-dialog
      [open]="voidDialogOpen()"
      [saleNumber]="voidTarget()?.saleNumber ?? null"
      (closed)="voidDialogOpen.set(false)"
      (confirmed)="onVoidConfirmed($event)"
    />
  `,
})
export class SalesHistoryDialog {
  private readonly salesRepo = inject(SalesRepository)
  private readonly session = inject(SessionService)
  private readonly toast = inject(ToastService)
  private readonly receiptPrint = inject(ReceiptPrintService)

  readonly open = input<boolean>(false)
  readonly cashSessionId = input<string | null>(null)
  readonly closed = output<void>()
  readonly changed = output<void>()

  readonly sales = signal<Sale[]>([])
  readonly loading = signal(false)
  readonly loadError = signal<string | null>(null)

  /** Venta seleccionada para anular y visibilidad del dialog de motivo. */
  readonly voidTarget = signal<Sale | null>(null)
  readonly voidDialogOpen = signal(false)

  /** Solo admin puede anular ventas (defensa en cliente; RLS protege en servidor). */
  readonly canVoid = computed(() => canVoidSale(this.session.role()))

  constructor() {
    // Asegura que el rol esté cargado para la visibilidad reactiva del botón (OnPush).
    void this.session.getRole()
    effect(() => {
      // Blindaje: cerrar la caja (o cerrar el dialog) limpia el estado para que al
      // reabrir sin sesión arranque vacío — sin un frame con ventas viejas.
      // Patrón seguro: si no hay sesión/no está abierto -> reset + return; nunca
      // se leen señales escritas aquí, así que no hay bucle de effect.
      if (!this.open() || !this.cashSessionId()) {
        this.sales.set([])
        this.loadError.set(null)
        // No dejar el dialog de motivo colgado si se cierra el historial.
        this.voidDialogOpen.set(false)
        this.voidTarget.set(null)
        return
      }
      void this.load()
    })
  }

  money(v: number): string {
    return formatCurrency(v)
  }

  time(d: Date): string {
    return formatTime(d)
  }

  itemCount(sale: Sale): number {
    return sale.items.reduce((acc, i) => acc + i.quantity, 0)
  }

  paymentSummary(sale: Sale): string {
    return sale.payments
      .map((p) => `${getPaymentMethodLabel(p.metodo)} ${formatCurrency(p.amount)}`)
      .join(' · ')
  }

  async load(): Promise<void> {
    const sid = this.cashSessionId()
    if (!sid) return
    this.loading.set(true)
    this.loadError.set(null)
    try {
      const auth = await this.session.getAuthContext()
      if (!auth) throw new Error('No autenticado')
      const rows = await this.salesRepo.listBySession(sid, auth.tiendaId)
      // Segunda barrera pura sobre lo que devuelve el repo.
      this.sales.set(selectSessionSales(rows, sid))
    } catch (error) {
      this.loadError.set(getErrorMessage(error, 'Error al cargar'))
    } finally {
      this.loading.set(false)
    }
  }

  async reprint(sale: Sale): Promise<void> {
    try {
      await this.receiptPrint.printSale(sale.id)
    } catch (error) {
      this.toast.error(getErrorMessage(error, 'No se pudo imprimir el ticket'))
    }
  }

  async confirmVoid(sale: Sale): Promise<void> {
    // Defensa en profundidad: cortocircuitar si el rol no puede anular ANTES de abrir.
    if (!canVoidSale(await this.session.getRole())) return

    this.voidTarget.set(sale)
    this.voidDialogOpen.set(true)
  }

  async onVoidConfirmed(reason: string): Promise<void> {
    // Defensa en profundidad: re-verificar el rol antes de ejecutar la anulación.
    if (!canVoidSale(await this.session.getRole())) return

    const sale = this.voidTarget()
    if (!sale) return

    const auth = await this.session.getAuthContext()
    if (!auth) return

    try {
      await this.salesRepo.voidSale(sale.id, auth.tiendaId, reason)
      this.toast.success(`Venta ${sale.saleNumber} anulada`)
      await this.load()
      this.changed.emit()
    } catch (error) {
      this.toast.error(getErrorMessage(error, 'No se pudo anular'))
    }
  }
}
