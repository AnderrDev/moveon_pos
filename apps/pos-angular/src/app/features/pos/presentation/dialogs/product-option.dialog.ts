import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core'
import { formatCurrency } from '@/shared/lib/format'
import { DialogComponent } from '@angular-app/shared/organisms/dialog.component'
import { ButtonComponent } from '@angular-app/shared/atoms/button.component'
import type { PosProduct, PosProductOption } from '@angular-app/features/pos/presentation/services/pos.types'

export interface ProductOptionResult {
  product: PosProduct
  option: PosProductOption
}

/**
 * Selección de la opción con la que se prepara un producto (ADR 0017): para los
 * batidos, el tipo de proteína. No se abre al agregar (el producto entra con su
 * opción por defecto); se abre desde la línea del carrito cuando el cliente
 * pide otra proteína.
 */
@Component({
  selector: 'mo-product-option-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DialogComponent, ButtonComponent],
  template: `
    <mo-dialog [open]="open()" [title]="title()" width="sm" (closed)="onClose()">
      @if (product(); as p) {
        <div class="space-y-4">
          <div class="bg-muted/50 rounded-lg px-3.5 py-2.5">
            <p class="truncate text-sm font-semibold">{{ p.nombre }}</p>
            <p class="text-muted-foreground text-xs tabular-nums">
              Precio base {{ money(p.precioVenta) }}
            </p>
          </div>

          <div class="space-y-2" role="radiogroup" [attr.aria-label]="title()">
            @for (option of p.options; track option.id) {
              <button
                type="button"
                role="radio"
                [attr.aria-checked]="selectedId() === option.id"
                (click)="selectedId.set(option.id)"
                [class]="optionClass(option.id)"
              >
                <span class="min-w-0 flex-1 truncate text-left text-sm font-semibold">
                  {{ option.nombre }}
                </span>
                <span class="shrink-0 text-xs font-semibold tabular-nums">
                  @if (option.precioExtra > 0) {
                    +{{ money(option.precioExtra) }}
                  } @else {
                    Sin recargo
                  }
                </span>
              </button>
            }
          </div>

          <div class="flex items-center justify-between gap-3 border-t pt-3">
            <span class="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              Precio final
            </span>
            <span class="text-base font-bold tabular-nums">{{ money(finalPrice()) }}</span>
          </div>

          <div class="flex justify-end gap-2">
            <mo-button variant="outline" type="button" (click)="onClose()">Cancelar</mo-button>
            <mo-button type="button" [disabled]="!selected()" (click)="submit()">
              {{ confirmLabel() }}
            </mo-button>
          </div>
        </div>
      }
    </mo-dialog>
  `,
})
export class ProductOptionDialog {
  readonly open = input<boolean>(false)
  readonly product = input<PosProduct | null>(null)
  /** Opción vigente de la línea que se está editando. `null` = usar el default. */
  readonly currentOptionId = input<string | null>(null)
  readonly confirmLabel = input<string>('Cambiar')

  readonly closed = output<void>()
  readonly picked = output<ProductOptionResult>()

  readonly selectedId = signal<string>('')

  readonly title = computed(() => this.product()?.options[0]?.grupo ?? 'Elige una opción')

  readonly selected = computed<PosProductOption | null>(
    () => this.product()?.options.find((o) => o.id === this.selectedId()) ?? null,
  )

  readonly finalPrice = computed(
    () => (this.product()?.precioVenta ?? 0) + (this.selected()?.precioExtra ?? 0),
  )

  constructor() {
    // Al abrir, preselecciona la opción vigente de la línea; si no hay (alta
    // nueva), la marcada por defecto y, en su defecto, la primera.
    effect(() => {
      if (!this.open()) return
      const options = this.product()?.options ?? []
      const current = options.find((o) => o.id === this.currentOptionId())
      const preferred = current ?? options.find((o) => o.esDefault) ?? options[0]
      this.selectedId.set(preferred?.id ?? '')
    })
  }

  optionClass(optionId: string): string {
    const active = this.selectedId() === optionId
    return [
      'flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 transition-colors',
      active
        ? 'border-primary bg-primary/10 text-foreground'
        : 'border-border bg-card text-muted-foreground hover:bg-muted',
    ].join(' ')
  }

  submit(): void {
    const product = this.product()
    const option = this.selected()
    if (!product || !option) return
    this.picked.emit({ product, option })
    this.closed.emit()
  }

  onClose(): void {
    this.closed.emit()
  }

  money(value: number): string {
    return formatCurrency(value)
  }
}
