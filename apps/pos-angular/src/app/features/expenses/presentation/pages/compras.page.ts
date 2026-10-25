import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core'
import { RouterLink } from '@angular/router'
import { getErrorMessage } from '@/shared/lib/error-message'
import { storeDateIso } from '@/shared/lib/day-range'
import { PageHeaderComponent } from '@angular-app/shared/molecules/page-header.component'
import { ButtonComponent } from '@angular-app/shared/atoms/button.component'
import { BadgeComponent } from '@angular-app/shared/atoms/badge.component'
import { EmptyStateComponent } from '@angular-app/shared/molecules/empty-state.component'
import { SkeletonComponent } from '@angular-app/shared/atoms/skeleton.component'
import { TableShellComponent } from '@angular-app/shared/molecules/table/table-shell.component'
import { MO_TABLE } from '@angular-app/shared/molecules/table/table.directives'
import { MoneyPipe } from '@angular-app/shared/pipes/money.pipe'
import { SessionService } from '@angular-app/core/auth/session.service'
import { TiendaInfoService } from '@angular-app/core/tienda/tienda-info.service'
import { ProductsCacheStore } from '@angular-app/core/catalog/products-cache.store'
import { ToastService } from '@angular-app/shared/organisms/toast/toast.service'
import { ExcelExportService } from '@angular-app/shared/services/export/excel-export.service'
import { InventoryRepository } from '@angular-app/features/inventory/domain/repositories/inventory.repository'
import {
  buildPurchasePlan,
  HISTORY_DAYS,
  type ConsumptionRecord,
  type PurchaseLineStatus,
  type PurchaseProductInput,
} from '@angular-app/features/inventory/domain/services/purchase-suggestions'
import { ExpenseRepository } from '@angular-app/features/expenses/domain/repositories/expense.repository'
import { buildReinvestmentFund } from '@angular-app/features/expenses/domain/services/reinvestment-fund'
import { buildFixedCommitments } from '@angular-app/features/expenses/domain/services/fixed-commitments'
import { buildPurchaseListWorkbook } from '@angular-app/features/expenses/presentation/services/purchase-list-export'

const COVER_OPTIONS = [7, 14, 21, 30] as const

const STATUS_BADGE: Record<PurchaseLineStatus, { label: string; variant: 'success' | 'warning' | 'destructive' | 'default' }> = {
  full: { label: 'Comprar', variant: 'success' },
  partial: { label: 'Parcial', variant: 'warning' },
  over_budget: { label: 'Sin presupuesto', variant: 'destructive' },
  no_cost: { label: 'Sin costo', variant: 'default' },
}

function monthStartIso(month: string): string {
  return new Date(`${month}-01T00:00:00`).toISOString()
}

function nextMonthStartIso(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m, 1).toISOString()
}

/**
 * Lista de compras sugerida (Finanzas → Lista de compras). Pronostica el
 * consumo de cada producto con sus ventas recientes, calcula qué comprar para
 * cubrir los días elegidos y lo limita al presupuesto, que arranca en lo
 * disponible del fondo de reinversión y se puede editar.
 */
@Component({
  selector: 'mo-compras-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    PageHeaderComponent,
    ButtonComponent,
    BadgeComponent,
    EmptyStateComponent,
    SkeletonComponent,
    TableShellComponent,
    MO_TABLE,
    MoneyPipe,
  ],
  template: `
    <section class="flex h-full min-h-0 flex-col gap-4">
      <mo-page-header title="Lista de compras" subtitle="Qué surtir sin gastar más de lo que tienes">
        <a
          routerLink="/finanzas"
          class="border-input bg-card hover:bg-accent inline-flex h-10 items-center rounded-lg border px-4 text-sm font-semibold"
          >Volver a Finanzas</a
        >
        <mo-button
          variant="outline"
          [loading]="exporting()"
          loadingText="Generando..."
          [disabled]="loading() || plan().lines.length === 0"
          (click)="exportList()"
        >
          Descargar Excel
        </mo-button>
      </mo-page-header>

      @if (loading()) {
        <mo-skeleton heightClass="h-72" />
      } @else if (loadError()) {
        <mo-empty-state title="No se pudo armar la lista" [description]="loadError()">
          <mo-button (click)="load()">Reintentar</mo-button>
        </mo-empty-state>
      } @else {
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label class="bg-card block rounded-xl border p-4">
            <span class="text-muted-foreground text-sm font-medium">Presupuesto para comprar</span>
            <input
              type="number"
              min="0"
              step="1000"
              inputmode="numeric"
              [value]="budget()"
              (input)="onBudget($event)"
              class="border-input bg-background focus:ring-ring mt-1.5 h-10 w-full rounded-lg border px-3 text-lg font-bold tabular-nums focus:ring-2 focus:outline-none"
            />
            <span class="text-muted-foreground mt-1 block text-xs">
              Fondo disponible: {{ (fondoDisponible() | money) }}
            </span>
          </label>
          <label class="bg-card block rounded-xl border p-4">
            <span class="text-muted-foreground text-sm font-medium">Que alcance para</span>
            <select
              (change)="onCover($event)"
              class="border-input bg-background focus:ring-ring mt-1.5 h-10 w-full rounded-lg border px-3 text-sm font-semibold focus:ring-2 focus:outline-none"
            >
              @for (days of coverOptions; track days) {
                <!-- [selected] por opción: las opciones del @for se crean después del select. -->
                <option [value]="days" [selected]="days === coverDays()">{{ days }} días</option>
              }
            </select>
            <span class="text-muted-foreground mt-1 block text-xs">Según lo vendido en las últimas 8 semanas</span>
          </label>
          <div class="bg-card rounded-xl border p-4">
            <p class="text-muted-foreground text-sm font-medium">Total sugerido</p>
            <p class="font-display mt-1.5 text-[1.6rem] leading-tight font-extrabold tabular-nums">{{ (plan().total | money) }}</p>
            <p class="text-muted-foreground mt-1 text-xs">Lo necesario sería {{ (plan().totalNecesario | money) }}</p>
          </div>
          <div class="bg-card rounded-xl border p-4">
            <p class="text-muted-foreground text-sm font-medium">Queda del presupuesto</p>
            <p class="font-display mt-1.5 text-[1.6rem] leading-tight font-extrabold tabular-nums">{{ (plan().restante ?? 0) | money }}</p>
            @if (fijosPendientes() > 0) {
              <p class="mt-1 text-xs text-amber-700">
                Este mes faltan {{ (fijosPendientes() | money) }} de gastos fijos (arriendo, nómina): no salen de aquí, pero tenlos presentes.
              </p>
            }
          </div>
        </div>

        <div class="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <select
            [value]="proveedor()"
            (change)="proveedor.set(value($event))"
            aria-label="Filtrar por proveedor"
            class="border-input bg-card focus:ring-ring h-10 rounded-lg border px-3 text-sm focus:ring-2 focus:outline-none"
          >
            <option value="">Todos los proveedores</option>
            @for (prov of proveedores(); track prov) {
              <option [value]="prov" [selected]="prov === proveedor()">{{ prov }}</option>
            }
            <option value="__sin__">Sin proveedor</option>
          </select>
          <label class="border-input bg-card flex h-10 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm select-none">
            <input type="checkbox" [checked]="soloComprar()" (change)="soloComprar.set(!soloComprar())" class="accent-primary h-4 w-4" />
            Solo lo que entra en el presupuesto
          </label>
        </div>

        @if (visibleLines().length === 0) {
          <mo-empty-state
            title="Nada que comprar"
            description="Con lo vendido en las últimas semanas, el stock actual alcanza para los días elegidos."
          />
        } @else {
          <mo-table-shell class="flex-1">
            <table moTable>
              <thead moThead>
                <tr>
                  <th moTh>Producto</th>
                  <th moTh class="text-right">Stock</th>
                  <th moTh class="text-right">Venta/día</th>
                  <th moTh class="text-right">Alcanza</th>
                  <th moTh class="text-right">Necesario</th>
                  <th moTh class="text-right">Comprar</th>
                  <th moTh class="text-right">Costo u.</th>
                  <th moTh class="text-right">Subtotal</th>
                  <th moTh></th>
                </tr>
              </thead>
              <tbody class="divide-y">
                @for (line of visibleLines(); track line.productId) {
                  <tr class="hover:bg-muted/30">
                    <td moTd>
                      <div class="font-semibold">{{ line.nombre }}</div>
                      <div class="text-muted-foreground text-xs">{{ line.proveedorNombre ?? 'Sin proveedor' }}</div>
                    </td>
                    <td moTd class="text-right tabular-nums">{{ line.stockActual }}</td>
                    <td moTd class="text-right tabular-nums">{{ line.consumoDiario }}</td>
                    <td
                      moTd
                      class="text-right tabular-nums"
                      [class.text-destructive]="line.diasQueAlcanza !== null && line.diasQueAlcanza < 3"
                      [class.font-bold]="line.diasQueAlcanza !== null && line.diasQueAlcanza < 3"
                    >
                      {{ line.diasQueAlcanza === null ? '—' : line.diasQueAlcanza + ' d' }}
                    </td>
                    <td moTd class="text-muted-foreground text-right tabular-nums">{{ line.necesario }}</td>
                    <td moTd class="text-right text-base font-bold tabular-nums">{{ line.sugerido }}</td>
                    <td moTd class="text-muted-foreground text-right tabular-nums">
                      {{ line.costoUnitario === null ? '—' : (line.costoUnitario | money) }}
                    </td>
                    <td moTd class="text-right font-semibold tabular-nums">{{ (line.subtotal | money) }}</td>
                    <td moTd>
                      <mo-badge [variant]="badge(line.status).variant">{{ badge(line.status).label }}</mo-badge>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
            <p class="text-muted-foreground px-4 py-3 text-xs">
              Orden: primero lo que antes se agota; a igual urgencia, lo que más margen deja. La venta
              diaria pesa más las últimas 2 semanas e incluye lo que consumen batidos y combos.
              "Sin presupuesto": no alcanza ni para una unidad; sube el presupuesto o baja los días.
            </p>
          </mo-table-shell>
        }
      }
    </section>
  `,
})
export class ComprasPage {
  private readonly session = inject(SessionService)
  private readonly tiendaInfo = inject(TiendaInfoService)
  private readonly catalog = inject(ProductsCacheStore)
  private readonly inventoryRepo = inject(InventoryRepository)
  private readonly expenseRepo = inject(ExpenseRepository)
  private readonly excel = inject(ExcelExportService)
  private readonly toast = inject(ToastService)

  readonly coverOptions = COVER_OPTIONS

  readonly loading = signal(true)
  readonly loadError = signal<string | null>(null)
  readonly exporting = signal(false)

  readonly products = signal<PurchaseProductInput[]>([])
  readonly stock = signal<ReadonlyMap<string, number>>(new Map())
  readonly consumption = signal<ConsumptionRecord[]>([])
  readonly fondoDisponible = signal(0)
  readonly fijosPendientes = signal(0)

  readonly budget = signal(0)
  readonly coverDays = signal<number>(14)
  readonly proveedor = signal('')
  readonly soloComprar = signal(false)

  readonly plan = computed(() =>
    buildPurchasePlan(this.filteredProducts(), this.stock(), this.consumption(), {
      coverDays: this.coverDays(),
      budget: this.budget(),
      now: new Date(),
    }),
  )

  readonly proveedores = computed(() =>
    [...new Set(this.products().map((p) => p.proveedorNombre).filter((p): p is string => !!p))].sort((a, b) =>
      a.localeCompare(b, 'es'),
    ),
  )

  /** El filtro de proveedor actúa antes del presupuesto: el tope es para ese pedido. */
  private readonly filteredProducts = computed(() => {
    const prov = this.proveedor()
    if (!prov) return this.products()
    if (prov === '__sin__') return this.products().filter((p) => !p.proveedorNombre)
    return this.products().filter((p) => p.proveedorNombre === prov)
  })

  readonly visibleLines = computed(() =>
    this.soloComprar() ? this.plan().lines.filter((l) => l.sugerido > 0) : this.plan().lines,
  )

  constructor() {
    void this.load()
  }

  async load(): Promise<void> {
    this.loading.set(true)
    this.loadError.set(null)
    try {
      const auth = await this.session.getAuthContext()
      if (!auth) throw new Error('No autenticado')
      const { timezone } = await this.tiendaInfo.get(auth.tiendaId)
      const month = storeDateIso(new Date(), timezone).slice(0, 7)
      const historyFrom = new Date(Date.now() - HISTORY_DAYS * 24 * 60 * 60 * 1000).toISOString()

      const [catalog, levels, consumption, settings, templates, empleados, gastos] = await Promise.all([
        this.catalog.ensureProducts(auth.tiendaId, { force: true }),
        this.inventoryRepo.getStockLevels(auth.tiendaId),
        this.inventoryRepo.getConsumption(auth.tiendaId, historyFrom),
        this.expenseRepo.getFundSettings(auth.tiendaId),
        this.expenseRepo.listTemplates(auth.tiendaId),
        this.expenseRepo.listEmpleados(auth.tiendaId),
        this.expenseRepo.listExpenses(auth.tiendaId, `${month}-01`, `${month}-31`),
      ])

      this.products.set(
        catalog
          .filter((p) => p.isActive && !p.deletedAt)
          .map((p) => ({
            id: p.id,
            nombre: p.nombre,
            tipo: p.tipo,
            costo: p.costo,
            precioVenta: p.precioVenta,
            stockMinimo: p.stockMinimo,
            proveedorNombre: p.proveedorNombre,
            createdAt: p.createdAt,
          })),
      )
      this.stock.set(new Map(levels.map((l) => [l.productId, l.totalStock])))
      this.consumption.set(consumption)

      let disponible = 0
      if (settings) {
        const desde = new Date(`${settings.fechaInicio}T00:00:00`).toISOString()
        const totals = await this.expenseRepo.getFundTotals(auth.tiendaId, desde, monthStartIso(month), nextMonthStartIso(month))
        disponible = buildReinvestmentFund({ saldoInicial: settings.saldoInicial, ...totals }).disponible
      }
      this.fondoDisponible.set(disponible)
      this.budget.set(Math.max(0, Math.round(disponible)))
      this.fijosPendientes.set(buildFixedCommitments({ templates, empleados, gastos, month }).pendiente)
    } catch (error) {
      this.loadError.set(getErrorMessage(error, 'Error al armar la lista de compras'))
    } finally {
      this.loading.set(false)
    }
  }

  onBudget(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value)
    this.budget.set(Number.isFinite(value) && value > 0 ? value : 0)
  }

  onCover(event: Event): void {
    this.coverDays.set(Number((event.target as HTMLSelectElement).value))
  }

  value(event: Event): string {
    return (event.target as HTMLSelectElement).value
  }

  badge(status: PurchaseLineStatus) {
    return STATUS_BADGE[status]
  }

  async exportList(): Promise<void> {
    this.exporting.set(true)
    try {
      await this.excel.download(buildPurchaseListWorkbook(this.plan(), this.coverDays()))
      this.toast.success('Lista de compras descargada')
    } catch (error) {
      this.toast.error(getErrorMessage(error, 'No se pudo generar el archivo'))
    } finally {
      this.exporting.set(false)
    }
  }
}
