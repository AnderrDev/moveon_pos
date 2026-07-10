import { ChangeDetectionStrategy, Component, input, output } from '@angular/core'
import { formatCurrency } from '@/shared/lib/format'
import { ButtonComponent } from '../../shared/ui/button.component'
import type { ReinvestmentFund } from '@/modules/expenses/domain/services/reinvestment-fund'

/**
 * Fondo de reinversión de mercancía: cuánto del dinero recibido corresponde a
 * reposición de lo vendido y cuánto queda disponible para volver a surtir.
 * Presentacional — `fund` es `null` mientras la tienda no configure el fondo.
 */
@Component({
  selector: 'mo-reinvestment-fund',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent],
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
            <p class="text-muted-foreground text-xs tracking-wide uppercase">
              Disponible para reinvertir
            </p>
            <p
              class="mt-1 text-2xl font-bold"
              [class.text-emerald-600]="f.disponible > 0"
              [class.text-destructive]="f.disponible < 0"
            >
              {{ money(f.disponible) }}
            </p>
            <p class="text-muted-foreground mt-1 text-xs">Acumulado, arrastra entre meses</p>
          </div>
          <div>
            <p class="text-muted-foreground text-xs tracking-wide uppercase">Apartado este mes</p>
            <p class="mt-1 text-2xl font-bold">{{ money(f.apartadoMes) }}</p>
            <p class="text-muted-foreground mt-1 text-xs">Costo de lo vendido en el mes</p>
          </div>
          <div>
            <p class="text-muted-foreground text-xs tracking-wide uppercase">Invertido este mes</p>
            <p class="mt-1 text-2xl font-bold">{{ money(f.invertidoMes) }}</p>
            <p class="text-muted-foreground mt-1 text-xs">Compras de mercancía registradas</p>
          </div>
        </div>

        <dl class="mt-4 space-y-2 border-t pt-3 text-sm">
          <div class="flex items-center justify-between">
            <dt class="text-muted-foreground">Saldo inicial</dt>
            <dd class="font-semibold">{{ money(f.saldoInicial) }}</dd>
          </div>
          <div class="flex items-center justify-between">
            <dt class="text-muted-foreground">+ Apartado por ventas (costo de lo vendido)</dt>
            <dd class="font-semibold">{{ money(f.apartadoAcumulado) }}</dd>
          </div>
          <div class="flex items-center justify-between">
            <dt class="text-muted-foreground">− Invertido en mercancía (entradas con costo)</dt>
            <dd class="font-semibold">{{ money(f.invertidoAcumulado) }}</dd>
          </div>
          <div class="flex items-center justify-between border-t pt-2">
            <dt class="font-semibold">= Disponible para reinvertir</dt>
            <dd
              class="font-bold"
              [class.text-emerald-600]="f.disponible > 0"
              [class.text-destructive]="f.disponible < 0"
            >
              {{ money(f.disponible) }}
            </dd>
          </div>
        </dl>

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

  readonly configureRequested = output<void>()

  money(v: number): string {
    return formatCurrency(v)
  }
}
