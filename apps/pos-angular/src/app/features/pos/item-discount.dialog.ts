import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
} from '@angular/core'
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms'
import { formatCurrency } from '@/shared/lib/format'
import { DialogComponent } from '../../shared/organisms/dialog.component'
import { ButtonComponent } from '../../shared/atoms/button.component'
import { FormCurrencyInputComponent } from '../../shared/molecules/form-currency-input.component'
import { FormNumberInputComponent } from '../../shared/molecules/form-number-input.component'
import { FormErrorComponent } from '../../shared/molecules/form-error.component'
import type { PosCartItem } from './pos-cart.store'

export interface ItemDiscountResult {
  key: string
  /** Descuento por unidad en monto COP. */
  discountAmount: number
}

@Component({
  selector: 'mo-item-discount-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    DialogComponent,
    ButtonComponent,
    FormCurrencyInputComponent,
    FormNumberInputComponent,
    FormErrorComponent,
  ],
  template: `
    <mo-dialog [open]="open()" title="Descuento por producto" width="sm" (closed)="onClose()">
      @if (item(); as i) {
        <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-4">
          <div class="bg-muted/50 rounded-lg px-3.5 py-2.5">
            <p class="truncate text-sm font-semibold">{{ i.nombre }}</p>
            <p class="text-muted-foreground text-xs tabular-nums">
              Precio unitario {{ money(i.unitPrice) }} · {{ i.quantity }} und.
            </p>
          </div>

          <div class="space-y-2">
            <div class="flex items-center justify-between gap-2">
              <span class="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                Descuento por unidad
              </span>
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

            @if (discountMode() === 'amount') {
              <mo-form-currency-input
                controlName="discountAmount"
                description="Monto en pesos descontado de cada unidad."
                [max]="i.unitPrice"
                [error]="amountError()"
              />
            } @else {
              <mo-form-number-input
                controlName="discountPercent"
                description="Porcentaje descontado de cada unidad."
                placeholder="0"
                [min]="0"
                [max]="100"
                [error]="amountError()"
              />
            }
          </div>

          <mo-form-error [message]="amountError()" />

          <div class="flex justify-end gap-2 pt-1">
            <mo-button variant="outline" type="button" (click)="onClose()">Cancelar</mo-button>
            <mo-button type="submit">Aplicar descuento</mo-button>
          </div>
        </form>
      }
    </mo-dialog>
  `,
})
export class ItemDiscountDialog {
  readonly open = input<boolean>(false)
  readonly item = input<PosCartItem | null>(null)

  readonly closed = output<void>()
  readonly applied = output<ItemDiscountResult>()

  readonly amountError = signal<string | null>(null)
  readonly discountMode = signal<'amount' | 'percent'>('amount')

  readonly form = new FormGroup({
    discountAmount: new FormControl<number>(0, {
      nonNullable: true,
      validators: [Validators.min(0)],
    }),
    discountPercent: new FormControl<number>(0, {
      nonNullable: true,
      validators: [Validators.min(0), Validators.max(100)],
    }),
  })

  readonly maxDiscount = computed(() => this.item()?.unitPrice ?? 0)

  constructor() {
    effect(() => {
      if (this.open()) {
        this.discountMode.set('amount')
        this.form.reset({ discountAmount: this.item()?.discountAmount ?? 0, discountPercent: 0 })
        this.amountError.set(null)
      }
    })
  }

  money(value: number): string {
    return formatCurrency(value)
  }

  setDiscountMode(mode: 'amount' | 'percent'): void {
    if (this.discountMode() === mode) return
    this.discountMode.set(mode)

    // Al cambiar de modo, refleja el descuento actual en el input que se va a
    // mostrar (la fuente de verdad sigue siendo el monto por unidad en pesos).
    const unitPrice = this.item()?.unitPrice ?? 0
    if (mode === 'percent') {
      const amount = this.form.controls.discountAmount.value
      const percent = unitPrice > 0 ? Math.round((amount / unitPrice) * 100) : 0
      this.form.controls.discountPercent.setValue(percent)
    } else {
      const percent = this.form.controls.discountPercent.value
      this.form.controls.discountAmount.setValue(Math.round((unitPrice * percent) / 100))
    }
    this.amountError.set(null)
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

  submit(): void {
    const item = this.item()
    if (!item) return

    const amount =
      this.discountMode() === 'percent'
        ? Math.round((item.unitPrice * this.form.controls.discountPercent.value) / 100)
        : this.form.controls.discountAmount.value
    if (amount < 0) {
      this.amountError.set('El descuento no puede ser negativo')
      return
    }
    if (amount > item.unitPrice) {
      this.amountError.set('El descuento no puede superar el precio unitario')
      return
    }

    this.amountError.set(null)
    this.applied.emit({ key: item.key, discountAmount: amount })
    this.closed.emit()
  }

  onClose(): void {
    this.closed.emit()
  }
}
