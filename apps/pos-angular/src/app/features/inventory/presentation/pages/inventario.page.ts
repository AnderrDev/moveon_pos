import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core'
import { getErrorMessage } from '@/shared/lib/error-message'
import { formatCurrency } from '@/shared/lib/format'
import { PageHeaderComponent } from '@angular-app/shared/molecules/page-header.component'
import { ButtonComponent } from '@angular-app/shared/atoms/button.component'
import { BadgeComponent } from '@angular-app/shared/atoms/badge.component'
import { EmptyStateComponent } from '@angular-app/shared/molecules/empty-state.component'
import { TableShellComponent } from '@angular-app/shared/molecules/table/table-shell.component'
import { MO_TABLE } from '@angular-app/shared/molecules/table/table.directives'
import { InventoryRepository } from '@angular-app/features/inventory/domain/repositories/inventory.repository'
import { ProductRepository } from '@angular-app/features/products/domain/repositories/product.repository'
import { SessionService } from '@angular-app/core/auth/session.service'
import { RegisterEntryDialog } from '@angular-app/features/inventory/presentation/dialogs/register-entry.dialog'
import { AdjustStockDialog } from '@angular-app/features/inventory/presentation/dialogs/adjust-stock.dialog'
import { TransferStockDialog } from '@angular-app/features/inventory/presentation/dialogs/transfer-stock.dialog'
import { KardexDialog } from '@angular-app/features/inventory/presentation/dialogs/kardex.dialog'
import type { Product } from '@angular-app/features/products/domain/entities/product.entity'
import type { StockLevel } from '@angular-app/features/inventory/domain/entities/inventory.entity'
import { isLowStock, isOutOfStock } from '@angular-app/features/inventory/domain/services/low-stock'
import { ExcelExportService } from '@angular-app/shared/services/export/excel-export.service'
import { ToastService } from '@angular-app/shared/organisms/toast/toast.service'
import { buildInventoryWorkbook } from '@angular-app/features/inventory/presentation/services/inventory-export'

interface StockRow {
  id: string
  nombre: string
  sku: string | null
  proveedor: string | null
  tipo: string
  costo: number | null
  precioVenta: number
  puntoVentaStock: number
  bodegaStock: number
  totalStock: number
  minimumStock: number
  isLow: boolean
  isOut: boolean
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
    TableShellComponent,
    MO_TABLE,
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
        <select
          [value]="proveedorFilter()"
          (change)="onProveedorFilter($event)"
          class="border-input bg-card focus:ring-ring h-10 w-48 rounded-lg border px-3 text-sm focus:ring-2 focus:outline-none"
          aria-label="Filtrar por proveedor"
        >
          <option value="">Todos los proveedores</option>
          @for (prov of proveedores(); track prov) {
            <option [value]="prov">{{ prov }}</option>
          }
          <option value="__sin__">Sin proveedor</option>
        </select>
        <label
          class="border-input bg-card flex h-10 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm select-none"
        >
          <input
            type="checkbox"
            [checked]="soloFaltantes()"
            (change)="soloFaltantes.set(!soloFaltantes())"
            class="accent-primary h-4 w-4"
          />
          Solo faltantes
        </label>
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
        <mo-table-shell class="flex-1">
          <table moTable>
            <thead moThead>
              <tr>
                <th moTh>Producto</th>
                <th moTh>Tipo</th>
                <th moTh>SKU</th>
                <th moTh>Proveedor</th>
                <th moTh class="text-right">Costo</th>
                <th moTh class="text-right">Precio</th>
                <th moTh class="text-right">Punto venta</th>
                <th moTh class="text-right">Bodega</th>
                <th moTh class="text-right">Total</th>
                <th moTh class="text-right">Min</th>
                <th moTh></th>
                <th moTh></th>
              </tr>
            </thead>
            <tbody class="divide-y">
              @for (row of filteredRows(); track row.id) {
                <tr
                  class="hover:bg-muted/30"
                  [class.bg-red-50]="row.isOut"
                  [class.bg-amber-50]="row.isLow && !row.isOut"
                >
                  <td moTd class="font-semibold">{{ row.nombre }}</td>
                  <td moTd class="text-muted-foreground text-xs">
                    {{ tipoLabel(row.tipo) }}
                  </td>
                  <td moTd class="text-muted-foreground font-mono text-xs">
                    {{ row.sku ?? '—' }}
                  </td>
                  <td moTd class="text-muted-foreground text-xs">
                    {{ row.proveedor ?? '—' }}
                  </td>
                  <td moTd class="text-muted-foreground text-right tabular-nums">
                    {{ row.costo !== null ? money(row.costo) : '—' }}
                  </td>
                  <td moTd class="text-right font-semibold tabular-nums">
                    {{ money(row.precioVenta) }}
                  </td>
                  <td
                    moTd
                    class="text-right font-bold tabular-nums"
                    [class.text-destructive]="row.isOut"
                  >
                    {{ row.puntoVentaStock }}
                  </td>
                  <td moTd class="text-right font-semibold tabular-nums">
                    {{ row.bodegaStock }}
                  </td>
                  <td moTd class="text-muted-foreground text-right tabular-nums">
                    {{ row.totalStock }}
                  </td>
                  <td moTd class="text-muted-foreground text-right tabular-nums">
                    {{ row.minimumStock }}
                  </td>
                  <td moTd>
                    @if (row.isOut) {
                      <mo-badge variant="destructive">Agotado</mo-badge>
                    } @else if (row.isLow) {
                      <mo-badge variant="warning">Stock bajo</mo-badge>
                    }
                  </td>
                  <td moTd class="text-right">
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
        </mo-table-shell>
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
  private readonly productsRepo = inject(ProductRepository)
  private readonly session = inject(SessionService)
  private readonly excel = inject(ExcelExportService)
  private readonly toast = inject(ToastService)

  readonly products = signal<Product[]>([])
  readonly stockLevels = signal<StockLevel[]>([])
  readonly loading = signal(true)
  readonly loadError = signal<string | null>(null)
  readonly query = signal('')
  readonly proveedorFilter = signal('')
  readonly soloFaltantes = signal(false)
  readonly exporting = signal(false)

  readonly entryOpen = signal(false)
  readonly adjustOpen = signal(false)
  readonly transferOpen = signal(false)
  readonly kardexOpen = signal(false)
  readonly selectedRow = signal<StockRow | null>(null)

  readonly selected = computed(() => {
    const row = this.selectedRow()
    return row ? { id: row.id, nombre: row.nombre, costo: row.costo } : null
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
        proveedor: p.proveedor,
        tipo: p.tipo,
        costo: p.costo,
        precioVenta: p.precioVenta,
        puntoVentaStock,
        bodegaStock,
        totalStock,
        minimumStock: p.stockMinimo,
        isLow: isLowStock({
          tipo: p.tipo,
          currentStock: puntoVentaStock,
          minimumStock: p.stockMinimo,
        }),
        isOut: isOutOfStock({ tipo: p.tipo, currentStock: puntoVentaStock }),
      }
    })
  })

  readonly proveedores = computed(() => {
    const names = new Set<string>()
    for (const p of this.products()) if (p.proveedor) names.add(p.proveedor)
    return [...names].sort((a, b) => a.localeCompare(b, 'es'))
  })

  readonly filteredRows = computed(() => {
    const q = this.query().trim().toLowerCase()
    const proveedor = this.proveedorFilter()
    const soloFaltantes = this.soloFaltantes()
    return this.rows().filter((r) => {
      if (q && ![r.nombre, r.sku ?? ''].join(' ').toLowerCase().includes(q)) return false
      if (proveedor === '__sin__' && r.proveedor) return false
      if (proveedor && proveedor !== '__sin__' && r.proveedor !== proveedor) return false
      if (soloFaltantes && !r.isLow && !r.isOut) return false
      return true
    })
  })

  constructor() {
    void this.load()
  }

  money(amount: number): string {
    return formatCurrency(amount)
  }

  tipoLabel(tipo: string): string {
    const labels: Record<string, string> = {
      simple: 'Simple',
      prepared: 'Preparado',
      ingredient: 'Ingrediente',
    }
    return labels[tipo] ?? tipo
  }

  onQuery(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value)
  }

  onProveedorFilter(event: Event): void {
    this.proveedorFilter.set((event.target as HTMLSelectElement).value)
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
