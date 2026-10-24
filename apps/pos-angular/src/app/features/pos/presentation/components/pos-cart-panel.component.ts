import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core'
import { ChevronDown, Gift, Layers, LucideAngularModule } from 'lucide-angular'
import { PosCartStore, type PosCartItem } from '@angular-app/features/pos/presentation/services/pos-cart.store'
import type { LoyaltySummary } from '@angular-app/features/loyalty/domain/repositories/loyalty.repository'
import { MoneyPipe } from '@angular-app/shared/pipes/money.pipe'

/**
 * Panel del carrito del POS: cliente asociado y su tarjeta MOVE ON Club,
 * líneas (cantidad, opción, descuento) y total. Lee y ajusta cantidades en
 * el `PosCartStore` de la página (misma instancia: lo provee `PosPage`); las
 * acciones que abren diálogos o cobran se emiten para que la página decida.
 */
@Component({
  selector: 'mo-pos-cart-panel',
  standalone: true,
  imports: [MoneyPipe, LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // `contents`: el <aside> participa directo en el layout flex de la página.
  host: { class: 'contents' },
  template: `
    <aside
      class="bg-card flex min-h-0 flex-[0_0_42%] flex-col border-t lg:w-96 lg:flex-none lg:border-t-0 lg:border-l"
    >
      <div class="flex shrink-0 border-b">
        <button
          class="text-primary border-primary flex flex-1 items-center justify-center border-b-2 px-3 py-3 text-xs font-semibold tracking-wide uppercase"
        >
          Carrito
          @if (cart.items().length > 0) {
            <span
              class="bg-primary text-primary-foreground ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px]"
            >
              {{ cart.items().length }}
            </span>
          }
        </button>
      </div>

      @if (cart.items().length === 0) {
        <div class="flex h-full items-center justify-center px-6 py-10 text-center">
          <div>
            <p class="text-sm font-semibold">Carrito vacio</p>
            <p class="text-muted-foreground mt-1 text-xs">
              Selecciona un producto del catalogo
            </p>
          </div>
        </div>
      } @else {
        <div class="flex h-full min-h-0 flex-col">
          <div class="shrink-0 border-b px-4 py-2.5">
            @if (cart.clienteId()) {
              <div class="bg-primary/10 space-y-2 rounded-lg px-3 py-2">
                <div class="flex items-center justify-between gap-2">
                  <span class="min-w-0">
                    <span
                      class="text-muted-foreground block text-[10px] font-semibold tracking-wide uppercase"
                    >
                      Cliente
                    </span>
                    <span class="block truncate text-sm font-semibold">{{
                      cart.clienteNombre()
                    }}</span>
                  </span>
                  <button
                    type="button"
                    (click)="clearCustomer.emit()"
                    class="text-muted-foreground hover:text-destructive shrink-0 text-xs font-semibold underline"
                  >
                    Quitar
                  </button>
                </div>

                @if (loyaltySummary(); as summary) {
                  <div class="border-primary/20 space-y-1.5 border-t pt-2">
                    <div class="flex items-center justify-between gap-2">
                      <span class="text-[11px] font-bold tracking-wide uppercase">
                        MOVE ON Club
                      </span>
                      <span class="text-xs font-semibold tabular-nums">
                        {{ summary.stampsBalance }}/{{ stampsPerReward() }} sellos
                      </span>
                    </div>
                    <div class="bg-primary/15 h-1.5 overflow-hidden rounded-full">
                      <div
                        class="bg-primary h-full rounded-full transition-all"
                        [style.width.%]="loyaltyProgressPercent()"
                      ></div>
                    </div>
                    @if (stampsPreview() > 0) {
                      <p class="text-muted-foreground text-[11px]">
                        Esta venta suma {{ stampsPreview() }}
                        {{ stampsPreview() === 1 ? 'sello' : 'sellos' }}
                      </p>
                    }

                    @if (cart.loyaltyRedemption(); as redemption) {
                      <div
                        class="flex items-center justify-between gap-2 rounded-md bg-emerald-500/15 px-2 py-1.5"
                      >
                        <span class="flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                          <lucide-angular [img]="icons.gift" class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          Premio aplicado · −{{ (redemption.amount | money) }}
                        </span>
                        <button
                          type="button"
                          (click)="cart.clearLoyaltyRedemption()"
                          class="text-muted-foreground hover:text-destructive shrink-0 text-[11px] font-semibold underline"
                        >
                          Quitar
                        </button>
                      </div>
                    } @else if (summary.availableRewards.length > 0) {
                      <button
                        type="button"
                        (click)="redeemReward.emit()"
                        class="bg-primary text-primary-foreground flex w-full items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-bold transition-all hover:brightness-110"
                      >
                        <lucide-angular [img]="icons.gift" class="h-3.5 w-3.5" aria-hidden="true" />
                        Canjear batido gratis
                        @if (summary.availableRewards.length > 1) {
                          ({{ summary.availableRewards.length }} disponibles)
                        }
                      </button>
                    }
                  </div>
                } @else if (loyaltyLoading()) {
                  <div class="bg-primary/10 h-6 animate-pulse rounded"></div>
                }
              </div>
            } @else {
              <button
                type="button"
                (click)="pickCustomer.emit()"
                class="text-muted-foreground hover:border-primary hover:text-primary flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed py-2 text-xs font-semibold transition-colors"
              >
                + Asociar cliente
              </button>
            }
          </div>
          <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div class="divide-y">
              @for (item of cart.items(); track item.key) {
                <div class="px-4 py-3.5">
                  <div class="flex items-start justify-between gap-2">
                    <div class="min-w-0 flex-1">
                      <p class="truncate text-sm font-semibold">{{ item.nombre }}</p>
                      @if (item.option; as option) {
                        <button
                          type="button"
                          (click)="editOption.emit(item)"
                          class="border-primary/30 text-primary hover:bg-primary/10 mt-1 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold transition-colors"
                        >
                          {{ option.nombre }}
                          @if (option.precioExtra > 0) {
                            · +{{ (option.precioExtra | money) }}
                          }
                          <lucide-angular [img]="icons.chevronDown" class="h-3 w-3 shrink-0" [strokeWidth]="2.5" aria-hidden="true" />
                        </button>
                      }
                      @if (item.sku) {
                        <p class="text-muted-foreground font-mono text-[11px]">
                          {{ item.sku }}
                        </p>
                      }
                      @if (item.components.length > 0) {
                        <p class="text-amber-600 mt-0.5 flex items-center gap-1 text-[11px] font-medium">
                          <lucide-angular [img]="icons.layers" class="h-3 w-3 shrink-0" aria-hidden="true" />
                          Descuenta {{ componentLabel(item.components) }} por unidad
                        </p>
                      }
                    </div>
                    <button
                      type="button"
                      (click)="cart.removeItem(item.key)"
                      class="text-muted-foreground hover:bg-destructive/10 hover:text-destructive h-9 w-9 rounded-md"
                      aria-label="Eliminar del carrito"
                    >
                      ×
                    </button>
                  </div>

                  <div class="mt-2.5 flex items-center justify-between gap-2">
                    <div class="bg-background flex items-center rounded-lg border">
                      <button
                        type="button"
                        (click)="cart.updateQuantity(item.key, item.quantity - 1)"
                        class="h-9 w-9"
                      >
                        −
                      </button>
                      <span class="w-9 text-center text-sm font-bold tabular-nums">{{
                        item.quantity
                      }}</span>
                      <button
                        type="button"
                        (click)="cart.updateQuantity(item.key, item.quantity + 1)"
                        [disabled]="isAtStockMax(item)"
                        class="h-9 w-9 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        +
                      </button>
                    </div>
                    <div class="text-right">
                      <p class="text-sm font-bold tabular-nums">{{ (item.total | money) }}</p>
                      <p class="text-muted-foreground text-[11px] tabular-nums">
                        {{ (item.unitPrice | money) }} × {{ item.quantity }}
                      </p>
                    </div>
                  </div>

                  <div class="mt-2 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      (click)="editDiscount.emit(item)"
                      class="text-muted-foreground hover:text-primary text-[11px] font-semibold underline"
                    >
                      @if (item.discountAmount > 0) {
                        Editar descuento
                      } @else {
                        + Descuento
                      }
                    </button>
                    @if (item.descuentoTotal > 0) {
                      <span class="text-destructive text-[11px] font-medium tabular-nums">
                        −{{ (item.descuentoTotal | money) }}
                      </span>
                    }
                  </div>
                </div>
              }
            </div>
          </div>

          <div
            class="bg-card shrink-0 border-t px-4 pt-3 pb-4 shadow-[0_-10px_24px_-20px_rgba(15,23,42,0.45)]"
          >
            @if (cart.totals().discountTotal > 0) {
              <div class="mb-1.5 flex justify-between text-sm">
                <span class="text-muted-foreground">Descuentos</span>
                <span class="text-destructive font-medium"
                  >−{{ (cart.totals().discountTotal | money) }}</span
                >
              </div>
            }

            <div class="mt-2.5 flex items-end justify-between border-t pt-2.5">
              <span class="text-muted-foreground text-sm font-semibold">Total</span>
              <span
                class="font-display text-primary text-xl font-bold tabular-nums sm:text-2xl"
              >
                {{ (cart.totals().total | money) }}
              </span>
            </div>

            <button
              type="button"
              (click)="checkout.emit()"
              [disabled]="!canCheckout()"
              class="bg-primary text-primary-foreground mt-3 h-12 w-full rounded-lg text-base font-bold tracking-wide transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cobrar {{ (cart.totals().total | money) }}
            </button>
          </div>
        </div>
      }
    </aside>
  `,
})
export class PosCartPanelComponent {
  readonly cart = inject(PosCartStore)

  readonly loyaltySummary = input<LoyaltySummary | null>(null)
  readonly loyaltyLoading = input(false)
  readonly stampsPreview = input(0)
  readonly loyaltyProgressPercent = input(0)
  readonly stampsPerReward = input(8)
  readonly canCheckout = input(false)

  readonly pickCustomer = output<void>()
  readonly clearCustomer = output<void>()
  readonly redeemReward = output<void>()
  readonly editOption = output<PosCartItem>()
  readonly editDiscount = output<PosCartItem>()
  readonly checkout = output<void>()

  readonly icons = { chevronDown: ChevronDown, layers: Layers, gift: Gift }


  componentLabel(components: { nombre: string; cantidad: number }[]): string {
    return components
      .map((c) => (c.cantidad === 1 ? `1 ${c.nombre}` : `${c.cantidad}× ${c.nombre}`))
      .join(', ')
  }

  /** `true` cuando el ítem rastrea stock y ya alcanzó el máximo disponible. */
  isAtStockMax(item: PosCartItem): boolean {
    return item.maxQuantity !== null && item.quantity >= item.maxQuantity
  }
}
