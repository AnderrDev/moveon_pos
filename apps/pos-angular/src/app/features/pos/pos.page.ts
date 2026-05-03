import { Component, computed, inject, signal } from '@angular/core'
import { formatCurrency } from '@/shared/lib/format'
import { getPaymentMethodLabel, PAYMENT_METHOD_OPTIONS } from '@/shared/lib/payment-methods'
import { validatePaymentsForSale } from '@/modules/sales/domain/services/sale-calculator'
import type { PaymentMethod } from '@/shared/types'
import { SessionService } from '../../core/auth/session.service'
import { ToastService } from '../../shared/feedback/toast.service'
import { PosCartStore } from './pos-cart.store'
import { PosDataService } from './pos-data.service'
import { PosSaleService } from './pos-sale.service'
import { SalesHistoryDialog } from './sales-history.dialog'
import type { OpenCashSession, PosCategory, PosProduct } from './pos.types'

@Component({
  selector: 'mo-pos-page',
  standalone: true,
  providers: [PosCartStore],
  imports: [SalesHistoryDialog],
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
            <button
              type="button"
              (click)="historyOpen.set(true)"
              class="hover:bg-muted h-8 rounded-lg border px-3 text-xs font-semibold transition-colors"
            >
              Ventas del turno
            </button>
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
            <button
              type="button"
              (click)="load()"
              class="bg-primary text-primary-foreground mt-4 h-10 rounded-lg px-4 text-sm font-bold"
            >
              Reintentar
            </button>
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
                  <div class="grid grid-cols-2 gap-2 pb-3 sm:grid-cols-3 xl:grid-cols-4">
                    @for (product of filteredProducts(); track product.id) {
                      <button
                        type="button"
                        (click)="selectProduct(product)"
                        class="bg-card hover:border-primary/50 hover:bg-primary/5 focus:ring-ring flex min-h-24 cursor-pointer flex-col items-start rounded-xl border p-3.5 text-left transition-all duration-150 focus:ring-2 focus:outline-none active:scale-[0.98]"
                      >
                        <span
                          class="text-foreground line-clamp-2 text-sm leading-snug font-semibold"
                        >
                          {{ product.nombre }}
                        </span>
                        @if (product.sku) {
                          <span
                            class="text-muted-foreground mt-0.5 font-mono text-[10px] leading-none"
                          >
                            {{ product.sku }}
                          </span>
                        }
                        <span class="mt-auto pt-2">
                          <span class="text-primary block text-base font-bold tabular-nums">
                            {{ money(product.precioVenta) }}
                          </span>
                          @if (product.ivaTasa > 0) {
                            <span class="text-muted-foreground text-[10px]"
                              >+IVA {{ product.ivaTasa }}%</span
                            >
                          }
                        </span>
                      </button>
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
                              class="h-9 w-9"
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
                  @if (cart.totals().taxTotal > 0) {
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
                    <span class="font-medium">{{ paymentLabel(payment.metodo) }}</span>
                    <div class="flex items-center gap-3">
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

            <div class="space-y-3">
              <p class="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                Metodo de pago
              </p>
              <div class="grid grid-cols-2 gap-1.5 min-[420px]:grid-cols-3 sm:grid-cols-5">
                @for (method of paymentMethods; track method.value) {
                  <button
                    type="button"
                    (click)="paymentMethod.set(method.value)"
                    [class]="paymentMethodClass(method.value)"
                  >
                    {{ method.label }}
                  </button>
                }
              </div>

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
                  (click)="paymentAmount.set(String(cart.remainingAmount()))"
                  class="text-muted-foreground hover:border-primary hover:text-primary w-full rounded-lg border border-dashed py-2 text-xs transition-colors"
                >
                  Monto exacto: {{ money(cart.remainingAmount()) }}
                </button>
              }
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
                class="h-10 rounded-lg border px-4 text-sm font-semibold"
              >
                Cancelar
              </button>
              <button
                type="button"
                (click)="confirmSale()"
                [disabled]="!canConfirm() || isSaving()"
                class="bg-primary text-primary-foreground h-10 rounded-lg px-4 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50"
              >
                {{ isSaving() ? 'Procesando...' : 'Confirmar · ' + money(cart.totals().total) }}
              </button>
            </div>
          </div>
        </section>
      </div>
    }

    <mo-sales-history-dialog
      [open]="historyOpen()"
      [cashSessionId]="cashSession()?.id ?? null"
      (closed)="historyOpen.set(false)"
    />
  `,
})
export class PosPage {
  private readonly sessionService = inject(SessionService)
  private readonly dataService = inject(PosDataService)
  private readonly saleService = inject(PosSaleService)
  private readonly toast = inject(ToastService)

  readonly cart = inject(PosCartStore)
  readonly products = signal<PosProduct[]>([])
  readonly categories = signal<PosCategory[]>([])
  readonly cashSession = signal<OpenCashSession | null>(null)
  readonly query = signal('')
  readonly activeCategory = signal<string | null>(null)
  readonly loading = signal(true)
  readonly loadError = signal<string | null>(null)
  readonly checkoutOpen = signal(false)
  readonly paymentMethod = signal<PaymentMethod>('cash')
  readonly paymentAmount = signal('')
  readonly saleError = signal<string | null>(null)
  readonly historyOpen = signal(false)
  readonly isSaving = signal(false)
  readonly paymentMethods = PAYMENT_METHOD_OPTIONS
  readonly String = String

  readonly filteredProducts = computed(() => {
    const q = this.query().toLowerCase().trim()
    const categoryId = this.activeCategory()
    return this.products().filter((product) => {
      const matchesCategory = categoryId === null || product.categoriaId === categoryId
      if (!matchesCategory) return false
      if (!q) return true

      return (
        product.nombre.toLowerCase().includes(q) ||
        (product.sku?.toLowerCase().includes(q) ?? false) ||
        product.codigoBarras === this.query().trim()
      )
    })
  })

  readonly canConfirm = computed(() => {
    const paymentError = validatePaymentsForSale(this.cart.payments(), this.cart.totals().total)
    return (
      this.cart.items().length > 0 &&
      this.cart.totalPaid() >= this.cart.totals().total &&
      !paymentError
    )
  })

  constructor() {
    void this.load()
  }

  async load(): Promise<void> {
    this.loading.set(true)
    this.loadError.set(null)

    try {
      const auth = await this.sessionService.getAuthContext()
      if (!auth) throw new Error('No autenticado')

      const [products, categories, cashSession] = await Promise.all([
        this.dataService.listProducts(),
        this.dataService.listCategories(),
        this.dataService.getOpenCashSession(auth.tiendaId),
      ])

      this.products.set(products)
      this.categories.set(categories)
      this.cashSession.set(cashSession)
    } catch (error) {
      this.loadError.set(error instanceof Error ? error.message : 'No se pudo cargar el POS')
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

  selectProduct(product: PosProduct): void {
    this.cart.addItem(product)
  }

  openCheckout(): void {
    this.saleError.set(null)
    this.checkoutOpen.set(true)
    if (this.cart.remainingAmount() > 0) {
      this.paymentAmount.set(String(this.cart.remainingAmount()))
    }
  }

  closeCheckout(): void {
    this.checkoutOpen.set(false)
    this.cart.clearPayments()
    this.paymentAmount.set('')
    this.saleError.set(null)
  }

  setPaymentAmount(event: Event): void {
    const value = (event.target as HTMLInputElement).value.replace(/\D/g, '')
    this.paymentAmount.set(value)
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

  addPayment(): void {
    const amount = Number.parseInt(this.paymentAmount().replace(/\D/g, ''), 10)
    if (!amount || amount <= 0) return

    this.cart.addPayment({ metodo: this.paymentMethod(), amount })
    this.paymentAmount.set('')
  }

  async confirmSale(): Promise<void> {
    const cashSession = this.cashSession()
    if (!cashSession || !this.canConfirm()) return

    this.saleError.set(null)
    this.isSaving.set(true)

    try {
      await this.saleService.createSale({
        cashSessionId: cashSession.id,
        idempotencyKey: this.cart.idempotencyKey(),
        items: this.cart.items(),
        payments: this.cart.payments(),
        totals: this.cart.totals(),
        change: this.cart.change(),
      })

      const change = this.cart.change()
      this.cart.clearCart()
      this.checkoutOpen.set(false)
      this.toast.success(
        change > 0 ? `Venta completada · cambio ${formatCurrency(change)}` : 'Venta completada',
      )
    } catch (error) {
      this.saleError.set(error instanceof Error ? error.message : 'No se pudo completar la venta')
    } finally {
      this.isSaving.set(false)
    }
  }
}
