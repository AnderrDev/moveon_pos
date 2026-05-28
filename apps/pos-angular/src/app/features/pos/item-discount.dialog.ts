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
import { DialogComponent } from '../../shared/ui/dialog.component'
import { ButtonComponent } from '../../shared/ui/button.component'
import { FormCurrencyInputComponent } from '../../shared/forms/form-currency-input.component'
import { FormErrorComponent } from '../../shared/forms/form-error.component'
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

          <mo-form-currency-input
            controlName="discountAmount"
            label="Descuento por unidad"
            description="Monto en pesos descontado de cada unidad."
            [max]="i.unitPrice"
            [error]="amountError()"
          />

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

  readonly form = new FormGroup({
    discountAmount: new FormControl<number>(0, {
      nonNullable: true,
      validators: [Validators.min(0)],
    }),
  })

  readonly maxDiscount = computed(() => this.item()?.unitPrice ?? 0)

  constructor() {
    effect(() => {
      if (this.open()) {
        this.form.reset({ discountAmount: this.item()?.discountAmount ?? 0 })
        this.amountError.set(null)
      }
    })
  }

  money(value: number): string {
    return formatCurrency(value)
  }

  submit(): void {
    const item = this.item()
    if (!item) return

    const amount = this.form.getRawValue().discountAmount
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
