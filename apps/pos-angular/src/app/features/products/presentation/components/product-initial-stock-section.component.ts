import { ChangeDetectionStrategy, Component, input } from '@angular/core'
import { FormNumberInputComponent } from '@angular-app/shared/molecules/form-number-input.component'
import { FormSelectComponent, type FormSelectOption } from '@angular-app/shared/molecules/form-select.component'
import type { InventoryLocation } from '@/shared/types'

const LOCATION_OPTIONS: FormSelectOption<InventoryLocation>[] = [
  { value: 'bodega', label: 'Bodega' },
  { value: 'punto_venta', label: 'Punto de venta' },
]

/**
 * Sección "Inventario inicial" del formulario de producto (solo al crear). Sus
 * campos se enlazan al FormGroup del diálogo padre (`stockInicial`,
 * `stockInicialUbicacion`); preparados y combos no llevan stock propio.
 */
@Component({
  selector: 'mo-product-initial-stock-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  imports: [FormNumberInputComponent, FormSelectComponent],
  template: `
    <section class="border-primary/20 bg-primary/[0.035] rounded-xl border p-4">
      <div>
        <h3 class="text-sm font-semibold">Inventario inicial</h3>
        <p class="text-muted-foreground mt-1 text-xs leading-relaxed">
          Opcional. Se registrará como una entrada de inventario auditada junto con el producto.
        </p>
      </div>

      @if (withoutOwnStock()) {
        <div class="border-border bg-card text-muted-foreground mt-4 rounded-lg border px-3.5 py-3 text-xs">
          @if (isCombo()) {
            Los combos no controlan stock propio. Agrega abajo los productos incluidos.
          } @else {
            Los productos preparados no controlan stock propio. Asigna componentes consumibles abajo.
          }
        </div>
      } @else {
        <div class="mt-4 grid gap-x-4 gap-y-5 sm:grid-cols-2">
          <mo-form-number-input
            controlName="stockInicial"
            label="Cantidad inicial"
            [min]="0"
            [step]="1"
            description="Déjalo en 0 si registrarás la entrada después."
            [error]="quantityError()"
          />
          <mo-form-select
            controlName="stockInicialUbicacion"
            label="Ubicación inicial"
            [placeholder]="null"
            [options]="locationOptions"
            [error]="locationError()"
          />
        </div>
        @if (quantity() > 0) {
          <p class="text-muted-foreground mt-3 text-[11px] leading-relaxed">
            El costo unitario de la entrada será el costo registrado para el producto.
          </p>
        }
      }
    </section>
  `,
})
export class ProductInitialStockSectionComponent {
  /** Preparado o combo: no se ofrece stock inicial. */
  readonly withoutOwnStock = input(false)
  readonly isCombo = input(false)
  readonly quantity = input(0)
  readonly quantityError = input<string | null>(null)
  readonly locationError = input<string | null>(null)

  readonly locationOptions = LOCATION_OPTIONS
}
