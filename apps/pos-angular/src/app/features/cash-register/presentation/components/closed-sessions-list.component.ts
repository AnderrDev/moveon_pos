import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core'
import { getErrorMessage } from '@/shared/lib/error-message'
import { BadgeComponent } from '@angular-app/shared/atoms/badge.component'
import { CardComponent } from '@angular-app/shared/atoms/card.component'
import { MO_TABLE } from '@angular-app/shared/molecules/table/table.directives'
import { SaleDetailListComponent } from '@angular-app/shared/organisms/sale-detail-list.component'
import { CashRegisterRepository } from '@angular-app/features/cash-register/domain/repositories/cash-register.repository'
import { SaleRepository } from '@angular-app/features/sales/domain/repositories/sale.repository'
import { SessionService } from '@angular-app/core/auth/session.service'
import { ToastService } from '@angular-app/shared/organisms/toast/toast.service'
import { formatCurrency, formatTime, formatShortDate } from '@/shared/lib/format'
import type { CashMovement, CashSession } from '@angular-app/features/cash-register/domain/entities/cash-session.entity'
import type { Sale } from '@angular-app/features/sales/domain/entities/sale.entity'

/**
 * Historial de turnos ya cerrados (admin-only, ver `canViewClosedSessions`).
 * Cada fila resume el cierre (esperado/real/diferencia); al expandir carga
 * de forma perezosa los movimientos y ventas de esa sesión — la misma
 * información que el cajero veía mientras la caja estaba abierta, pero que
 * dejaba de ser accesible una vez cerrada.
 */
@Component({
  selector: 'mo-closed-sessions-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BadgeComponent, CardComponent, MO_TABLE, SaleDetailListComponent],
  template: `
    <mo-card padding="none">
      <div class="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h3 class="font-display text-sm font-bold tracking-wide uppercase">Turnos anteriores</h3>
          <p class="text-muted-foreground text-xs">Movimientos y ventas de cajas ya cerradas.</p>
        </div>
        <mo-badge variant="default">{{ sessions().length }}</mo-badge>
      </div>

      @if (loading()) {
        <div class="text-muted-foreground p-8 text-center text-sm">Cargando turnos...</div>
      } @else if (sessions().length === 0) {
        <p class="text-muted-foreground p-8 text-center text-sm">Aun no hay turnos cerrados.</p>
      } @else {
        <ul class="divide-y">
          @for (s of sessions(); track s.id) {
            <li>
              <button
                type="button"
                class="hover:bg-muted/30 focus:ring-ring w-full px-4 py-3 text-left transition-colors focus:ring-2 focus:outline-none"
                [attr.aria-expanded]="isExpanded(s)"
                (click)="toggleSession(s)"
              >
                <div class="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p class="text-sm font-semibold">
                      {{ shortDate(s.openedAt) }} · {{ time(s.openedAt) }} → {{ s.closedAt ? time(s.closedAt) : '—' }}
                    </p>
                    <p class="text-muted-foreground text-xs">Apertura {{ money(s.openingAmount) }}</p>
                  </div>
                  <div class="flex items-center gap-4 text-xs">
                    <div class="text-right">
                      <p class="text-muted-foreground">Caja esp.</p>
                      <p class="font-semibold tabular-nums">{{ s.expectedCashAmount !== null ? money(s.expectedCashAmount) : '—' }}</p>
                    </div>
                    <div class="text-right">
                      <p class="text-muted-foreground">Caja real</p>
                      <p class="font-semibold tabular-nums">{{ s.actualCashAmount !== null ? money(s.actualCashAmount) : '—' }}</p>
                    </div>
                    <div class="text-right">
                      <p class="text-muted-foreground">Diferencia</p>
                      <p
                        class="font-semibold tabular-nums"
                        [class.text-destructive]="(s.difference ?? 0) !== 0"
                      >
                        {{ s.difference !== null ? money(s.difference) : '—' }}
                      </p>
                    </div>
                  </div>
                </div>
              </button>

              @if (isExpanded(s)) {
                <div class="bg-muted/20 border-t p-4">
                  @if (loadingDetail()) {
                    <p class="text-muted-foreground text-sm">Cargando detalle del turno...</p>
                  } @else {
                    <div class="mb-4">
                      <h4 class="font-display mb-2 text-xs font-bold tracking-wide uppercase">
                        Movimientos ({{ expandedMovements().length }})
                      </h4>
                      @if (expandedMovements().length === 0) {
                        <p class="text-muted-foreground text-sm">Sin movimientos registrados.</p>
                      } @else {
                        <div class="bg-card overflow-auto rounded-lg border">
                          <table moTable density="compact">
                            <thead moThead class="text-left">
                              <tr>
                                <th moTh>Hora</th>
                                <th moTh>Tipo</th>
                                <th moTh>Motivo</th>
                                <th moTh class="text-right">Monto</th>
                              </tr>
                            </thead>
                            <tbody class="divide-y">
                              @for (mov of expandedMovements(); track mov.id) {
                                <tr [class.opacity-50]="mov.status === 'voided'">
                                  <td moTd class="text-muted-foreground text-xs">{{ time(mov.createdAt) }}</td>
                                  <td moTd>{{ movLabel(mov.tipo) }}</td>
                                  <td moTd class="text-muted-foreground">{{ mov.motivo }}</td>
                                  <td moTd class="text-right font-semibold tabular-nums">
                                    {{ mov.tipo === 'cash_in' ? '+' : '−' }}{{ money(mov.amount) }}
                                  </td>
                                </tr>
                              }
                            </tbody>
                          </table>
                        </div>
                      }
                    </div>

                    <mo-sale-detail-list
                      [sales]="expandedSales()"
                      [expandedSaleId]="expandedSaleId()"
                      title="Ventas del turno"
                      emptyMessage="Sin ventas registradas en este turno."
                      (toggleSale)="toggleSale($event)"
                    />
                  }
                </div>
              }
            </li>
          }
        </ul>
      }
    </mo-card>
  `,
})
export class ClosedSessionsListComponent {
  private readonly repo = inject(CashRegisterRepository)
  private readonly salesRepo = inject(SaleRepository)
  private readonly session = inject(SessionService)
  private readonly toast = inject(ToastService)

  readonly sessions = signal<CashSession[]>([])
  readonly loading = signal(true)

  readonly expandedSessionId = signal<string | null>(null)
  readonly expandedMovements = signal<CashMovement[]>([])
  readonly expandedSales = signal<Sale[]>([])
  readonly expandedSaleId = signal<string | null>(null)
  readonly loadingDetail = signal(false)

  constructor() {
    void this.load()
  }

  async load(): Promise<void> {
    this.loading.set(true)
    try {
      const auth = await this.session.getAuthContext()
      if (!auth) return
      const all = await this.repo.listSessions(auth.tiendaId, 30)
      this.sessions.set(all.filter((s) => s.status === 'closed'))
    } catch (error) {
      this.toast.error(getErrorMessage(error, 'No se pudieron cargar los turnos anteriores'))
    } finally {
      this.loading.set(false)
    }
  }

  isExpanded(s: CashSession): boolean {
    return this.expandedSessionId() === s.id
  }

  async toggleSession(s: CashSession): Promise<void> {
    if (this.isExpanded(s)) {
      this.expandedSessionId.set(null)
      return
    }

    this.expandedSessionId.set(s.id)
    this.expandedSaleId.set(null)
    this.loadingDetail.set(true)
    try {
      const auth = await this.session.getAuthContext()
      if (!auth) return
      const [movements, sales] = await Promise.all([
        this.repo.listMovements(s.id),
        this.salesRepo.listBySession(s.id, auth.tiendaId),
      ])
      this.expandedMovements.set(movements)
      this.expandedSales.set(sales)
    } catch (error) {
      this.toast.error(getErrorMessage(error, 'No se pudo cargar el detalle del turno'))
    } finally {
      this.loadingDetail.set(false)
    }
  }

  toggleSale(sale: Sale): void {
    this.expandedSaleId.set(this.expandedSaleId() === sale.id ? null : sale.id)
  }

  money(v: number): string {
    return formatCurrency(v)
  }

  time(d: Date): string {
    return formatTime(d)
  }

  shortDate(d: Date): string {
    return formatShortDate(d)
  }

  movLabel(tipo: string): string {
    if (tipo === 'cash_in') return 'Entrada'
    if (tipo === 'cash_out') return 'Salida'
    if (tipo === 'expense') return 'Gasto'
    if (tipo === 'correction') return 'Correccion'
    return tipo
  }
}
