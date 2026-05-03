import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core'
import { DialogComponent } from '../../shared/ui/dialog.component'
import { BadgeComponent } from '../../shared/ui/badge.component'
import { InventoryRepository } from './inventory.repository'
import { SessionService } from '../../core/auth/session.service'
import { formatTime, formatShortDate } from '@/shared/lib/format'
import type { InventoryMovement } from '@/modules/inventory/domain/entities/inventory.entity'

interface ProductSummary {
  id: string
  nombre: string
}

const TIPO_LABELS: Record<string, string> = {
  entry: 'Entrada',
  sale_exit: 'Venta',
  adjustment: 'Ajuste',
  void_return: 'Anulacion',
}

@Component({
  selector: 'mo-kardex-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DialogComponent, BadgeComponent],
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
        <p class="text-muted-foreground py-6 text-center text-sm">
          Sin movimientos registrados.
        </p>
      } @else {
        <div class="max-h-[60vh] overflow-y-auto">
          <table class="w-full text-sm">
            <thead class="bg-muted/50 text-muted-foreground sticky top-0 text-left text-xs uppercase tracking-wide">
              <tr>
                <th class="px-3 py-2">Fecha</th>
                <th class="px-3 py-2">Tipo</th>
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
                    <mo-badge [variant]="badgeVariant(mov.tipo)">{{ tipoLabel(mov.tipo) }}</mo-badge>
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

  readonly open = input<boolean>(false)
  readonly product = input<ProductSummary | null>(null)
  readonly closed = output<void>()

  readonly movements = signal<InventoryMovement[]>([])
  readonly loading = signal(false)
  readonly loadError = signal<string | null>(null)

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

  badgeVariant(tipo: string): 'default' | 'success' | 'warning' | 'destructive' {
    if (tipo === 'entry') return 'success'
    if (tipo === 'sale_exit') return 'default'
    if (tipo === 'adjustment') return 'warning'
    if (tipo === 'void_return') return 'destructive'
    return 'default'
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
      this.loadError.set(error instanceof Error ? error.message : 'Error al cargar kardex')
    } finally {
      this.loading.set(false)
    }
  }
}
