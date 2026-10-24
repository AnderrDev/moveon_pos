import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core'
import type { Product } from '@angular-app/features/products/domain/entities/product.entity'
import type { ProductComponent } from '@angular-app/features/products/domain/repositories/product.repository'
import type { comboSavings } from '@angular-app/features/products/domain/services/combo-pricing'
import { ButtonComponent } from '@angular-app/shared/atoms/button.component'
import { MoneyPipe } from '@angular-app/shared/pipes/money.pipe'
import { X, LucideAngularModule } from 'lucide-angular'

type ComboSavings = ReturnType<typeof comboSavings>

/**
 * Componentes consumibles de un preparado o productos incluidos de un combo
 * (ADR 0018). La lista y el recálculo del costo los maneja el diálogo; aquí
 * solo se captura la fila "Agregar" y se emite.
 */
@Component({
  selector: 'mo-product-components-editor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  imports: [LucideAngularModule, ButtonComponent, MoneyPipe],
  template: `
    <section class="space-y-3 rounded-xl border p-4">
      <div>
        <h3 class="text-sm font-semibold">
          {{ isCombo() ? 'Productos incluidos' : 'Componentes consumibles' }}
        </h3>
        <p class="text-muted-foreground mt-1 text-xs leading-relaxed">
          @if (isCombo()) {
            Al vender el combo se descuenta el stock de cada producto incluido. El combo no
            lleva inventario propio: cuántos puedes vender lo decide el producto más escaso.
          } @else {
            Al vender este batido se descuenta el stock de cada componente (ej. vaso, ingredientes).
          }
        </p>
      </div>

      @for (comp of components(); track comp.componenteId) {
        <div class="border-border flex items-center gap-3 rounded-lg border px-3 py-2">
          <span class="min-w-0 flex-1 truncate text-sm font-medium">{{ comp.componenteNombre }}</span>
          <span class="text-muted-foreground shrink-0 text-xs tabular-nums">× {{ comp.cantidad }}</span>
          <button
            type="button"
            (click)="removed.emit(comp.componenteId)"
            class="text-muted-foreground hover:text-destructive shrink-0 transition-colors"
            aria-label="Quitar componente"
          >
            <lucide-angular [img]="icons.x" class="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      } @empty {
        <p class="text-muted-foreground text-xs">
          {{ isCombo() ? 'Sin productos incluidos todavía.' : 'Sin componentes asignados.' }}
        </p>
      }

      @if (isCombo() && components().length > 0) {
        <div class="border-primary/20 bg-primary/[0.035] rounded-lg border px-3.5 py-3">
          <dl class="flex flex-wrap items-baseline gap-x-5 gap-y-1 text-xs">
            <div class="flex items-baseline gap-1.5">
              <dt class="text-muted-foreground">Suma normal</dt>
              <dd class="font-semibold tabular-nums">{{ (savings().sumaNormal | money) }}</dd>
            </div>
            <div class="flex items-baseline gap-1.5">
              <dt class="text-muted-foreground">Precio del combo</dt>
              <dd class="font-semibold tabular-nums">{{ (precioVenta() | money) }}</dd>
            </div>
            @if (savings().ahorro > 0) {
              <div class="flex items-baseline gap-1.5">
                <dt class="text-muted-foreground">Ahorro</dt>
                <dd class="text-foreground font-semibold tabular-nums">
                  {{ (savings().ahorro | money) }} ({{ savings().porcentaje }}%)
                </dd>
              </div>
            } @else {
              <div class="text-muted-foreground">
                Sin ahorro: el combo no cuesta menos que comprarlos por separado.
              </div>
            }
          </dl>
        </div>
      }

      <div class="flex items-end gap-2 pt-1">
        <div class="min-w-0 flex-1">
          <label for="product-component-id" class="text-muted-foreground mb-1 block text-[11px] font-semibold">
            Producto
          </label>
          <select
            id="product-component-id"
            [value]="pendingId()"
            (change)="pendingId.set($any($event.target).value)"
            class="border-input bg-background focus:ring-ring h-10 w-full rounded-lg border px-3 text-sm outline-none focus:ring-2"
          >
            <option value="">Seleccionar...</option>
            @for (p of candidates(); track p.id) {
              <option [value]="p.id">{{ p.nombre }}</option>
            }
          </select>
        </div>
        <div class="w-24 shrink-0">
          <label for="product-component-qty" class="text-muted-foreground mb-1 block text-[11px] font-semibold">
            Cantidad
          </label>
          <input
            id="product-component-qty"
            type="number"
            min="0.001"
            step="1"
            [value]="pendingQty()"
            (input)="pendingQty.set(+$any($event.target).value)"
            class="border-input bg-background focus:ring-ring h-10 w-full rounded-lg border px-3 text-sm outline-none focus:ring-2"
          />
        </div>
        <mo-button type="button" class="shrink-0" [disabled]="!pendingId()" (click)="add()">Agregar</mo-button>
      </div>
    </section>
  `,
})
export class ProductComponentsEditorComponent {
  readonly icons = { x: X }

  readonly isCombo = input(false)
  readonly components = input.required<ProductComponent[]>()
  readonly candidates = input.required<Product[]>()
  readonly savings = input.required<ComboSavings>()
  readonly precioVenta = input(0)
  readonly added = output<{ componenteId: string; cantidad: number }>()
  readonly removed = output<string>()

  readonly pendingId = signal('')
  readonly pendingQty = signal(1)

  add(): void {
    const componenteId = this.pendingId()
    const cantidad = this.pendingQty()
    if (!componenteId || cantidad <= 0) return
    this.added.emit({ componenteId, cantidad })
    this.pendingId.set('')
    this.pendingQty.set(1)
  }
}
