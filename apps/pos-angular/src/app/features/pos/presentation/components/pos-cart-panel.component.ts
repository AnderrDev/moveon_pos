import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core'
import {
  ChevronDown,
  Gift,
  Layers,
  LucideAngularModule,
  Minus,
  Plus,
  ShoppingBag,
  Tag,
  Trash2,
  User,
  UserPlus,
} from 'lucide-angular'
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
      class="bg-card flex min-h-0 flex-col overflow-hidden rounded-2xl border lg:w-[22rem] lg:flex-none xl:w-96"
      [class.flex-[0_0_46%]]="cart.items().length > 0"
      [class.flex-none]="cart.items().length === 0"
      aria-label="Venta actual"
    >
      <div class="flex shrink-0 items-center justify-between gap-2 px-4 pt-4 pb-3">
        <h2 class="font-display text-base font-extrabold">Venta actual</h2>
        @if (cart.items().length > 0) {
          <span class="text-muted-foreground text-xs font-semibold tabular-nums">
            {{ itemCount() }} {{ itemCount() === 1 ? 'unidad' : 'unidades' }}
          </span>
        }
      </div>

      @if (cart.items().length === 0) {
        <div class="flex flex-1 flex-col items-center justify-center gap-3 px-6 pb-4 text-center lg:pb-8">
          <span class="bg-muted hidden h-14 w-14 items-center justify-center rounded-2xl lg:flex" aria-hidden="true">
            <lucide-angular [img]="icons.bag" class="text-muted-foreground h-6 w-6" />
          </span>
          <div>
            <p class="text-sm font-semibold">Aún no hay productos</p>
            <p class="text-muted-foreground mt-1 text-xs">Toca un producto o escanea su código para agregarlo.</p>
          </div>
        </div>
      } @else {
        <div class="flex min-h-0 flex-1 flex-col">
          <div class="shrink-0 px-4 pb-3">
            @if (cart.clienteId()) {
              <div class="bg-muted space-y-2.5 rounded-xl px-3 py-2.5">
                <div class="flex items-center justify-between gap-2">
                  <span class="flex min-w-0 items-center gap-2">
                    <lucide-angular [img]="icons.user" class="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span class="truncate text-sm font-semibold">{{ cart.clienteNombre() }}</span>
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
                  <div class="space-y-1.5">
                    <div class="flex items-center justify-between gap-2 text-xs">
                      <span class="font-semibold">MOVE ON Club</span>
                      <span class="font-semibold tabular-nums">
                        {{ summary.stampsBalance }}/{{ stampsPerReward() }} sellos
                      </span>
                    </div>
                    <div class="bg-card h-1.5 overflow-hidden rounded-full">
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
                          Premio aplicado: −{{ (redemption.amount | money) }}
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
                        class="bg-primary text-primary-foreground flex min-h-9 w-full items-center justify-center gap-1.5 rounded-lg text-xs font-bold transition-[filter] hover:brightness-105"
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
                  <div class="bg-card h-6 animate-pulse rounded"></div>
                }
              </div>
            } @else {
              <button
                type="button"
                (click)="pickCustomer.emit()"
                class="text-muted-foreground hover:border-foreground/40 hover:text-foreground flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-dashed text-sm font-semibold transition-colors"
              >
                <lucide-angular [img]="icons.userPlus" class="h-4 w-4" aria-hidden="true" />
                Asociar cliente
              </button>
            }
          </div>

          <ul class="min-h-0 flex-1 divide-y overflow-y-auto overscroll-contain border-t">
            @for (item of cart.items(); track item.key) {
              <li class="px-4 py-3">
                <div class="flex items-start justify-between gap-2">
                  <div class="min-w-0 flex-1">
                    <p class="text-sm leading-snug font-semibold">{{ item.nombre }}</p>
                    @if (item.option; as option) {
                      <button
                        type="button"
                        (click)="editOption.emit(item)"
                        class="hover:border-foreground/40 mt-1 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold transition-colors"
                      >
                        {{ option.nombre }}
                        @if (option.precioExtra > 0) {
                          (+{{ (option.precioExtra | money) }})
                        }
                        <lucide-angular [img]="icons.chevronDown" class="h-3 w-3 shrink-0" [strokeWidth]="2.5" aria-hidden="true" />
                      </button>
                    }
                    @if (item.components.length > 0) {
                      <p class="text-muted-foreground mt-0.5 flex items-start gap-1 text-[11px]">
                        <lucide-angular [img]="icons.layers" class="mt-px h-3 w-3 shrink-0" aria-hidden="true" />
                        Descuenta {{ componentLabel(item.components) }} por unidad
                      </p>
                    }
                  </div>
                  <div class="shrink-0 text-right">
                    <p class="text-sm font-bold tabular-nums">{{ (item.total | money) }}</p>
                    @if (item.descuentoTotal > 0) {
                      <p class="text-destructive text-[11px] font-medium tabular-nums">
                        −{{ (item.descuentoTotal | money) }}
                      </p>
                    }
                  </div>
                </div>

                <div class="mt-2 flex items-center gap-2">
                  <div class="flex items-center rounded-lg border">
                    <button
                      type="button"
                      (click)="cart.updateQuantity(item.key, item.quantity - 1)"
                      class="hover:bg-muted flex h-9 w-9 items-center justify-center rounded-l-lg"
                      [attr.aria-label]="'Quitar una unidad de ' + item.nombre"
                    >
                      <lucide-angular [img]="icons.minus" class="h-4 w-4" aria-hidden="true" />
                    </button>
                    <span class="w-8 text-center text-sm font-bold tabular-nums">{{ item.quantity }}</span>
                    <button
                      type="button"
                      (click)="cart.updateQuantity(item.key, item.quantity + 1)"
                      [disabled]="isAtStockMax(item)"
                      class="hover:bg-muted flex h-9 w-9 items-center justify-center rounded-r-lg disabled:cursor-not-allowed disabled:opacity-40"
                      [attr.aria-label]="'Agregar una unidad de ' + item.nombre"
                    >
                      <lucide-angular [img]="icons.plus" class="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                  <span class="text-muted-foreground text-[11px] tabular-nums">
                    {{ (item.unitPrice | money) }} c/u
                  </span>
                  <span class="flex-1"></span>
                  <button
                    type="button"
                    (click)="editDiscount.emit(item)"
                    class="text-muted-foreground hover:text-foreground hover:bg-muted flex h-9 items-center gap-1 rounded-lg px-2 text-xs font-semibold"
                    [attr.aria-label]="(item.discountAmount > 0 ? 'Editar descuento de ' : 'Aplicar descuento a ') + item.nombre"
                  >
                    <lucide-angular [img]="icons.tag" class="h-3.5 w-3.5" aria-hidden="true" />
                    {{ item.discountAmount > 0 ? 'Editar' : 'Descuento' }}
                  </button>
                  <button
                    type="button"
                    (click)="cart.removeItem(item.key)"
                    class="text-muted-foreground hover:bg-destructive/10 hover:text-destructive flex h-9 w-9 items-center justify-center rounded-lg"
                    [attr.aria-label]="'Eliminar ' + item.nombre + ' del carrito'"
                  >
                    <lucide-angular [img]="icons.trash" class="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </li>
            }
          </ul>

          <!-- Bloque de cobro: el único momento de alto contraste de la pantalla. -->
          <div class="bg-foreground text-background shrink-0 px-4 pt-3.5 pb-4">
            @if (cart.totals().discountTotal > 0) {
              <div class="mb-1 flex justify-between text-xs">
                <span class="opacity-70">Descuentos</span>
                <span class="font-semibold tabular-nums">−{{ (cart.totals().discountTotal | money) }}</span>
              </div>
            }
            <div class="flex items-baseline justify-between gap-3">
              <span class="text-sm font-semibold opacity-70">Total</span>
              <span class="font-display text-3xl leading-none font-black tabular-nums">
                {{ (cart.totals().total | money) }}
              </span>
            </div>

            <button
              type="button"
              (click)="checkout.emit()"
              [disabled]="!canCheckout()"
              class="bg-primary text-primary-foreground font-display focus-visible:ring-primary focus-visible:ring-offset-foreground mt-3.5 h-14 w-full rounded-xl text-lg font-extrabold transition-[filter,transform] hover:brightness-105 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Cobrar
            </button>
            @if (!canCheckout()) {
              <p class="mt-2 text-center text-xs opacity-70">Abre la caja para poder cobrar.</p>
            }
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

  readonly icons = {
    bag: ShoppingBag,
    chevronDown: ChevronDown,
    gift: Gift,
    layers: Layers,
    minus: Minus,
    plus: Plus,
    tag: Tag,
    trash: Trash2,
    user: User,
    userPlus: UserPlus,
  }

  /** Unidades totales (no líneas) para el encabezado del ticket. */
  readonly itemCount = computed(() => this.cart.items().reduce((sum, item) => sum + item.quantity, 0))


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
