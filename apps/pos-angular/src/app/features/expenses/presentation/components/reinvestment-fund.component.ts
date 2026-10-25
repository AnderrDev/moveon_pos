import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core'
import { ButtonComponent } from '@angular-app/shared/atoms/button.component'
import {
  fundBalanceKind,
  type ReinvestmentFund,
} from '@angular-app/features/expenses/domain/services/reinvestment-fund'
import type { StockValuation } from '@angular-app/features/inventory/domain/services/stock-valuation'
import { MoneyPipe } from '@angular-app/shared/pipes/money.pipe'

/**
 * Fondo de reinversión de mercancía: cuánto del dinero recibido corresponde a
 * reposición de lo vendido y cuánto queda disponible para volver a surtir.
 * Presentacional — `fund` es `null` mientras la tienda no configure el fondo.
 */
@Component({
  selector: 'mo-reinvestment-fund',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MoneyPipe, ButtonComponent],
  template: `
    <div class="bg-card rounded-xl border p-4">
      <div class="flex items-center justify-between gap-2">
        <h3 class="text-sm font-semibold">Fondo de reinversión de mercancía</h3>
        <mo-button variant="outline" size="sm" (click)="configureRequested.emit()">
          {{ fund() ? 'Editar fondo' : 'Configurar fondo' }}
        </mo-button>
      </div>

      @if (fund(); as f) {
        <div class="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <p class="text-muted-foreground text-sm font-medium">{{ balanceTitle() }}</p>
            <p
              class="font-display mt-1.5 text-[1.75rem] leading-tight font-extrabold tabular-nums"
              [class.text-emerald-600]="balanceKind() === 'available'"
              [class.text-amber-700]="balanceKind() === 'overinvested'"
            >
              {{ (balanceAmount() | money) }}
            </p>
            <p class="text-muted-foreground mt-1 text-xs">
              {{ balanceKind() === 'overinvested' ? 'Está en mercancía sin vender, no es una deuda' : 'Acumulado, arrastra entre meses' }}
            </p>
          </div>
          <div>
            <p class="text-muted-foreground text-sm font-medium">Apartado este mes</p>
            <p class="font-display mt-1.5 text-[1.75rem] leading-tight font-extrabold tabular-nums">{{ (f.apartadoMes | money) }}</p>
            <p class="text-muted-foreground mt-1 text-xs">Costo de lo vendido en el mes</p>
          </div>
          <div>
            <p class="text-muted-foreground text-sm font-medium">Invertido este mes</p>
            <p class="font-display mt-1.5 text-[1.75rem] leading-tight font-extrabold tabular-nums">{{ (f.invertidoMes | money) }}</p>
            <p class="text-muted-foreground mt-1 text-xs">Compras de mercancía registradas</p>
          </div>
        </div>

        <dl class="mt-4 space-y-2 border-t pt-3 text-sm">
          <div class="flex items-center justify-between">
            <dt class="text-muted-foreground">Saldo inicial</dt>
            <dd class="font-semibold">{{ (f.saldoInicial | money) }}</dd>
          </div>
          <div class="flex items-center justify-between">
            <dt class="text-muted-foreground">+ Apartado por ventas (costo de lo vendido)</dt>
            <dd class="font-semibold">{{ (f.apartadoAcumulado | money) }}</dd>
          </div>
          <div class="flex items-center justify-between">
            <dt class="text-muted-foreground">− Invertido en mercancía (entradas con costo)</dt>
            <dd class="font-semibold">{{ (f.invertidoAcumulado | money) }}</dd>
          </div>
          <div class="flex items-center justify-between border-t pt-2">
            <dt class="font-semibold">= Disponible para reinvertir</dt>
            <dd
              class="font-bold"
              [class.text-emerald-600]="balanceKind() === 'available'"
              [class.text-amber-700]="balanceKind() === 'overinvested'"
            >
              {{ (f.disponible | money) }}
            </dd>
          </div>
          @if (inventory(); as inv) {
            <div class="flex items-center justify-between">
              <dt class="text-muted-foreground">Inventario hoy al costo</dt>
              <dd class="font-semibold">{{ (inv.valorAlCosto | money) }}</dd>
            </div>
          }
        </dl>

        @if (balanceKind() === 'overinvested') {
          <div class="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
            <p class="font-semibold">El saldo negativo no es una deuda.</p>
            <p class="mt-1">
              Desde que arrancó el fondo, lo que compraste en mercancía supera en
              {{ (balanceAmount() | money) }} {{ f.saldoInicial > 0 ? 'al saldo inicial más lo' : 'a lo' }}
              que has recuperado vendiéndola al costo. Esa diferencia está en tu inventario, que hoy
              vale {{ inventory() ? (inventory()!.valorAlCosto | money) : '—' }} al costo: se recupera a
              medida que se venda.
            </p>
            @if (f.saldoInicial === 0) {
              <p class="mt-1">
                Si al iniciar el fondo ya tenías dinero apartado para mercancía, regístralo como saldo
                inicial en "Editar fondo".
              </p>
            }
          </div>
        }
        @if (inventory(); as inv) {
          @if (inv.productosSinCosto > 0) {
            <p class="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
              {{ inv.productosSinCosto }}
              {{ inv.productosSinCosto === 1 ? 'producto con stock no tiene' : 'productos con stock no tienen' }}
              costo registrado: no suman al valor del inventario.
            </p>
          }
        }

        @if (f.entradasSinCosto > 0) {
          <p class="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            {{ f.entradasSinCosto }}
            {{ f.entradasSinCosto === 1 ? 'entrada de inventario' : 'entradas de inventario' }}
            sin costo desde el inicio del fondo: no descuentan del disponible. Registra el costo
            unitario al surtir para que el fondo cuadre.
          </p>
        }
        @if (f.ventasSinCosto > 0) {
          <p class="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            {{ f.ventasSinCosto }}
            {{ f.ventasSinCosto === 1 ? 'línea vendida' : 'líneas vendidas' }}
            sin costo de producto desde el inicio del fondo: no suman al apartado por ventas.
            Completa el costo del producto para que el fondo refleje toda la mercancía vendida.
          </p>
        }
        <p class="text-muted-foreground mt-3 text-xs">
          Las compras de mercancía se registran como entradas de inventario con costo — no como
          gasto (el gasto duplicaría el costo en la utilidad).
        </p>
      } @else {
        <p class="text-muted-foreground mt-3 text-sm">
          El costo de lo que vendes no es utilidad: es dinero para volver a surtir. Configura el
          fondo para saber cuánto tienes disponible para reinvertir en mercancía.
        </p>
      }
    </div>
  `,
})
export class ReinvestmentFundComponent {
  readonly fund = input.required<ReinvestmentFund | null>()
  /** Valor del inventario al costo; `null` mientras carga o si falla. */
  readonly inventory = input<StockValuation | null>(null)

  readonly balanceKind = computed(() => fundBalanceKind(this.fund()?.disponible ?? 0))
  readonly balanceTitle = computed(() =>
    this.balanceKind() === 'overinvested' ? 'Invertido en inventario de más' : 'Disponible para reinvertir',
  )
  /** En negativo se muestra el monto en positivo: lo invertido de más, no un faltante. */
  readonly balanceAmount = computed(() => Math.abs(this.fund()?.disponible ?? 0))

  readonly configureRequested = output<void>()

}
