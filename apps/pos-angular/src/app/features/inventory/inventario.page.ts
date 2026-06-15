import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core'
import { getErrorMessage } from '@/shared/lib/error-message'
import { PageHeaderComponent } from '../../shared/layout/page-header.component'
import { ButtonComponent } from '../../shared/ui/button.component'
import { BadgeComponent } from '../../shared/ui/badge.component'
import { EmptyStateComponent } from '../../shared/feedback/empty-state.component'
import { InventoryRepository } from './inventory.repository'
import { ProductsRepository } from '../products/products.repository'
import { SessionService } from '../../core/auth/session.service'
import { RegisterEntryDialog } from './register-entry.dialog'
import { AdjustStockDialog } from './adjust-stock.dialog'
import { TransferStockDialog } from './transfer-stock.dialog'
import { KardexDialog } from './kardex.dialog'
import type { Product } from '@/modules/products/domain/entities/product.entity'
import type { StockLevel } from '@/modules/inventory/domain/entities/inventory.entity'
import { isLowStock } from '@/modules/inventory/domain/services/low-stock'
import { ExcelExportService } from '../../shared/export/excel-export.service'
import { ToastService } from '../../shared/feedback/toast.service'
import { buildInventoryWorkbook } from './inventory-export'

interface StockRow {
  id: string
  nombre: string
  sku: string | null
  puntoVentaStock: number
  bodegaStock: number
  totalStock: number
  minimumStock: number
  isLow: boolean
}

@Component({
  selector: 'mo-inventario-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PageHeaderComponent,
    ButtonComponent,
    BadgeComponent,
    EmptyStateComponent,
    RegisterEntryDialog,
    AdjustStockDialog,
    TransferStockDialog,
    KardexDialog,
  ],
  template: `
    <section class="flex h-full min-h-0 flex-col">
      <mo-page-header title="Inventario" subtitle="Stock actual y movimientos">
        <input
          type="search"
          [value]="query()"
          (input)="onQuery($event)"
          placeholder="Buscar producto"
          class="border-input bg-card focus:ring-ring h-10 w-56 rounded-lg border px-3 text-sm focus:ring-2 focus:outline-none"
        />
        <mo-button
          variant="outline"
          [loading]="exporting()"
          loadingText="Generando..."
          [disabled]="filteredRows().length === 0"
          (click)="exportInventory()"
        >
          Descargar Excel
        </mo-button>
      </mo-page-header>

      @if (loading()) {
        <div class="bg-card flex-1 animate-pulse rounded-xl border p-8">
          <div class="bg-muted/50 h-72 rounded-xl"></div>
        </div>
      } @else if (loadError()) {
        <mo-empty-state title="No se pudo cargar inventario" [description]="loadError()">
          <mo-button (click)="load()">Reintentar</mo-button>
        </mo-empty-state>
      } @else if (filteredRows().length === 0) {
        <mo-empty-state
          title="Sin productos"
          description="Crea productos en el modulo Productos para gestionar stock."
        />
      } @else {
        <div class="bg-card flex-1 overflow-auto rounded-xl border">
          <table class="w-full text-sm">
            <thead
              class="bg-muted/50 text-muted-foreground sticky top-0 text-left text-xs tracking-wide uppercase"
            >
              <tr>
                <th class="px-4 py-3">Producto</th>
                <th class="px-4 py-3">SKU</th>
                <th class="px-4 py-3 text-right">Punto venta</th>
                <th class="px-4 py-3 text-right">Bodega</th>
                <th class="px-4 py-3 text-right">Total</th>
                <th class="px-4 py-3 text-right">Min</th>
                <th class="px-4 py-3"></th>
                <th class="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody class="divide-y">
              @for (row of filteredRows(); track row.id) {
                <tr class="hover:bg-muted/30">
                  <td class="px-4 py-3 font-semibold">{{ row.nombre }}</td>
                  <td class="text-muted-foreground px-4 py-3 font-mono text-xs">
                    {{ row.sku ?? '—' }}
                  </td>
                  <td class="px-4 py-3 text-right font-bold tabular-nums">
                    {{ row.puntoVentaStock }}
                  </td>
                  <td class="px-4 py-3 text-right font-semibold tabular-nums">
                    {{ row.bodegaStock }}
                  </td>
                  <td class="text-muted-foreground px-4 py-3 text-right tabular-nums">
                    {{ row.totalStock }}
                  </td>
                  <td class="text-muted-foreground px-4 py-3 text-right tabular-nums">
                    {{ row.minimumStock }}
                  </td>
                  <td class="px-4 py-3">
                    @if (row.isLow) {
                      <mo-badge variant="warning">Stock bajo</mo-badge>
                    }
                  </td>
                  <td class="px-4 py-3 text-right">
                    <div class="flex justify-end gap-1">
                      <mo-button size="sm" variant="outline" (click)="openEntry(row)"
                        >+ Entrada</mo-button
                      >
                      <mo-button size="sm" variant="ghost" (click)="openAdjust(row)"
                        >Ajustar</mo-button
                      >
                      <mo-button size="sm" variant="ghost" (click)="openTransfer(row)"
                        >Trasladar</mo-button
                      >
                      <mo-button size="sm" variant="ghost" (click)="openKardex(row)"
                        >Kardex</mo-button
                      >
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>

    <mo-register-entry-dialog
      [open]="entryOpen()"
      [product]="selected()"
      (closed)="entryOpen.set(false)"
      (saved)="load()"
    />

    <mo-adjust-stock-dialog
      [open]="adjustOpen()"
      [product]="selectedWithStock()"
      (closed)="adjustOpen.set(false)"
      (saved)="load()"
    />

    <mo-transfer-stock-dialog
      [open]="transferOpen()"
      [product]="selectedWithStock()"
      (closed)="transferOpen.set(false)"
      (saved)="load()"
    />

    <mo-kardex-dialog
      [open]="kardexOpen()"
      [product]="selected()"
      (closed)="kardexOpen.set(false)"
    />
  `,
})
export class InventarioPage {
  private readonly inventoryRepo = inject(InventoryRepository)
  private readonly productsRepo = inject(ProductsRepository)
  private readonly session = inject(SessionService)
  private readonly excel = inject(ExcelExportService)
  private readonly toast = inject(ToastService)

  readonly products = signal<Product[]>([])
  readonly stockLevels = signal<StockLevel[]>([])
  readonly loading = signal(true)
  readonly loadError = signal<string | null>(null)
  readonly query = signal('')
  readonly exporting = signal(false)

  readonly entryOpen = signal(false)
  readonly adjustOpen = signal(false)
  readonly transferOpen = signal(false)
  readonly kardexOpen = signal(false)
  readonly selectedRow = signal<StockRow | null>(null)

  readonly selected = computed(() => {
    const row = this.selectedRow()
    return row ? { id: row.id, nombre: row.nombre } : null
  })

  readonly selectedWithStock = computed(() => {
    const row = this.selectedRow()
    return row
      ? {
          id: row.id,
          nombre: row.nombre,
          puntoVentaStock: row.puntoVentaStock,
          bodegaStock: row.bodegaStock,
        }
      : null
  })

  readonly rows = computed<StockRow[]>(() => {
    const stockMap = new Map(this.stockLevels().map((s) => [s.productId, s] as const))
    return this.products().map((p) => {
      const stock = stockMap.get(p.id)
      const puntoVentaStock = stock?.puntoVentaStock ?? 0
      const bodegaStock = stock?.bodegaStock ?? 0
      const totalStock = stock?.totalStock ?? puntoVentaStock + bodegaStock
      return {
        id: p.id,
        nombre: p.nombre,
        sku: p.sku,
        puntoVentaStock,
        bodegaStock,
        totalStock,
        minimumStock: p.stockMinimo,
        isLow: isLowStock({
          tipo: p.tipo,
          currentStock: puntoVentaStock,
          minimumStock: p.stockMinimo,
        }),
      }
    })
  })

  readonly filteredRows = computed(() => {
    const q = this.query().trim().toLowerCase()
    if (!q) return this.rows()
    return this.rows().filter((r) => [r.nombre, r.sku ?? ''].join(' ').toLowerCase().includes(q))
  })

  constructor() {
    void this.load()
  }

  onQuery(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value)
  }

  async exportInventory(): Promise<void> {
    this.exporting.set(true)
    try {
      await this.excel.download(buildInventoryWorkbook(this.filteredRows(), this.query()))
      this.toast.success('Archivo de inventario descargado')
    } catch (error) {
      this.toast.error(getErrorMessage(error, 'No se pudo generar el archivo'))
    } finally {
      this.exporting.set(false)
    }
  }

  async load(): Promise<void> {
    this.loading.set(true)
    this.loadError.set(null)
    try {
      const auth = await this.session.getAuthContext()
      if (!auth) throw new Error('No autenticado')

      const [products, stockLevels] = await Promise.all([
        this.productsRepo.listProducts({ tiendaId: auth.tiendaId, soloActivos: true }),
        this.inventoryRepo.getStockLevels(auth.tiendaId),
      ])

      this.products.set(products)
      this.stockLevels.set(stockLevels)
    } catch (error) {
      this.loadError.set(getErrorMessage(error, 'Error al cargar inventario'))
    } finally {
      this.loading.set(false)
    }
  }

  openEntry(row: StockRow): void {
    this.selectedRow.set(row)
    this.entryOpen.set(true)
  }

  openAdjust(row: StockRow): void {
    this.selectedRow.set(row)
    this.adjustOpen.set(true)
  }

  openTransfer(row: StockRow): void {
    this.selectedRow.set(row)
    this.transferOpen.set(true)
  }

  openKardex(row: StockRow): void {
    this.selectedRow.set(row)
    this.kardexOpen.set(true)
  }
}
