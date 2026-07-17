import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core'
import { formatCurrency } from '@/shared/lib/format'
import { DialogComponent } from '@angular-app/shared/organisms/dialog.component'
import type { PosProduct } from '@angular-app/features/pos/presentation/services/pos.types'

@Component({
  selector: 'mo-product-info-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DialogComponent],
  template: `
    <mo-dialog
      [open]="open()"
      [title]="title()"
      description="Consulta rápida para orientar al cliente antes de agregar el producto."
      width="md"
      (closed)="closed.emit()"
    >
      @if (product(); as product) {
        <div class="space-y-5">
          <div class="bg-muted/50 rounded-xl px-4 py-3">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p class="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                  {{ isAdmin() ? 'Información comercial' : 'Precio' }}
                </p>
                @if (!isAdmin()) {
                  <p class="text-primary mt-0.5 text-lg font-bold tabular-nums">
                    {{ money(product.precioVenta) }}
                  </p>
                }
              </div>
              <span
                class="bg-card text-muted-foreground rounded-full border px-3 py-1 text-xs font-semibold"
              >
                {{ stockLabel(product) }}
              </span>
            </div>

            @if (isAdmin()) {
              <div class="mt-3 grid grid-cols-2 gap-2 border-t pt-3">
                <div class="bg-card rounded-lg border px-3 py-2.5">
                  <p class="text-muted-foreground text-[11px] font-semibold uppercase">
                    Precio de venta
                  </p>
                  <p class="text-primary mt-1 text-base font-bold tabular-nums">
                    {{ money(product.precioVenta) }}
                  </p>
                </div>
                <div class="bg-card rounded-lg border px-3 py-2.5">
                  <p class="text-muted-foreground text-[11px] font-semibold uppercase">Costo</p>
                  <p class="mt-1 text-base font-bold tabular-nums">
                    {{ product.costo === null ? 'No registrado' : money(product.costo) }}
                  </p>
                </div>
              </div>
            }
          </div>

          @if (!hasInformation()) {
            <div class="rounded-xl border border-amber-600/25 bg-amber-500/10 px-4 py-3">
              <p class="text-sm font-semibold">Información pendiente</p>
              <p class="text-muted-foreground mt-1 text-sm leading-relaxed">
                Un administrador puede completarla desde Catálogo y precios.
              </p>
            </div>
          }

          <section aria-labelledby="product-purpose-title">
            <h3 id="product-purpose-title" class="text-sm font-bold">Para qué sirve</h3>
            <p class="text-muted-foreground mt-2 text-sm leading-relaxed whitespace-pre-line">
              {{
                product.paraQueSirve || 'Todavía no hay información registrada para este producto.'
              }}
            </p>
          </section>

          <section class="border-t pt-5" aria-labelledby="product-audience-title">
            <h3 id="product-audience-title" class="text-sm font-bold">A quién se recomienda</h3>
            <p class="text-muted-foreground mt-2 text-sm leading-relaxed whitespace-pre-line">
              {{ product.recomendadoPara || 'Todavía no hay una recomendación registrada.' }}
            </p>
          </section>

          <p class="bg-muted/40 text-muted-foreground rounded-xl px-4 py-3 text-xs leading-relaxed">
            Información orientativa basada en la ficha oficial. Ante condiciones médicas, embarazo o
            uso de medicamentos, recomienda consultar a un profesional de salud.
          </p>

          <div class="flex justify-end">
            <button
              type="button"
              class="bg-primary text-primary-foreground focus:ring-ring min-h-11 rounded-lg px-5 text-sm font-bold transition-colors focus:ring-2 focus:outline-none"
              (click)="closed.emit()"
            >
              Entendido
            </button>
          </div>
        </div>
      }
    </mo-dialog>
  `,
})
export class ProductInfoDialog {
  readonly open = input<boolean>(false)
  readonly product = input<PosProduct | null>(null)
  readonly isAdmin = input<boolean>(false)
  readonly closed = output<void>()

  readonly title = computed(() => this.product()?.nombre ?? 'Información del producto')
  readonly hasInformation = computed(() => {
    const product = this.product()
    return Boolean(product?.paraQueSirve || product?.recomendadoPara)
  })

  money(amount: number): string {
    return formatCurrency(amount)
  }

  stockLabel(product: PosProduct): string {
    return product.stockDisponible === null
      ? 'Sin control de stock'
      : `Stock ${product.stockDisponible}`
  }

}
