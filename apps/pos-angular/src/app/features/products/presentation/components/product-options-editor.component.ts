import { ChangeDetectionStrategy, Component, input, model, signal } from '@angular/core'
import type { Product } from '@angular-app/features/products/domain/entities/product.entity'
import type { ProductOption } from '@angular-app/features/products/domain/repositories/product.repository'
import {
  addProductOption,
  removeProductOption,
  setDefaultProductOption,
} from '@angular-app/features/products/presentation/services/product-option-list'
import { ButtonComponent } from '@angular-app/shared/atoms/button.component'

const INPUT_CLASS =
  'border-input bg-background focus:ring-ring h-10 w-full rounded-lg border px-3 text-sm outline-none focus:ring-2'
const LABEL_CLASS = 'text-muted-foreground mb-1 block text-[11px] font-semibold tracking-wide uppercase'

/**
 * Opciones de venta de un preparado (ADR 0017): el cajero elige una al vender.
 * Edita la lista en memoria (`[(options)]`, `[(grupo)]`); el diálogo la guarda
 * con `saveProductOptions` al enviar.
 */
@Component({
  selector: 'mo-product-options-editor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  imports: [ButtonComponent],
  template: `
    <section class="space-y-3 rounded-xl border p-4">
      <div>
        <h3 class="text-sm font-semibold">Opciones de venta</h3>
        <p class="text-muted-foreground mt-1 text-xs leading-relaxed">
          El cajero elige una al vender (ej. el tipo de proteína del batido). El recargo se
          suma al precio y el producto asignado se descuenta del inventario.
        </p>
      </div>

      <div>
        <label for="product-option-grupo" [class]="labelClass">Nombre del grupo</label>
        <input
          id="product-option-grupo"
          type="text"
          [value]="grupo()"
          (input)="grupo.set($any($event.target).value)"
          placeholder="Proteína"
          [class]="inputClass"
        />
      </div>

      @for (option of options(); track option.nombre) {
        <div class="border-border space-y-2 rounded-lg border px-3 py-2.5">
          <div class="flex items-center gap-3">
            <span class="min-w-0 flex-1 truncate text-sm font-medium">{{ option.nombre }}</span>
            <span class="text-muted-foreground shrink-0 text-xs tabular-nums">
              @if (option.precioExtra > 0) {
                +{{ option.precioExtra }}
              } @else {
                sin recargo
              }
            </span>
            <button
              type="button"
              (click)="remove(option.nombre)"
              class="text-muted-foreground hover:text-destructive shrink-0 transition-colors"
              aria-label="Quitar opción"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-4 w-4">
                <path d="M18 6 6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>
          <div class="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
            <label class="flex items-center gap-1.5">
              <input
                type="radio"
                name="product-option-default"
                [checked]="option.esDefault"
                (change)="options.set(setDefault(options(), option.nombre))"
              />
              Predeterminada
            </label>
            @if (option.componenteId) {
              <span>Descuenta {{ option.componenteNombre }} × {{ option.componenteCantidad }}</span>
            } @else {
              <span>Sin descuento de inventario</span>
            }
          </div>
        </div>
      } @empty {
        <p class="text-muted-foreground text-xs">Sin opciones. El producto se vende directo, sin preguntar nada.</p>
      }

      <div class="grid gap-2 pt-1 sm:grid-cols-2">
        <div>
          <label for="product-option-nombre" [class]="labelClass">Opción</label>
          <input
            id="product-option-nombre"
            type="text"
            [value]="pendingNombre()"
            (input)="pendingNombre.set($any($event.target).value)"
            placeholder="Ej. Bipro"
            [class]="inputClass"
          />
        </div>
        <div>
          <label for="product-option-extra" [class]="labelClass">Recargo (COP)</label>
          <input
            id="product-option-extra"
            type="number"
            min="0"
            step="500"
            [value]="pendingExtra()"
            (input)="pendingExtra.set(+$any($event.target).value)"
            [class]="inputClass"
          />
        </div>
        <div>
          <label for="product-option-componente" [class]="labelClass">Descuenta del inventario</label>
          <select
            id="product-option-componente"
            [value]="pendingComponentId()"
            (change)="pendingComponentId.set($any($event.target).value)"
            [class]="inputClass"
          >
            <option value="">Nada</option>
            @for (p of candidates(); track p.id) {
              <option [value]="p.id">{{ p.nombre }}</option>
            }
          </select>
        </div>
        <div class="flex items-end gap-2">
          <div class="w-24 shrink-0">
            <label for="product-option-cantidad" [class]="labelClass">Cantidad</label>
            <input
              id="product-option-cantidad"
              type="number"
              min="0"
              step="1"
              [value]="pendingQty()"
              (input)="pendingQty.set(+$any($event.target).value)"
              [class]="inputClass"
            />
          </div>
          <mo-button type="button" class="flex-1" [fullWidth]="true" [disabled]="!pendingNombre().trim()" (click)="add()">
            Agregar opción
          </mo-button>
        </div>
      </div>

      @if (error()) {
        <p class="text-destructive text-xs font-semibold">{{ error() }}</p>
      }
    </section>
  `,
})
export class ProductOptionsEditorComponent {
  readonly options = model.required<ProductOption[]>()
  readonly grupo = model.required<string>()
  readonly error = model<string | null>(null)
  readonly candidates = input.required<Product[]>()

  readonly pendingNombre = signal('')
  readonly pendingExtra = signal(0)
  readonly pendingComponentId = signal('')
  readonly pendingQty = signal(1)

  readonly inputClass = INPUT_CLASS
  readonly labelClass = LABEL_CLASS
  readonly setDefault = setDefaultProductOption

  add(): void {
    const componenteId = this.pendingComponentId() || null
    const result = addProductOption(this.options(), {
      grupo: this.grupo(),
      nombre: this.pendingNombre(),
      precioExtra: this.pendingExtra(),
      componenteId,
      componenteNombre: this.candidates().find((p) => p.id === componenteId)?.nombre ?? '',
      componenteCantidad: this.pendingQty(),
    })
    if (!result.ok) {
      this.error.set(result.error)
      return
    }
    this.options.set(result.options)
    this.error.set(null)
    this.pendingNombre.set('')
    this.pendingExtra.set(0)
    this.pendingComponentId.set('')
    this.pendingQty.set(1)
  }

  remove(nombre: string): void {
    this.options.set(removeProductOption(this.options(), nombre))
  }
}
