import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  output,
} from '@angular/core'
import { toSignal } from '@angular/core/rxjs-interop'
import { ReactiveFormsModule } from '@angular/forms'
import { DialogComponent } from '@angular-app/shared/organisms/dialog.component'
import { ButtonComponent } from '@angular-app/shared/atoms/button.component'
import { FormCurrencyInputComponent } from '@angular-app/shared/molecules/form-currency-input.component'
import { FormNumberInputComponent } from '@angular-app/shared/molecules/form-number-input.component'
import type { PosCartItem } from '@angular-app/features/pos/presentation/services/pos-cart.store'
import { MoneyPipe } from '@angular-app/shared/pipes/money.pipe'
import { ItemDiscountFormPresenter } from '@angular-app/features/pos/presentation/presenters/item-discount-form.presenter'
import { itemDiscountFormMapper } from '@angular-app/features/pos/presentation/forms/item-discount-form.mapper'
import type { DiscountMode } from '@angular-app/features/pos/presentation/forms/item-discount-form.factory'

export interface ItemDiscountResult {
  key: string
  /** Descuento por unidad en monto COP. */
  discountAmount: number
}

@Component({
  selector: 'mo-item-discount-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ItemDiscountFormPresenter],
  imports: [
    MoneyPipe,
    ReactiveFormsModule,
    DialogComponent,
    ButtonComponent,
    FormCurrencyInputComponent,
    FormNumberInputComponent,
  ],
  template: `
    <mo-dialog [open]="open()" title="Descuento por producto" width="sm" (closed)="onClose()">
      @if (item(); as i) {
        <form [formGroup]="presenter.form" (ngSubmit)="submit()" class="space-y-4">
          <div class="bg-muted/50 rounded-lg px-3.5 py-2.5">
            <p class="truncate text-sm font-semibold">{{ i.nombre }}</p>
            <p class="text-muted-foreground text-xs tabular-nums">
              Precio unitario {{ (i.unitPrice | money) }} · {{ i.quantity }} und.
            </p>
          </div>

          <div class="space-y-2">
            <div class="flex items-center justify-between gap-2">
              <span class="text-muted-foreground text-xs font-semibold">
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
                [error]="presenter.errors().discountAmount ?? null"
              />
            } @else {
              <mo-form-number-input
                controlName="discountPercent"
                description="Porcentaje descontado de cada unidad."
                placeholder="0"
                [min]="0"
                [max]="100"
                [error]="presenter.errors().discountPercent ?? null"
              />
            }
          </div>

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

  readonly presenter = inject(ItemDiscountFormPresenter)
  readonly discountMode = toSignal(this.presenter.form.controls.discountMode.valueChanges, {
    initialValue: this.presenter.form.controls.discountMode.value,
  })

  constructor() {
    effect(() => {
      if (this.open()) this.presenter.reset(itemDiscountFormMapper.toFormValue(this.item()))
    })
  }

  setDiscountMode(mode: DiscountMode): void {
    const unitPrice = this.item()?.unitPrice ?? 0
    this.presenter.form.setValue(
      itemDiscountFormMapper.switchMode(this.presenter.form.getRawValue(), mode, unitPrice),
    )
    this.presenter.clearErrors()
  }

  discountModeClass(mode: DiscountMode): string {
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
    const value = this.presenter.validate(item.unitPrice)
    if (!value) return
    this.applied.emit({ key: item.key, discountAmount: itemDiscountFormMapper.toDiscountAmount(value, item.unitPrice) })
    this.closed.emit()
  }

  onClose(): void {
    this.closed.emit()
  }
}
