import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core'
import { Router } from '@angular/router'
import { getErrorMessage } from '@/shared/lib/error-message'
import { formatCurrency } from '@/shared/lib/format'
import { preferredOption } from '@angular-app/features/pos/presentation/services/pos-catalog'
import { PosCatalogComponent } from '@angular-app/features/pos/presentation/components/pos-catalog.component'
import { PosCartPanelComponent } from '@angular-app/features/pos/presentation/components/pos-cart-panel.component'
import { PosCheckoutDialogComponent } from '@angular-app/features/pos/presentation/components/pos-checkout-dialog.component'
import { PosCheckoutStore } from '@angular-app/features/pos/presentation/services/pos-checkout.store'
import { SessionService } from '@angular-app/core/auth/session.service'
import { TiendaInfoService } from '@angular-app/core/tienda/tienda-info.service'
import { ToastService } from '@angular-app/shared/organisms/toast/toast.service'
import { ButtonComponent } from '@angular-app/shared/atoms/button.component'
import { PosCartStore } from '@angular-app/features/pos/presentation/services/pos-cart.store'
import { PosDataService } from '@angular-app/features/pos/presentation/services/pos-data.service'
import { PosSaleService } from '@angular-app/features/pos/presentation/services/pos-sale.service'
import {
  clearPendingSale,
  pendingSaleMessage,
  readPendingSale,
  savePendingSale,
} from '@angular-app/features/pos/presentation/services/pending-sale'
import { SaleRepository } from '@angular-app/features/sales/domain/repositories/sale.repository'
import { ReceiptPrintService } from '@angular-app/core/printing/receipt-print.service'
import { SalesHistoryDialog } from '@angular-app/features/pos/presentation/dialogs/sales-history.dialog'
import { CustomerPickerDialog } from '@angular-app/features/pos/presentation/dialogs/customer-picker.dialog'
import { ClienteFormDialog } from '@angular-app/features/customers/presentation/dialogs/cliente-form.dialog'
import {
  LoyaltyRepository,
  type LoyaltySummary,
} from '@angular-app/features/loyalty/domain/repositories/loyalty.repository'
import { DEFAULT_LOYALTY_CONFIG } from '@angular-app/features/loyalty/domain/loyalty-config'
import { countEligibleStampUnits } from '@angular-app/features/loyalty/domain/services/stamps'
import { ItemDiscountDialog, type ItemDiscountResult } from '@angular-app/features/pos/presentation/dialogs/item-discount.dialog'
import { ProductOptionDialog, type ProductOptionResult } from '@angular-app/features/pos/presentation/dialogs/product-option.dialog'
import { ProductInfoDialog } from '@angular-app/features/pos/presentation/dialogs/product-info.dialog'
import {
  ReceiptOutputStatusDialog,
  type ReceiptOutputKind,
  type ReceiptOutputStatus,
} from '@angular-app/features/pos/presentation/dialogs/receipt-output-status.dialog'
import type { PosCartItem } from '@angular-app/features/pos/presentation/services/pos-cart.store'
import type { OpenCashSession, PosCategory, PosProduct } from '@angular-app/features/pos/presentation/services/pos.types'
import type { Cliente } from '@angular-app/features/customers/domain/entities/cliente.entity'
import { MoneyPipe } from '@angular-app/shared/pipes/money.pipe'

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
  providers: [PosCartStore, PosCheckoutStore],
  imports: [MoneyPipe, 
    PosCheckoutDialogComponent,
    PosCartPanelComponent,
    PosCatalogComponent,
    SalesHistoryDialog,
    CustomerPickerDialog,
    ClienteFormDialog,
    ItemDiscountDialog,
    ProductOptionDialog,
    ProductInfoDialog,
    ReceiptOutputStatusDialog,
    ButtonComponent,
  ],
  template: `
    <section class="flex h-full min-h-0 flex-col">
      <header class="mb-4 flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div class="min-w-0">
          <h1 class="font-display text-2xl font-extrabold">Punto de Venta</h1>
          <p class="text-muted-foreground mt-0.5 flex items-center gap-2 text-sm">
            <span
              [class]="cashSession() ? 'h-2 w-2 rounded-full bg-emerald-500' : 'bg-destructive h-2 w-2 rounded-full'"
              aria-hidden="true"
            ></span>
            @if (cashSession()) {
              Caja abierta, base {{ (cashSession()!.openingAmount | money) }}
            } @else {
              Caja cerrada: ábrela para poder cobrar
            }
          </p>
        </div>
        <div class="flex shrink-0 items-center gap-2">
          @if (cashSession()) {
            <mo-button size="sm" variant="outline" (click)="historyOpen.set(true)">
              Ventas del turno
            </mo-button>
          } @else {
            <mo-button size="sm" (click)="goToCaja()">Abrir caja</mo-button>
          }
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
        <div class="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden lg:flex-row lg:gap-5">
          <mo-pos-catalog
            [products]="products()"
            [categories]="categories()"
            (add)="selectProduct($event)"
            (info)="openProductInfo($event)"
          />

          <mo-pos-cart-panel
            [loyaltySummary]="loyaltySummary()"
            [loyaltyLoading]="loyaltyLoading()"
            [stampsPreview]="cartStampsPreview()"
            [loyaltyProgressPercent]="loyaltyProgressPercent()"
            [stampsPerReward]="stampsPerReward()"
            [canCheckout]="cashSession() !== null"
            (pickCustomer)="customerPickerOpen.set(true)"
            (clearCustomer)="clearCliente()"
            (redeemReward)="redeemLoyaltyReward()"
            (editOption)="openItemOption($event)"
            (editDiscount)="openItemDiscount($event)"
            (checkout)="openCheckout()"
          />
        </div>
      }
    </section>

    @if (checkout.isOpen()) {
      <mo-pos-checkout-dialog
        [openingCashDrawer]="openingCashDrawer()"
        (closed)="closeCheckout()"
        (confirm)="confirmSale()"
        (pickCustomer)="customerPickerOpen.set(true)"
        (openCashDrawer)="openCashDrawerManually()"
      />
    }

    <mo-sales-history-dialog
      [open]="historyOpen()"
      [cashSessionId]="cashSession()?.id ?? null"
      [cashSessionIsOpen]="cashSession() !== null"
      (closed)="historyOpen.set(false)"
      (changed)="onSalesHistoryChanged()"
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

    <mo-product-option-dialog
      [open]="optionItem() !== null"
      [product]="optionProduct()"
      [currentOptionId]="optionItem()?.option?.id ?? null"
      (closed)="optionItem.set(null)"
      (picked)="onProductOptionPicked($event)"
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
  private readonly saleRepo = inject(SaleRepository)
  private readonly loyaltyRepo = inject(LoyaltyRepository)
  private readonly receiptPrint = inject(ReceiptPrintService)
  private readonly toast = inject(ToastService)
  private readonly router = inject(Router)

  readonly cart = inject(PosCartStore)
  readonly checkout = inject(PosCheckoutStore)
  readonly products = signal<PosProduct[]>([])
  readonly imprimirAlFinalizarVenta = signal(false)
  readonly abrirCajonEnEfectivo = signal(true)
  readonly categories = signal<PosCategory[]>([])
  readonly cashSession = signal<OpenCashSession | null>(null)
  readonly loading = signal(true)
  readonly loadError = signal<string | null>(null)
  readonly historyOpen = signal(false)
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
  /** Línea del carrito a la que se le está cambiando la opción (ej. proteína). */
  readonly optionItem = signal<PosCartItem | null>(null)

  /** Producto de la línea en edición: de ahí salen las opciones y el precio base. */
  readonly optionProduct = computed<PosProduct | null>(() => {
    const item = this.optionItem()
    if (!item) return null
    return this.products().find((p) => p.id === item.productId) ?? null
  })
  readonly productInfo = signal<PosProduct | null>(null)
  readonly isAdmin = this.sessionService.isAdmin

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
        hasRedemption: redemption?.itemKey === item.key,
      })),
    )
  })

  readonly loyaltyProgressPercent = computed(() => {
    const summary = this.loyaltySummary()
    if (!summary) return 0
    return Math.min(100, Math.round((summary.stampsBalance / this.stampsPerReward()) * 100))
  })

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
      this.imprimirAlFinalizarVenta.set(tienda.receipt.imprimirAlFinalizarVenta)
      this.abrirCajonEnEfectivo.set(tienda.receipt.abrirCajonEnEfectivo)
      this.stampsPerReward.set(tienda.fidelizacion.sellosParaRecompensa)
      void this.recoverPendingSale(auth.tiendaId)
    } catch (error) {
      this.loadError.set(getErrorMessage(error, 'No se pudo cargar el POS'))
    } finally {
      this.loading.set(false)
    }
  }

  /**
   * Refresca productos/stock del grid sin bloquear la UI (sin tocar
   * `loading`). El stock viene fresco de `getStockLevels`; los datos de
   * producto pueden venir del caché TTL, que aquí no importa.
   */
  async refreshProducts(): Promise<void> {
    try {
      const auth = await this.sessionService.getAuthContext()
      if (!auth) return
      this.products.set(await this.dataService.listProducts(auth.tiendaId))
    } catch {
      // Silencioso: el grid conserva el último stock conocido y el próximo
      // load() completo (re-navegación) lo corrige.
    }
  }

  /** Anular o corregir una venta desde el historial cambia el stock. */
  onSalesHistoryChanged(): void {
    void this.refreshProducts()
  }


  selectProduct(product: PosProduct): void {
    // Vender es un toque: el producto entra con su opción por defecto (CH+ en
    // los batidos). Cambiarla es la excepción y se hace desde el carrito.
    const preferred = preferredOption(product)
    this.cart.addItem(
      product,
      preferred
        ? { id: preferred.id, nombre: preferred.nombre, precioExtra: preferred.precioExtra }
        : null,
    )
  }

  /** Abre el selector de opción para una línea ya agregada. */
  openItemOption(item: PosCartItem): void {
    const product = this.products().find((p) => p.id === item.productId)
    if (!product || product.options.length === 0) return
    this.optionItem.set(item)
  }

  onProductOptionPicked(result: ProductOptionResult): void {
    const item = this.optionItem()
    if (!item) return
    this.cart.updateOption(
      item.key,
      {
        id: result.option.id,
        nombre: result.option.nombre,
        precioExtra: result.option.precioExtra,
      },
      result.product.precioVenta,
    )
    this.optionItem.set(null)
  }

  openProductInfo(product: PosProduct): void {
    this.productInfo.set(product)
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

  openCheckout(): void {
    this.checkout.open(this.imprimirAlFinalizarVenta())
  }

  closeCheckout(): void {
    this.checkout.close()
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
    if (!cashSession || !this.checkout.canConfirm()) return

    this.checkout.saleError.set(null)
    this.checkout.isSaving.set(true)

    try {
      const auth = await this.sessionService.getAuthContext()
      if (auth) {
        savePendingSale(this.storage(), {
          idempotencyKey: this.cart.idempotencyKey(),
          tiendaId: auth.tiendaId,
          total: this.cart.totals().total,
          startedAt: new Date().toISOString(),
        })
      }

      const redemption = this.cart.loyaltyRedemption()
      const result = await this.saleService.createSale({
        cashSessionId: cashSession.id,
        idempotencyKey: this.cart.idempotencyKey(),
        clienteId: this.cart.clienteId(),
        items: this.cart.items(),
        payments: this.cart.payments(),
        totals: this.cart.totals(),
        globalDiscountTotal: this.cart.effectiveGlobalDiscount(),
        // Solo el descuento discrecional exige motivo; el canje lleva motivo
        // reservado automático en el RPC (ADR 0013 §5).
        discountReason: this.checkout.discretionaryDiscountTotal() > 0 ? this.checkout.discountReason().trim() : null,
        change: this.cart.change(),
        loyaltyRedemptions: redemption
          ? [{ rewardId: redemption.rewardId, itemKey: redemption.itemKey }]
          : [],
      })

      // La venta en curso solo se descarta al confirmarse: una caída de red
      // también llega como error (postgrest no lanza) y no se distingue de un
      // rechazo, así que ante cualquier error se conserva y, si el cajero
      // recarga, recoverPendingSale consulta por la clave si se registró.
      if (!result.ok) {
        this.checkout.saleError.set(
          result.error.kind === 'unauthenticated' ? 'Sesion expirada' : result.error.message
        )
        return
      }

      const change = this.cart.change()
      const saleId = result.value.saleId
      const shouldPrintReceipt = this.checkout.imprimirEstaVenta()
      const shouldOpenCashDrawer =
        this.abrirCajonEnEfectivo() &&
        this.cart.payments().some((payment) => payment.metodo === 'cash' && payment.amount > 0)
      clearPendingSale(this.storage())
      this.cart.clearCart()
      this.loyaltySummary.set(null)
      this.checkout.resetAfterSale()
      void this.refreshProducts()

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
      this.checkout.saleError.set(getErrorMessage(error, 'No se pudo completar la venta'))
    } finally {
      this.checkout.isSaving.set(false)
    }
  }

  /**
   * Si se recargó o cayó la red mientras se cobraba, avisa si esa venta sí
   * alcanzó a registrarse para que no se cobre dos veces. Si no se puede
   * consultar (sin red), la venta en curso se conserva para la próxima carga.
   */
  private async recoverPendingSale(tiendaId: string): Promise<void> {
    const pending = readPendingSale(this.storage(), tiendaId)
    if (!pending) return
    try {
      const sale = await this.saleRepo.findByIdempotencyKey(pending.idempotencyKey, tiendaId)
      clearPendingSale(this.storage())
      const message = pendingSaleMessage(
        sale
          ? { kind: 'registered', saleNumber: sale.saleNumber, total: sale.total }
          : { kind: 'not_registered', total: pending.total },
        formatCurrency,
      )
      this.toast.show({
        message,
        title: sale ? 'Venta registrada' : 'Venta sin registrar',
        variant: sale ? 'info' : 'warning',
        durationMs: 15000,
      })
    } catch {
      // Sin conexión: se reintenta en la próxima carga del POS.
    }
  }

  private storage(): Storage | null {
    try {
      return typeof sessionStorage === 'undefined' ? null : sessionStorage
    } catch {
      return null
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
