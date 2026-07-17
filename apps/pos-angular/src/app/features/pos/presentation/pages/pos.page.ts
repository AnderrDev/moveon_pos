import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core'
import { Router } from '@angular/router'
import { getErrorMessage } from '@/shared/lib/error-message'
import { formatCurrency } from '@/shared/lib/format'
import { getPaymentMethodLabel, PAYMENT_METHOD_OPTIONS } from '@/shared/lib/payment-methods'
import {
  validateDiscountAuthorization,
  validatePaymentsForSale,
} from '@angular-app/features/sales/domain/services/sale-calculator'
import { buildPaymentEntry, requiresReference } from '@angular-app/features/sales/domain/services/sale-builder'
import type { PaymentMethod } from '@/shared/types'
import { SessionService } from '@angular-app/core/auth/session.service'
import { TiendaInfoService } from '@angular-app/core/tienda/tienda-info.service'
import { ToastService } from '@angular-app/shared/organisms/toast/toast.service'
import { ButtonComponent } from '@angular-app/shared/atoms/button.component'
import { SpinnerComponent } from '@angular-app/shared/atoms/spinner.component'
import { PosCartStore } from '@angular-app/features/pos/presentation/services/pos-cart.store'
import { PosDataService } from '@angular-app/features/pos/presentation/services/pos-data.service'
import { PosSaleService } from '@angular-app/features/pos/presentation/services/pos-sale.service'
import { ReceiptPrintService } from '@angular-app/features/pos/presentation/services/receipt-print.service'
import { SalesHistoryDialog } from '@angular-app/features/pos/presentation/dialogs/sales-history.dialog'
import { CustomerPickerDialog } from '@angular-app/features/pos/presentation/dialogs/customer-picker.dialog'
import { ClienteFormDialog } from '@angular-app/features/customers/presentation/dialogs/cliente-form.dialog'
import { LoyaltyRepository } from '@angular-app/features/loyalty/data/repositories/loyalty.repository'
import type { LoyaltySummary } from '@angular-app/features/loyalty/domain/repositories/loyalty.repository'
import { DEFAULT_LOYALTY_CONFIG } from '@angular-app/features/loyalty/domain/loyalty-config'
import { countEligibleStampUnits } from '@angular-app/features/loyalty/domain/services/stamps'
import { ItemDiscountDialog, type ItemDiscountResult } from '@angular-app/features/pos/presentation/dialogs/item-discount.dialog'
import { ProductInfoDialog } from '@angular-app/features/pos/presentation/dialogs/product-info.dialog'
import {
  ReceiptOutputStatusDialog,
  type ReceiptOutputKind,
  type ReceiptOutputStatus,
} from '@angular-app/features/pos/presentation/dialogs/receipt-output-status.dialog'
import type { PosCartItem } from '@angular-app/features/pos/presentation/services/pos-cart.store'
import type { OpenCashSession, PosCategory, PosProduct } from '@angular-app/features/pos/presentation/services/pos.types'
import type { Cliente } from '@angular-app/features/customers/domain/entities/cliente.entity'

interface PostSaleOutputJob {
  saleId: string
  change: number
  printReceipt: boolean
  openCashDrawer: boolean
}

@Component({
  selector: 'mo-pos-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [PosCartStore],
  imports: [
    SalesHistoryDialog,
    CustomerPickerDialog,
    ClienteFormDialog,
    ItemDiscountDialog,
    ProductInfoDialog,
    ReceiptOutputStatusDialog,
    ButtonComponent,
    SpinnerComponent,
  ],
  template: `
    <section class="flex h-full min-h-0 flex-col">
      <header
        class="mb-3 flex shrink-0 flex-col gap-1 sm:mb-4 sm:flex-row sm:items-start sm:justify-between"
      >
        <div>
          <h1 class="font-display text-2xl font-bold">Punto de Venta</h1>
          <p class="text-muted-foreground text-sm">
            @if (cashSession()) {
              Turno abierto · Caja {{ money(cashSession()!.openingAmount) }}
            } @else {
              No hay caja abierta
            }
          </p>
        </div>
        <div class="flex shrink-0 items-center gap-2">
          @if (cashSession()) {
            <mo-button size="xs" variant="outline" (click)="historyOpen.set(true)">
              Ventas del turno
            </mo-button>
          } @else {
            <mo-button size="xs" (click)="goToCaja()">Abrir caja</mo-button>
          }
          <span
            [class]="
              cashSession()
                ? 'inline-flex h-7 w-fit items-center rounded-full border border-emerald-600 bg-emerald-500/15 px-2.5 text-xs font-semibold text-emerald-700'
                : 'text-muted-foreground inline-flex h-7 w-fit items-center rounded-full border px-2.5 text-xs font-semibold'
            "
          >
            {{ cashSession() ? 'Caja abierta' : 'Caja cerrada' }}
          </span>
        </div>
      </header>

      @if (loading()) {
        <div
          class="bg-card flex min-h-[28rem] flex-1 animate-pulse overflow-hidden rounded-xl border"
        >
          <div class="flex min-h-0 flex-1 flex-col gap-4 p-4">
            <div class="bg-muted h-11 rounded-xl"></div>
            <div class="bg-muted/50 flex-1 rounded-xl"></div>
          </div>
          <div class="hidden w-96 border-l p-4 lg:block">
            <div class="bg-muted mb-4 h-8 w-32 rounded"></div>
            <div class="bg-muted/50 h-48 rounded-xl"></div>
          </div>
        </div>
      } @else if (loadError()) {
        <div
          class="bg-card flex flex-1 items-center justify-center rounded-xl border p-8 text-center"
        >
          <div>
            <p class="text-destructive text-sm font-semibold">{{ loadError() }}</p>
            <mo-button class="mt-4 inline-block" (click)="load()">Reintentar</mo-button>
          </div>
        </div>
      } @else {
        <div
          class="bg-card flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border lg:flex-row"
        >
          <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div class="flex shrink-0 items-center justify-between border-b px-4 py-3 lg:px-6">
              <p class="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                {{ products().length }} productos
              </p>
              @if (cart.items().length > 0) {
                <p class="text-muted-foreground text-xs">
                  {{ cart.items().length }} items en carrito
                </p>
              }
            </div>

            <div class="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-3 sm:p-4 lg:p-5">
              <div class="relative shrink-0">
                <input
                  type="search"
                  [value]="query()"
                  (input)="setQuery($event)"
                  placeholder="Buscar por nombre, SKU o codigo de barras..."
                  class="border-input bg-background focus:ring-ring h-11 w-full rounded-xl border px-4 text-sm transition-shadow outline-none focus:ring-2"
                />
              </div>

              @if (categories().length > 0) {
                <div class="flex shrink-0 gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
                  <button
                    type="button"
                    (click)="activeCategory.set(null)"
                    [class]="categoryClass(null)"
                  >
                    Todos
                  </button>
                  @for (category of categories(); track category.id) {
                    <button
                      type="button"
                      (click)="toggleCategory(category.id)"
                      [class]="categoryClass(category.id)"
                    >
                      {{ category.nombre }}
                    </button>
                  }
                </div>
              }

              <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                @if (filteredProducts().length === 0) {
                  <div class="text-muted-foreground flex h-48 items-center justify-center text-sm">
                    Sin productos para esta busqueda
                  </div>
                } @else {
                  <div class="grid grid-cols-1 gap-2.5 pb-3 sm:grid-cols-2 2xl:grid-cols-3">
                    @for (product of filteredProducts(); track product.id) {
                      <article [class]="productCardClass(product)">
                        <button
                          type="button"
                          [disabled]="isOutOfStock(product)"
                          [attr.aria-label]="'Agregar ' + product.nombre + ' al carrito'"
                          (click)="selectProduct(product)"
                          [class]="productAddButtonClass(product)"
                        >
                          <div class="flex w-full items-center justify-between gap-2">
                            <span
                              class="text-muted-foreground min-w-0 truncate font-mono text-[10px] font-semibold tracking-wide uppercase"
                            >
                              {{ product.sku || 'Producto' }}
                            </span>
                            <span [class]="productStockBadgeClass(product)">
                              <span class="h-1.5 w-1.5 rounded-full bg-current opacity-70"></span>
                              {{ productStockLabel(product) }}
                            </span>
                          </div>

                          <h3
                            class="text-foreground mt-3 w-full text-[15px] leading-[1.3] font-bold tracking-[-0.01em]"
                          >
                            {{ product.nombre }}
                          </h3>

                          <div class="mt-auto flex w-full items-end justify-between gap-3 pt-5">
                            <div class="min-w-0">
                              <span
                                class="text-muted-foreground block text-[10px] font-semibold tracking-wide uppercase"
                              >
                                Precio de venta
                              </span>
                              <span
                                class="font-display text-primary mt-0.5 block text-lg leading-none font-bold tabular-nums"
                              >
                                {{ money(product.precioVenta) }}
                              </span>
                              @if (mostrarIvaEnPos() && product.ivaTasa > 0) {
                                <span class="text-muted-foreground mt-1 block text-[10px]">
                                  IVA {{ product.ivaTasa }}% incluido
                                </span>
                              }
                              @if (product.components.length > 0) {
                                <span class="text-amber-600 mt-1.5 flex items-center gap-1 text-[10px] font-semibold">
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-3 w-3 shrink-0"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                                  Descuenta: {{ componentLabel(product.components) }}
                                </span>
                              }
                            </div>

                            @if (isOutOfStock(product)) {
                              <span
                                class="bg-destructive/10 text-destructive inline-flex h-10 shrink-0 items-center rounded-xl px-3 text-[11px] font-bold"
                              >
                                Agotado
                              </span>
                            } @else {
                              <span
                                aria-hidden="true"
                                class="bg-primary text-primary-foreground shadow-primary/20 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-md transition-transform group-active:scale-90"
                              >
                                <svg
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  stroke-width="2.5"
                                  class="h-5 w-5"
                                >
                                  <path d="M12 5v14M5 12h14" />
                                </svg>
                              </span>
                            }
                          </div>
                        </button>
                        <div class="border-border/60 bg-muted/20 w-full border-t px-2 py-1.5">
                          <button
                            type="button"
                            [attr.aria-label]="'Ver información de ' + product.nombre"
                            (click)="openProductInfo(product)"
                            class="text-muted-foreground hover:bg-background hover:text-foreground focus:ring-ring flex min-h-11 w-full items-center justify-between rounded-lg px-2.5 text-xs font-semibold transition-colors focus:ring-2 focus:outline-none"
                          >
                            <span class="flex items-center gap-2">
                              <svg
                                aria-hidden="true"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="2"
                                class="h-4 w-4"
                              >
                                <circle cx="12" cy="12" r="9" />
                                <path d="M12 11v5" />
                                <path d="M12 8h.01" />
                              </svg>
                              Ficha del producto
                            </span>
                            <svg
                              aria-hidden="true"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              stroke-width="2"
                              class="h-4 w-4"
                            >
                              <path d="m9 18 6-6-6-6" />
                            </svg>
                          </button>
                        </div>
                      </article>
                    }
                  </div>
                }
              </div>
            </div>
          </div>

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
                          (click)="clearCliente()"
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
                          @if (cartStampsPreview() > 0) {
                            <p class="text-muted-foreground text-[11px]">
                              Esta venta suma {{ cartStampsPreview() }}
                              {{ cartStampsPreview() === 1 ? 'sello' : 'sellos' }}
                            </p>
                          }

                          @if (cart.loyaltyRedemption(); as redemption) {
                            <div
                              class="flex items-center justify-between gap-2 rounded-md bg-emerald-500/15 px-2 py-1.5"
                            >
                              <span class="text-[11px] font-semibold text-emerald-700">
                                🎁 Premio aplicado · −{{ money(redemption.amount) }}
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
                              (click)="redeemLoyaltyReward()"
                              class="bg-primary text-primary-foreground w-full rounded-md py-1.5 text-xs font-bold transition-all hover:brightness-110"
                            >
                              🎁 Canjear batido gratis
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
                      (click)="customerPickerOpen.set(true)"
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
                            @if (item.sku) {
                              <p class="text-muted-foreground font-mono text-[11px]">
                                {{ item.sku }}
                              </p>
                            }
                            @if (item.components.length > 0) {
                              <p class="text-amber-600 mt-0.5 flex items-center gap-1 text-[11px] font-medium">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-3 w-3 shrink-0"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
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
                            <p class="text-sm font-bold tabular-nums">{{ money(item.total) }}</p>
                            <p class="text-muted-foreground text-[11px] tabular-nums">
                              {{ money(item.unitPrice) }} × {{ item.quantity }}
                            </p>
                          </div>
                        </div>

                        <div class="mt-2 flex items-center justify-between gap-2">
                          <button
                            type="button"
                            (click)="openItemDiscount(item)"
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
                              −{{ money(item.descuentoTotal) }}
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
                        >−{{ money(cart.totals().discountTotal) }}</span
                      >
                    </div>
                  }
                  @if (mostrarIvaEnPos() && cart.totals().taxTotal > 0) {
                    <div class="mb-1.5 flex justify-between text-sm">
                      <span class="text-muted-foreground">IVA</span>
                      <span class="text-muted-foreground">{{ money(cart.totals().taxTotal) }}</span>
                    </div>
                  }

                  <div class="mt-2.5 flex items-end justify-between border-t pt-2.5">
                    <span class="text-muted-foreground text-sm font-semibold">Total</span>
                    <span
                      class="font-display text-primary text-xl font-bold tabular-nums sm:text-2xl"
                    >
                      {{ money(cart.totals().total) }}
                    </span>
                  </div>

                  <button
                    type="button"
                    (click)="openCheckout()"
                    [disabled]="!cashSession()"
                    class="bg-primary text-primary-foreground mt-3 h-12 w-full rounded-lg text-base font-bold tracking-wide transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Cobrar {{ money(cart.totals().total) }}
                  </button>
                </div>
              </div>
            }
          </aside>
        </div>
      }
    </section>

    @if (checkoutOpen()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
        <button
          type="button"
          aria-label="Cerrar cobro"
          class="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
          [disabled]="isSaving()"
          (click)="closeCheckout()"
        ></button>
        <section
          class="bg-card ring-border/60 relative z-10 flex max-h-[calc(100dvh-1.5rem)] w-full max-w-md flex-col overflow-hidden rounded-2xl shadow-2xl ring-1"
        >
          <div class="bg-primary h-1"></div>
          <header class="shrink-0 border-b px-4 pt-4 pb-3 sm:px-6">
            <h2 class="font-display text-lg leading-none font-bold">Cobrar venta</h2>
          </header>

          <div class="min-h-0 space-y-4 overflow-y-auto p-4 sm:p-6">
            <div class="bg-muted/50 rounded-xl px-4 py-3">
              <p class="text-muted-foreground mb-2 text-[10px] font-semibold tracking-wide uppercase">
                Resumen de compra
              </p>
              <div class="border-border/50 mb-2.5 space-y-1 border-b pb-2.5">
                @for (item of cart.items(); track item.key) {
                  <div class="flex items-start justify-between gap-2">
                    <span class="min-w-0 flex-1 text-sm leading-snug">
                      {{ item.nombre }}
                      <span class="text-muted-foreground">&nbsp;×&nbsp;{{ item.quantity }}</span>
                    </span>
                    <div class="shrink-0 text-right">
                      <span class="text-sm font-semibold tabular-nums">{{ money(item.total) }}</span>
                      @if (item.descuentoTotal > 0) {
                        <span class="text-destructive ml-1.5 text-[11px] tabular-nums">
                          −{{ money(item.descuentoTotal) }}
                        </span>
                      }
                    </div>
                  </div>
                }
              </div>
              @if (cart.totals().discountTotal > 0) {
                <div class="flex justify-between text-sm">
                  <span class="text-muted-foreground">Descuentos</span>
                  <span class="text-destructive font-medium"
                    >−{{ money(cart.totals().discountTotal) }}</span
                  >
                </div>
              }
              <div class="flex justify-between text-sm">
                <span class="text-muted-foreground">Total venta</span>
                <span class="font-semibold">{{ money(cart.totals().total) }}</span>
              </div>
              @if (cart.totalPaid() > 0) {
                <div class="flex justify-between text-sm">
                  <span class="text-muted-foreground">Pagado</span>
                  <span class="font-semibold text-emerald-600">{{ money(cart.totalPaid()) }}</span>
                </div>
              }
              @if (cart.remainingAmount() > 0) {
                <div class="mt-1 flex justify-between text-sm font-semibold">
                  <span>Falta</span>
                  <span class="text-destructive">{{ money(cart.remainingAmount()) }}</span>
                </div>
              }
              @if (cart.change() > 0) {
                <div class="mt-1 flex justify-between font-bold">
                  <span>Cambio</span>
                  <span class="text-primary">{{ money(cart.change()) }}</span>
                </div>
              }
            </div>

            @if (cart.payments().length > 0) {
              <div class="space-y-1.5">
                @for (payment of cart.payments(); track $index) {
                  <div
                    class="bg-background flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                  >
                    <span class="min-w-0">
                      <span class="block font-medium">{{ paymentLabel(payment.metodo) }}</span>
                      @if (payment.referencia) {
                        <span class="text-muted-foreground block truncate text-[11px]">
                          Ref: {{ payment.referencia }}
                        </span>
                      }
                    </span>
                    <div class="flex shrink-0 items-center gap-3">
                      <span class="font-mono font-semibold tabular-nums">{{
                        money(payment.amount)
                      }}</span>
                      <button
                        type="button"
                        (click)="cart.removePayment($index)"
                        class="text-muted-foreground hover:text-destructive"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                }
              </div>
            }

            <div class="space-y-2">
              <div class="flex items-center justify-between gap-2">
                <p class="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                  Descuento global
                </p>
                <div class="flex gap-1" role="group" aria-label="Tipo de descuento">
                  <button
                    type="button"
                    [attr.aria-pressed]="discountMode() === 'amount'"
                    [class]="discountModeClass('amount')"
                    (click)="setDiscountMode('amount')"
                  >
                    $
                  </button>
                  <button
                    type="button"
                    [attr.aria-pressed]="discountMode() === 'percent'"
                    [class]="discountModeClass('percent')"
                    (click)="setDiscountMode('percent')"
                  >
                    %
                  </button>
                </div>
              </div>
              <div class="flex gap-2">
                @if (discountMode() === 'amount') {
                  <input
                    type="text"
                    inputmode="numeric"
                    [value]="globalDiscountInput()"
                    (input)="setGlobalDiscount($event)"
                    placeholder="0"
                    class="border-input bg-card focus:ring-ring h-10 min-w-0 flex-1 rounded-lg border px-3 text-sm tabular-nums outline-none focus:ring-2"
                  />
                } @else {
                  <input
                    type="text"
                    inputmode="numeric"
                    [value]="globalDiscountPercentInput()"
                    (input)="setGlobalDiscountPercent($event)"
                    placeholder="0"
                    class="border-input bg-card focus:ring-ring h-10 min-w-0 flex-1 rounded-lg border px-3 text-sm tabular-nums outline-none focus:ring-2"
                  />
                }
                @if (cart.globalDiscount() > 0) {
                  <button
                    type="button"
                    (click)="clearGlobalDiscount()"
                    class="rounded-lg border px-4 text-xs font-semibold"
                  >
                    Quitar
                  </button>
                }
              </div>
              <p class="text-muted-foreground text-[11px]">
                @if (discountMode() === 'amount') {
                  Monto en pesos distribuido entre los productos para recalcular correctamente el IVA.
                } @else {
                  Porcentaje sobre el subtotal ({{ money(cart.totals().subtotal) }}), distribuido entre los productos.
                }
              </p>
            </div>

            @if (cart.loyaltyRedemption(); as redemption) {
              <div class="flex items-center justify-between rounded-xl border border-emerald-600/30 bg-emerald-500/10 px-3 py-2">
                <span class="text-xs font-bold text-emerald-700">🎁 Canje MOVE ON Club</span>
                <span class="text-xs font-semibold text-emerald-700 tabular-nums">
                  −{{ money(redemption.amount) }}
                </span>
              </div>
            }

            @if (discretionaryDiscountTotal() > 0) {
              <div class="space-y-2 rounded-xl border border-amber-500/30 bg-amber-500/8 p-3">
                <div class="flex items-center justify-between gap-3">
                  <p class="text-xs font-bold tracking-wide uppercase">Control del descuento</p>
                  <span class="text-muted-foreground text-[11px] tabular-nums">
                    {{ money(discretionaryDiscountTotal()) }} · {{ discountPercentage() }}%
                  </span>
                </div>
                <input
                  type="text"
                  [value]="discountReason()"
                  (input)="setDiscountReason($event)"
                  maxlength="160"
                  placeholder="Motivo del descuento"
                  class="border-input bg-card focus:ring-ring h-10 w-full rounded-lg border px-3 text-sm outline-none focus:ring-2"
                />
                <p class="text-muted-foreground text-[11px]">
                  El motivo queda en el historial y la auditoría.
                  @if (!isAdmin()) {
                    Descuentos mayores al 50% requieren un administrador.
                  }
                </p>
                @if (discountAuthorizationError()) {
                  <p class="text-destructive text-xs font-semibold">
                    {{ discountAuthorizationError() }}
                  </p>
                }
              </div>
            }

            <div class="space-y-3">
              <p class="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                Metodo de pago
              </p>
              <div class="grid grid-cols-2 gap-1.5 min-[420px]:grid-cols-3">
                @for (method of paymentMethods; track method.value) {
                  <button
                    type="button"
                    (click)="selectPaymentMethod(method.value)"
                    [class]="paymentMethodClass(method.value)"
                  >
                    {{ method.label }}
                  </button>
                }
              </div>

              @if (showReference()) {
                <input
                  type="text"
                  [value]="paymentReference()"
                  (input)="setPaymentReference($event)"
                  placeholder="Referencia (opcional)"
                  class="border-input bg-card focus:ring-ring h-10 w-full rounded-lg border px-3 text-sm outline-none focus:ring-2"
                />
              }

              <div class="flex gap-2">
                <input
                  type="text"
                  inputmode="numeric"
                  [value]="paymentAmount()"
                  (input)="setPaymentAmount($event)"
                  [placeholder]="cart.remainingAmount() > 0 ? String(cart.remainingAmount()) : '0'"
                  class="border-input bg-card focus:ring-ring h-10 min-w-0 flex-1 rounded-lg border px-3 text-sm outline-none focus:ring-2"
                />
                <button
                  type="button"
                  (click)="addPayment()"
                  class="rounded-lg border px-4 text-sm font-semibold"
                >
                  Agregar
                </button>
              </div>

              @if (cart.remainingAmount() > 0) {
                <button
                  type="button"
                  (click)="addExactPayment()"
                  class="text-muted-foreground hover:border-primary hover:text-primary w-full rounded-lg border border-dashed py-2 text-xs transition-colors"
                >
                  Monto exacto: {{ money(cart.remainingAmount()) }}
                </button>
              }
            </div>

            <div class="space-y-2">
              <p class="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                Tirilla de compra
              </p>
              <div class="grid grid-cols-2 gap-2" role="group" aria-label="Imprimir tirilla">
                <button
                  type="button"
                  [attr.aria-pressed]="imprimirEstaVenta()"
                  [class]="receiptChoiceClass(true)"
                  (click)="imprimirEstaVenta.set(true)"
                >
                  Imprimir
                </button>
                <button
                  type="button"
                  [attr.aria-pressed]="!imprimirEstaVenta()"
                  [class]="receiptChoiceClass(false)"
                  (click)="imprimirEstaVenta.set(false)"
                >
                  No imprimir
                </button>
              </div>
              <p class="text-muted-foreground text-[11px]">
                Esta eleccion aplica solamente a la venta actual.
              </p>
            </div>

            <div class="space-y-2">
              <p class="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                Caja fuerte
              </p>
              <button
                type="button"
                (click)="openCashDrawerManually()"
                [disabled]="openingCashDrawer()"
                class="text-muted-foreground hover:border-primary hover:text-primary w-full rounded-lg border border-dashed py-2 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              >
                {{ openingCashDrawer() ? 'Abriendo caja fuerte...' : 'Abrir caja fuerte' }}
              </button>
            </div>

            @if (saleError()) {
              <p class="bg-destructive/10 text-destructive rounded-lg px-3 py-2 text-sm">
                {{ saleError() }}
              </p>
            }

            <div class="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
              <button
                type="button"
                (click)="closeCheckout()"
                [disabled]="isSaving()"
                class="h-10 rounded-lg border px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                (click)="confirmSale()"
                [disabled]="!canConfirm() || isSaving()"
                class="bg-primary text-primary-foreground h-10 rounded-lg px-4 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50"
              >
                @if (isSaving()) {
                  <mo-spinner size="sm" class="mr-2 inline-block align-[-2px]" />
                  Guardando venta...
                } @else {
                  Confirmar · {{ money(cart.totals().total) }}
                }
              </button>
            </div>
          </div>
        </section>
      </div>
    }

    <mo-sales-history-dialog
      [open]="historyOpen()"
      [cashSessionId]="cashSession()?.id ?? null"
      [cashSessionIsOpen]="cashSession() !== null"
      (closed)="historyOpen.set(false)"
    />

    <mo-customer-picker-dialog
      [open]="customerPickerOpen()"
      (closed)="customerPickerOpen.set(false)"
      (selected)="onCustomerSelected($event)"
      (createRequested)="customerFormOpen.set(true)"
    />

    <mo-cliente-form-dialog
      [open]="customerFormOpen()"
      [cliente]="null"
      (closed)="customerFormOpen.set(false)"
      (saved)="onCustomerCreated($event)"
    />

    <mo-item-discount-dialog
      [open]="discountItem() !== null"
      [item]="discountItem()"
      (closed)="discountItem.set(null)"
      (applied)="onItemDiscountApplied($event)"
    />

    <mo-product-info-dialog
      [open]="productInfo() !== null"
      [product]="productInfo()"
      [isAdmin]="isAdmin()"
      (closed)="productInfo.set(null)"
    />

    <mo-receipt-output-status-dialog
      [open]="receiptOutputStatus() !== null"
      [kind]="receiptOutputKind()"
      [status]="receiptOutputStatus() ?? 'printing'"
      [errorMessage]="receiptOutputError()"
      (retry)="retryReceiptOutput()"
      (closed)="dismissReceiptOutput()"
    />
  `,
})
export class PosPage {
  private readonly sessionService = inject(SessionService)
  private readonly tiendaInfo = inject(TiendaInfoService)
  private readonly dataService = inject(PosDataService)
  private readonly saleService = inject(PosSaleService)
  private readonly loyaltyRepo = inject(LoyaltyRepository)
  private readonly receiptPrint = inject(ReceiptPrintService)
  private readonly toast = inject(ToastService)
  private readonly router = inject(Router)

  readonly cart = inject(PosCartStore)
  readonly products = signal<PosProduct[]>([])
  readonly mostrarIvaEnPos = signal(true)
  readonly imprimirAlFinalizarVenta = signal(false)
  readonly imprimirEstaVenta = signal(false)
  readonly abrirCajonEnEfectivo = signal(true)
  readonly categories = signal<PosCategory[]>([])
  readonly cashSession = signal<OpenCashSession | null>(null)
  readonly query = signal('')
  readonly activeCategory = signal<string | null>(null)
  readonly loading = signal(true)
  readonly loadError = signal<string | null>(null)
  readonly checkoutOpen = signal(false)
  readonly paymentMethod = signal<PaymentMethod>('cash')
  readonly paymentAmount = signal('')
  readonly paymentReference = signal<string>('')
  readonly saleError = signal<string | null>(null)
  readonly historyOpen = signal(false)
  readonly isSaving = signal(false)
  readonly receiptOutputStatus = signal<ReceiptOutputStatus | null>(null)
  readonly receiptOutputError = signal<string | null>(null)
  readonly pendingReceiptOutput = signal<PostSaleOutputJob | null>(null)
  readonly openingCashDrawer = signal(false)
  readonly customerPickerOpen = signal(false)
  readonly customerFormOpen = signal(false)
  readonly loyaltySummary = signal<LoyaltySummary | null>(null)
  readonly loyaltyLoading = signal(false)
  // PLAN-59: se actualiza en load() con settings.data.fidelizacion de la tienda.
  readonly stampsPerReward = signal(DEFAULT_LOYALTY_CONFIG.sellosParaRecompensa)
  readonly discountItem = signal<PosCartItem | null>(null)
  readonly productInfo = signal<PosProduct | null>(null)
  readonly isAdmin = this.sessionService.isAdmin
  readonly globalDiscountInput = signal('')
  readonly globalDiscountPercentInput = signal('')
  readonly discountMode = signal<'amount' | 'percent'>('amount')
  readonly discountReason = signal('')
  readonly paymentMethods = PAYMENT_METHOD_OPTIONS
  readonly String = String

  readonly filteredProducts = computed(() => {
    const q = this.query().toLowerCase().trim()
    const categoryId = this.activeCategory()
    const filtered = this.products().filter((product) => {
      const matchesCategory = categoryId === null || product.categoriaId === categoryId
      if (!matchesCategory) return false
      if (!q) return true

      return (
        product.nombre.toLowerCase().includes(q) ||
        (product.sku?.toLowerCase().includes(q) ?? false) ||
        product.codigoBarras === this.query().trim()
      )
    })

    return [
      ...filtered.filter((product) => product.stockDisponible !== 0),
      ...filtered.filter((product) => product.stockDisponible === 0),
    ]
  })

  /**
   * Descuento discrecional = total − canje MOVE ON Club. El canje no exige
   * motivo ni cuenta para el tope del 50% del cajero (RN-LF12 / ADR 0013 §5).
   */
  readonly discretionaryDiscountTotal = computed(
    () => this.cart.totals().discountTotal - (this.cart.loyaltyRedemption()?.amount ?? 0),
  )

  /** Sellos que sumará el carrito actual (previsualización; el RPC es la autoridad). */
  readonly cartStampsPreview = computed(() => {
    if (!this.loyaltySummary()) return 0
    if (this.cart.globalDiscount() > 0) return 0
    const redemption = this.cart.loyaltyRedemption()
    return countEligibleStampUnits(
      this.cart.items().map((item) => ({
        participaFidelizacion: item.participaFidelizacion,
        quantity: item.quantity,
        discountAmount: item.discountAmount,
        hasRedemption: redemption?.productId === item.key,
      })),
    )
  })

  readonly loyaltyProgressPercent = computed(() => {
    const summary = this.loyaltySummary()
    if (!summary) return 0
    return Math.min(100, Math.round((summary.stampsBalance / this.stampsPerReward()) * 100))
  })

  readonly canConfirm = computed(() => {
    const paymentError = validatePaymentsForSale(this.cart.payments(), this.cart.totals().total)
    const hasDiscount = this.discretionaryDiscountTotal() > 0
    return (
      this.cart.items().length > 0 &&
      this.cart.totalPaid() >= this.cart.totals().total &&
      (!hasDiscount || this.discountReason().trim().length >= 3) &&
      !this.discountAuthorizationError() &&
      !paymentError
    )
  })
  readonly discountAuthorizationError = computed(() => {
    const role = this.sessionService.role()
    if (!role) return null
    return validateDiscountAuthorization(
      role,
      this.cart.totals().subtotal,
      this.discretionaryDiscountTotal()
    )
  })

  /** El campo "Referencia" solo aplica a métodos no-efectivo. */
  readonly showReference = computed(() => requiresReference(this.paymentMethod()))
  readonly receiptOutputKind = computed<ReceiptOutputKind>(() =>
    this.pendingReceiptOutput()?.printReceipt ? 'receipt' : 'drawer'
  )

  constructor() {
    // El store marca el tope de stock; la página dispara el toast (ToastService
    // NO vive en el store). Se consume y se limpia para no repetirlo.
    effect(() => {
      const feedback = this.cart.stockCapFeedback()
      if (!feedback) return
      this.toast.warning(`Stock máximo: ${feedback.maxQuantity} unidades`)
      this.cart.clearStockCapFeedback()
    })

    void this.load()
  }

  async load(): Promise<void> {
    this.loading.set(true)
    this.loadError.set(null)

    try {
      const auth = await this.sessionService.getAuthContext()
      if (!auth) throw new Error('No autenticado')

      const [products, categories, cashSession, tienda] = await Promise.all([
        this.dataService.listProducts(auth.tiendaId),
        this.dataService.listCategories(auth.tiendaId),
        this.dataService.getOpenCashSession(auth.tiendaId),
        this.tiendaInfo.get(auth.tiendaId),
      ])

      this.products.set(products)
      this.categories.set(categories)
      this.cashSession.set(cashSession)
      this.mostrarIvaEnPos.set(tienda.receipt.mostrarIvaEnPos)
      this.imprimirAlFinalizarVenta.set(tienda.receipt.imprimirAlFinalizarVenta)
      this.abrirCajonEnEfectivo.set(tienda.receipt.abrirCajonEnEfectivo)
      this.stampsPerReward.set(tienda.fidelizacion.sellosParaRecompensa)
    } catch (error) {
      this.loadError.set(getErrorMessage(error, 'No se pudo cargar el POS'))
    } finally {
      this.loading.set(false)
    }
  }

  money(amount: number): string {
    return formatCurrency(amount)
  }

  paymentLabel(method: PaymentMethod): string {
    return getPaymentMethodLabel(method)
  }

  componentLabel(components: { nombre: string; cantidad: number }[]): string {
    return components
      .map((c) => (c.cantidad === 1 ? `1 ${c.nombre}` : `${c.cantidad}× ${c.nombre}`))
      .join(', ')
  }

  discountPercentage(): string {
    const subtotal = this.cart.totals().subtotal
    if (subtotal <= 0) return '0.00'
    return ((this.discretionaryDiscountTotal() / subtotal) * 100).toFixed(2)
  }

  setQuery(event: Event): void {
    const value = (event.target as HTMLInputElement).value
    this.query.set(value)

    const trimmed = value.trim()
    if (trimmed.length < 6) return

    const barcodeMatch = this.products().find((product) => product.codigoBarras === trimmed)
    if (!barcodeMatch) return

    this.selectProduct(barcodeMatch)
    this.query.set('')
  }

  toggleCategory(categoryId: string): void {
    this.activeCategory.set(this.activeCategory() === categoryId ? null : categoryId)
  }

  categoryClass(categoryId: string | null): string {
    const active = this.activeCategory() === categoryId
    return [
      'min-h-9 shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all duration-150',
      active
        ? 'bg-primary text-primary-foreground shadow-sm'
        : 'bg-muted text-muted-foreground hover:bg-muted/70',
    ].join(' ')
  }

  productCardClass(product: PosProduct): string {
    const outOfStock = this.isOutOfStock(product)
    return [
      'group bg-card relative flex min-h-52 flex-col overflow-hidden rounded-2xl border text-left shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all duration-200',
      outOfStock
        ? 'border-border opacity-80'
        : 'hover:border-primary/40 hover:-translate-y-0.5 hover:shadow-[0_10px_24px_-16px_rgba(15,23,42,0.35)]',
    ].join(' ')
  }

  productAddButtonClass(product: PosProduct): string {
    return [
      'focus:ring-ring relative flex w-full flex-1 flex-col items-start p-4 text-left transition-colors focus:ring-2 focus:outline-none',
      this.isOutOfStock(product)
        ? 'cursor-not-allowed'
        : 'cursor-pointer hover:bg-primary/[0.035] active:bg-primary/[0.07]',
    ].join(' ')
  }

  productStockLabel(product: PosProduct): string {
    if (product.stockDisponible === null) return 'Bajo pedido'
    if (product.stockDisponible === 0) return 'Agotado'
    if (product.stockDisponible === 1) return '1 disponible'
    return `${product.stockDisponible} disponibles`
  }

  productStockBadgeClass(product: PosProduct): string {
    const base =
      'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold leading-4 tabular-nums'
    if (product.stockDisponible === null) {
      return `${base} border-border bg-muted text-muted-foreground`
    }
    if (this.isOutOfStock(product)) {
      return `${base} border-destructive/30 bg-destructive/10 text-destructive`
    }
    return `${base} border-emerald-600/25 bg-emerald-500/10 text-emerald-700`
  }

  selectProduct(product: PosProduct): void {
    this.cart.addItem(product)
  }

  openProductInfo(product: PosProduct): void {
    this.productInfo.set(product)
  }

  /** `true` cuando el producto rastrea stock y no hay unidades en punto de venta. */
  isOutOfStock(product: PosProduct): boolean {
    return product.stockDisponible === 0
  }

  /** `true` cuando el ítem rastrea stock y ya alcanzó el máximo disponible. */
  isAtStockMax(item: PosCartItem): boolean {
    return item.maxQuantity !== null && item.quantity >= item.maxQuantity
  }

  onCustomerSelected(cliente: Cliente): void {
    this.cart.setCliente(cliente.id, cliente.nombre)
    this.loyaltySummary.set(null)
    if (cliente.autorizaFidelizacion && cliente.activo) {
      void this.loadLoyaltySummary(cliente.id)
    }
  }

  onCustomerCreated(cliente: Cliente): void {
    this.customerFormOpen.set(false)
    this.onCustomerSelected(cliente)
    this.toast.success(`Cliente ${cliente.nombre} asociado a la venta`)
  }

  clearCliente(): void {
    this.cart.clearCliente()
    this.loyaltySummary.set(null)
  }

  private async loadLoyaltySummary(clienteId: string): Promise<void> {
    this.loyaltyLoading.set(true)
    try {
      const auth = await this.sessionService.getAuthContext()
      if (!auth) return
      const summary = await this.loyaltyRepo.getSummary(auth.tiendaId, clienteId)
      // Evita pisar el resumen si el cajero cambió de cliente mientras cargaba.
      if (this.cart.clienteId() === clienteId) {
        this.loyaltySummary.set(summary)
      }
    } catch {
      // El Club no bloquea la venta: sin resumen simplemente no se muestra.
      this.loyaltySummary.set(null)
    } finally {
      this.loyaltyLoading.set(false)
    }
  }

  /**
   * Canjea la recompensa más próxima a vencer sobre la línea elegible más
   * costosa del carrito (participa en el Club, sin descuento manual).
   */
  redeemLoyaltyReward(): void {
    const summary = this.loyaltySummary()
    const reward = summary?.availableRewards[0]
    if (!reward) return

    const eligible = this.cart
      .items()
      .filter((item) => item.participaFidelizacion && item.discountAmount === 0)
      .sort((a, b) => b.unitPrice - a.unitPrice)

    if (eligible.length === 0) {
      this.toast.warning('Agrega un batido del Club al carrito para canjear el premio')
      return
    }

    const item = eligible[0]
    this.cart.applyLoyaltyReward(reward.id, reward.rewardValueCop, item)
    const covered = Math.min(item.unitPrice, reward.rewardValueCop)
    this.toast.success(
      item.unitPrice > covered
        ? `Premio aplicado a ${item.nombre}: cubre ${formatCurrency(covered)}, el cliente paga la diferencia`
        : `Premio aplicado: ${item.nombre} gratis`,
    )
  }

  openItemDiscount(item: PosCartItem): void {
    this.discountItem.set(item)
  }

  onItemDiscountApplied(result: ItemDiscountResult): void {
    this.cart.updateDiscount(result.key, result.discountAmount)
    this.discountItem.set(null)
  }

  setGlobalDiscount(event: Event): void {
    const value = (event.target as HTMLInputElement).value.replace(/\D/g, '')
    this.globalDiscountInput.set(value)
    this.cart.setGlobalDiscount(value === '' ? 0 : Number.parseInt(value, 10))
  }

  setGlobalDiscountPercent(event: Event): void {
    const digits = (event.target as HTMLInputElement).value.replace(/\D/g, '')
    const clamped = digits === '' ? '' : String(Math.min(100, Number.parseInt(digits, 10)))
    this.globalDiscountPercentInput.set(clamped)
    const percent = clamped === '' ? 0 : Number.parseInt(clamped, 10)
    this.cart.setGlobalDiscount(Math.round((this.cart.totals().subtotal * percent) / 100))
  }

  setDiscountMode(mode: 'amount' | 'percent'): void {
    if (this.discountMode() === mode) return
    this.discountMode.set(mode)

    // Al cambiar de modo, refleja el monto actual del carrito en el input
    // que se va a mostrar (la fuente de verdad sigue siendo el monto en pesos).
    const amount = this.cart.globalDiscount()
    const subtotal = this.cart.totals().subtotal
    if (mode === 'percent') {
      const percent = subtotal > 0 ? Math.round((amount / subtotal) * 100) : 0
      this.globalDiscountPercentInput.set(percent > 0 ? String(percent) : '')
    } else {
      this.globalDiscountInput.set(amount > 0 ? String(amount) : '')
    }
  }

  discountModeClass(mode: 'amount' | 'percent'): string {
    const active = this.discountMode() === mode
    return [
      'h-8 min-w-9 rounded-md border px-2.5 text-xs font-semibold transition-colors',
      active
        ? 'border-primary bg-primary text-primary-foreground shadow-sm'
        : 'border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground',
    ].join(' ')
  }

  setDiscountReason(event: Event): void {
    this.discountReason.set((event.target as HTMLInputElement).value)
  }

  clearGlobalDiscount(): void {
    this.globalDiscountInput.set('')
    this.globalDiscountPercentInput.set('')
    this.cart.setGlobalDiscount(0)
  }

  openCheckout(): void {
    this.saleError.set(null)
    this.imprimirEstaVenta.set(this.imprimirAlFinalizarVenta())
    this.checkoutOpen.set(true)
    this.discountMode.set('amount')
    const currentGlobal = this.cart.globalDiscount()
    this.globalDiscountInput.set(currentGlobal > 0 ? String(currentGlobal) : '')
    this.globalDiscountPercentInput.set('')
    if (this.cart.remainingAmount() > 0) {
      this.paymentAmount.set(String(this.cart.remainingAmount()))
    }
  }

  closeCheckout(): void {
    if (this.isSaving()) return
    this.checkoutOpen.set(false)
    this.cart.clearPayments()
    this.paymentAmount.set('')
    this.paymentReference.set('')
    this.saleError.set(null)
  }

  setPaymentAmount(event: Event): void {
    const value = (event.target as HTMLInputElement).value.replace(/\D/g, '')
    this.paymentAmount.set(value)
  }

  setPaymentReference(event: Event): void {
    this.paymentReference.set((event.target as HTMLInputElement).value)
  }

  selectPaymentMethod(method: PaymentMethod): void {
    this.paymentMethod.set(method)
    // El efectivo no lleva referencia: limpiamos cualquier valor previo.
    if (!requiresReference(method)) {
      this.paymentReference.set('')
    }
  }

  paymentMethodClass(method: PaymentMethod): string {
    const active = this.paymentMethod() === method
    return [
      'min-h-10 rounded-lg border px-2 py-2 text-xs font-medium transition-colors',
      active
        ? 'border-primary bg-primary text-primary-foreground'
        : 'border-border bg-background hover:bg-muted',
    ].join(' ')
  }

  receiptChoiceClass(printReceipt: boolean): string {
    const active = this.imprimirEstaVenta() === printReceipt
    return [
      'h-10 rounded-lg border px-3 text-sm font-semibold transition-colors',
      active
        ? 'border-primary bg-primary text-primary-foreground shadow-sm'
        : 'border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground',
    ].join(' ')
  }

  addPayment(): void {
    const amount = Number.parseInt(this.paymentAmount().replace(/\D/g, ''), 10)
    this.registerPayment(amount)
  }

  /** "Monto exacto": arma y agrega el faltante actual en un solo paso. */
  addExactPayment(): void {
    this.registerPayment(this.cart.remainingAmount())
  }

  /**
   * Arma la entrada de pago con el helper de dominio (descarta referencia si es
   * efectivo, normaliza vacíos, valida amount > 0) y la agrega al carrito. Tras
   * agregar reprellena el input con el nuevo faltante y limpia la referencia.
   */
  private registerPayment(amount: number): void {
    const entry = buildPaymentEntry({
      metodo: this.paymentMethod(),
      amount,
      referencia: this.paymentReference(),
    })
    if (!entry) return

    this.cart.addPayment(entry)
    this.paymentReference.set('')

    const remaining = this.cart.remainingAmount()
    this.paymentAmount.set(remaining > 0 ? String(remaining) : '')
  }

  async openCashDrawerManually(): Promise<void> {
    if (this.openingCashDrawer()) return
    this.openingCashDrawer.set(true)
    try {
      await this.receiptPrint.openCashDrawer()
      this.toast.success('Caja fuerte abierta')
    } catch (error) {
      this.toast.error(getErrorMessage(error, 'No se pudo abrir la caja fuerte'))
    } finally {
      this.openingCashDrawer.set(false)
    }
  }

  async goToCaja(): Promise<void> {
    await this.router.navigateByUrl('/caja')
  }

  async confirmSale(): Promise<void> {
    const cashSession = this.cashSession()
    if (!cashSession || !this.canConfirm()) return

    this.saleError.set(null)
    this.isSaving.set(true)

    try {
      const redemption = this.cart.loyaltyRedemption()
      const result = await this.saleService.createSale({
        cashSessionId: cashSession.id,
        idempotencyKey: this.cart.idempotencyKey(),
        clienteId: this.cart.clienteId(),
        items: this.cart.items(),
        payments: this.cart.payments(),
        totals: this.cart.totals(),
        globalDiscountTotal: this.cart.globalDiscount(),
        // Solo el descuento discrecional exige motivo; el canje lleva motivo
        // reservado automático en el RPC (ADR 0013 §5).
        discountReason: this.discretionaryDiscountTotal() > 0 ? this.discountReason().trim() : null,
        change: this.cart.change(),
        loyaltyRedemptions: redemption
          ? [{ rewardId: redemption.rewardId, productId: redemption.productId }]
          : [],
      })

      if (!result.ok) {
        this.saleError.set(
          result.error.kind === 'unauthenticated' ? 'Sesion expirada' : result.error.message
        )
        return
      }

      const change = this.cart.change()
      const saleId = result.value.saleId
      const shouldPrintReceipt = this.imprimirEstaVenta()
      const shouldOpenCashDrawer =
        this.abrirCajonEnEfectivo() &&
        this.cart.payments().some((payment) => payment.metodo === 'cash' && payment.amount > 0)
      this.cart.clearCart()
      this.loyaltySummary.set(null)
      this.globalDiscountInput.set('')
      this.globalDiscountPercentInput.set('')
      this.discountMode.set('amount')
      this.discountReason.set('')
      this.paymentAmount.set('')
      this.paymentReference.set('')
      this.paymentMethod.set('cash')
      this.checkoutOpen.set(false)

      this.toast.success(
        change > 0 ? `Venta completada · cambio ${formatCurrency(change)}` : 'Venta completada'
      )
      if (shouldPrintReceipt || shouldOpenCashDrawer) {
        await this.runReceiptOutput({
          saleId,
          change,
          printReceipt: shouldPrintReceipt,
          openCashDrawer: shouldOpenCashDrawer,
        })
      }
    } catch (error) {
      this.saleError.set(getErrorMessage(error, 'No se pudo completar la venta'))
    } finally {
      this.isSaving.set(false)
    }
  }

  retryReceiptOutput(): void {
    const job = this.pendingReceiptOutput()
    if (!job || this.receiptOutputStatus() === 'printing') return
    void this.runReceiptOutput(job)
  }

  dismissReceiptOutput(): void {
    if (this.receiptOutputStatus() === 'printing') return
    this.receiptOutputStatus.set(null)
    this.receiptOutputError.set(null)
    this.pendingReceiptOutput.set(null)
  }

  private async runReceiptOutput(job: PostSaleOutputJob): Promise<void> {
    this.pendingReceiptOutput.set(job)
    this.receiptOutputError.set(null)
    this.receiptOutputStatus.set('printing')

    try {
      if (job.printReceipt) {
        await this.receiptPrint.printSale(job.saleId, {
          change: job.change,
          openCashDrawer: job.openCashDrawer,
        })
        this.toast.success('Tirilla enviada a la impresora')
      } else {
        await this.receiptPrint.openCashDrawer()
        this.toast.success('Caja fuerte abierta')
      }

      this.receiptOutputStatus.set(null)
      this.pendingReceiptOutput.set(null)
    } catch (error) {
      this.receiptOutputError.set(
        getErrorMessage(
          error,
          job.printReceipt
            ? 'La venta se guardó, pero la tirilla no se imprimió.'
            : 'La venta se guardó, pero la caja fuerte no se pudo abrir.'
        )
      )
      this.receiptOutputStatus.set('error')
    }
  }
}
