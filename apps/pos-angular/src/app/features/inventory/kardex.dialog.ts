import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core'
import { getErrorMessage } from '@/shared/lib/error-message'
import { DialogComponent } from '../../shared/organisms/dialog.component'
import { BadgeComponent } from '../../shared/atoms/badge.component'
import { ButtonComponent } from '../../shared/atoms/button.component'
import { InventoryRepository } from './inventory.repository'
import { SessionService } from '../../core/auth/session.service'
import { formatTime, formatShortDate } from '@/shared/lib/format'
import type { InventoryMovement } from '@/modules/inventory/domain/entities/inventory.entity'
import { ExcelExportService } from '../../shared/services/export/excel-export.service'
import { ToastService } from '../../shared/organisms/toast/toast.service'
import { buildKardexWorkbook } from './inventory-export'

interface ProductSummary {
  id: string
  nombre: string
}

const TIPO_LABELS: Record<string, string> = {
  entry: 'Entrada',
  sale_exit: 'Venta',
  adjustment: 'Ajuste',
  void_return: 'Anulacion',
  transfer_out: 'Traslado salida',
  transfer_in: 'Traslado entrada',
}

const LOCATION_LABELS: Record<string, string> = {
  punto_venta: 'Punto de venta',
  bodega: 'Bodega',
}

@Component({
  selector: 'mo-kardex-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DialogComponent, BadgeComponent, ButtonComponent],
  template: `
    <mo-dialog
      [open]="open()"
      title="Kardex"
      [description]="product()?.nombre ?? null"
      width="lg"
      (closed)="closed.emit()"
    >
      @if (loading()) {
        <p class="text-muted-foreground py-6 text-center text-sm">Cargando movimientos...</p>
      } @else if (loadError()) {
        <p class="text-destructive py-6 text-center text-sm">{{ loadError() }}</p>
      } @else if (movements().length === 0) {
        <p class="text-muted-foreground py-6 text-center text-sm">Sin movimientos registrados.</p>
      } @else {
        <div class="mb-3 flex justify-end">
          <mo-button
            size="sm"
            variant="outline"
            [loading]="exporting()"
            loadingText="Generando..."
            (click)="exportKardex()"
          >
            Descargar Excel
          </mo-button>
        </div>
        <div class="max-h-[60vh] overflow-y-auto">
          <table class="w-full text-sm">
            <thead
              class="bg-muted/50 text-muted-foreground sticky top-0 text-left text-xs tracking-wide uppercase"
            >
              <tr>
                <th class="px-3 py-2">Fecha</th>
                <th class="px-3 py-2">Tipo</th>
                <th class="px-3 py-2">Ubicacion</th>
                <th class="px-3 py-2 text-right">Cantidad</th>
                <th class="px-3 py-2">Motivo</th>
              </tr>
            </thead>
            <tbody class="divide-y">
              @for (mov of movements(); track mov.id) {
                <tr>
                  <td class="text-muted-foreground px-3 py-2 text-xs">
                    {{ shortDate(mov.createdAt) }} · {{ time(mov.createdAt) }}
                  </td>
                  <td class="px-3 py-2">
                    <mo-badge [variant]="badgeVariant(mov.tipo)">{{
                      tipoLabel(mov.tipo)
                    }}</mo-badge>
                  </td>
                  <td class="text-muted-foreground px-3 py-2 text-xs">
                    {{ locationLabel(mov.ubicacion) }}
                  </td>
                  <td
                    class="px-3 py-2 text-right tabular-nums"
                    [class.text-emerald-600]="mov.cantidad > 0"
                    [class.text-destructive]="mov.cantidad < 0"
                  >
                    {{ mov.cantidad > 0 ? '+' : '' }}{{ mov.cantidad }}
                  </td>
                  <td class="text-muted-foreground px-3 py-2 text-xs">{{ mov.motivo ?? '—' }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </mo-dialog>
  `,
})
export class KardexDialog {
  private readonly repo = inject(InventoryRepository)
  private readonly session = inject(SessionService)
  private readonly excel = inject(ExcelExportService)
  private readonly toast = inject(ToastService)

  readonly open = input<boolean>(false)
  readonly product = input<ProductSummary | null>(null)
  readonly closed = output<void>()

  readonly movements = signal<InventoryMovement[]>([])
  readonly loading = signal(false)
  readonly loadError = signal<string | null>(null)
  readonly exporting = signal(false)

  constructor() {
    effect(() => {
      const product = this.product()
      if (this.open() && product) {
        void this.load(product.id)
      }
    })
  }

  shortDate(d: Date): string {
    return formatShortDate(d)
  }

  time(d: Date): string {
    return formatTime(d)
  }

  tipoLabel(tipo: string): string {
    return TIPO_LABELS[tipo] ?? tipo
  }

  locationLabel(ubicacion: string): string {
    return LOCATION_LABELS[ubicacion] ?? ubicacion
  }

  badgeVariant(tipo: string): 'default' | 'success' | 'warning' | 'destructive' {
    if (tipo === 'entry' || tipo === 'transfer_in') return 'success'
    if (tipo === 'sale_exit') return 'default'
    if (tipo === 'adjustment') return 'warning'
    if (tipo === 'void_return' || tipo === 'transfer_out') return 'destructive'
    return 'default'
  }

  async exportKardex(): Promise<void> {
    const product = this.product()
    if (!product) return

    this.exporting.set(true)
    try {
      await this.excel.download(buildKardexWorkbook(product.nombre, this.movements()))
      this.toast.success('Archivo de kardex descargado')
    } catch (error) {
      this.toast.error(getErrorMessage(error, 'No se pudo generar el archivo'))
    } finally {
      this.exporting.set(false)
    }
  }

  async load(productId: string): Promise<void> {
    this.loading.set(true)
    this.loadError.set(null)
    try {
      const auth = await this.session.getAuthContext()
      if (!auth) throw new Error('No autenticado')
      const list = await this.repo.getKardex(productId, auth.tiendaId)
      this.movements.set(list)
    } catch (error) {
      this.loadError.set(getErrorMessage(error, 'Error al cargar kardex'))
    } finally {
      this.loading.set(false)
    }
  }
}
