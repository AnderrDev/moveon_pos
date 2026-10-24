import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core'
import { toSignal } from '@angular/core/rxjs-interop'
import { getErrorMessage } from '@/shared/lib/error-message'
import { RegisterEntryFormPresenter } from '@angular-app/features/inventory/presentation/presenters/register-entry-form.presenter'
import { registerEntryFormMapper } from '@angular-app/features/inventory/presentation/forms/register-entry-form.mapper'
import { ReactiveFormsModule } from '@angular/forms'
import { DialogComponent } from '@angular-app/shared/organisms/dialog.component'
import { ButtonComponent } from '@angular-app/shared/atoms/button.component'
import { FormNumberInputComponent } from '@angular-app/shared/molecules/form-number-input.component'
import { FormCurrencyInputComponent } from '@angular-app/shared/molecules/form-currency-input.component'
import {
  FormSelectComponent,
  type FormSelectOption,
} from '@angular-app/shared/molecules/form-select.component'
import { FormTextareaComponent } from '@angular-app/shared/molecules/form-textarea.component'
import { FormErrorComponent } from '@angular-app/shared/molecules/form-error.component'
import { DialogFooterComponent } from '@angular-app/shared/molecules/dialog-footer.component'
import { InventoryRepository } from '@angular-app/features/inventory/domain/repositories/inventory.repository'
import { registerEntry } from '@angular-app/features/inventory/domain/usecases/register-entry.use-case'
import { SessionService } from '@angular-app/core/auth/session.service'
import { ToastService } from '@angular-app/shared/organisms/toast/toast.service'
import type { InventoryLocation } from '@/shared/types'
import type { EntryPaymentMethod } from '@angular-app/features/inventory/domain/entities/inventory.entity'
import { MoneyPipe } from '@angular-app/shared/pipes/money.pipe'

interface ProductSummary {
  id: string
  nombre: string
  /** Costo actual del producto — se precarga para que las compras alimenten el fondo de reinversión. */
  costo?: number | null
}

const PAYMENT_OPTIONS: FormSelectOption<EntryPaymentMethod | ''>[] = [
  { value: '', label: 'No registrar el pago' },
  { value: 'efectivo_caja', label: 'Efectivo de la caja' },
  { value: 'efectivo_externo', label: 'Efectivo (fuera de caja)' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'tarjeta', label: 'Tarjeta' },
]

const LOCATION_OPTIONS: FormSelectOption<InventoryLocation>[] = [
  { value: 'bodega', label: 'Bodega' },
  { value: 'punto_venta', label: 'Punto de venta' },
]

@Component({
  selector: 'mo-register-entry-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [RegisterEntryFormPresenter],
  imports: [MoneyPipe, 
    ReactiveFormsModule,
    DialogComponent,
    ButtonComponent,
    FormNumberInputComponent,
    FormCurrencyInputComponent,
    FormSelectComponent,
    FormTextareaComponent,
    FormErrorComponent,
    DialogFooterComponent,
  ],
  template: `
    <mo-dialog
      [open]="open()"
      title="Registrar entrada"
      [description]="product()?.nombre ?? null"
      [busy]="saving()"
      (closed)="onClose()"
    >
      <form [formGroup]="presenter.form" (ngSubmit)="submit()" class="space-y-4">
        <mo-form-number-input
          controlName="cantidad"
          [error]="presenter.errors().cantidad ?? null"
          label="Cantidad"
          [required]="true"
          [step]="1"
          [min]="1"
        />
        <mo-form-select
          controlName="ubicacion"
          [error]="presenter.errors().ubicacion ?? null"
          label="Ubicacion"
          [required]="true"
          [options]="locationOptions"
          [placeholder]="null"
        />
        <mo-form-currency-input
          controlName="costoUnitario"
          [error]="presenter.errors().costoUnitario ?? null"
          label="Costo de compra por unidad"
          description="Si lo registras, también será el nuevo costo vigente del producto."
        />

        @if (entryTotal() > 0) {
          <div
            class="border-primary/20 bg-primary/5 flex items-center justify-between rounded-lg border px-3.5 py-3"
          >
            <span class="text-sm font-medium">Total de la compra</span>
            <span class="text-foreground text-lg font-bold tabular-nums">{{
              (entryTotal() | money)
            }}</span>
          </div>
        }
        <mo-form-select
          controlName="metodoPago"
          [error]="presenter.errors().metodoPago ?? null"
          label="¿Cómo se pagó la compra?"
          [options]="paymentOptions"
          [placeholder]="null"
        />
        @if (paysFromCash()) {
          <p class="text-muted-foreground -mt-2 text-xs">
            Se registrará una salida de la caja abierta por
            <span class="text-foreground font-semibold">{{ (entryTotal() | money) }}</span>.
            No cuenta como gasto: el costo entra a la utilidad cuando se vende.
          </p>
        }
        <mo-form-textarea controlName="motivo"
          [error]="presenter.errors().motivo ?? null" label="Motivo (opcional)" [rows]="2" />

        <mo-form-error [message]="presenter.errors().root ?? null" />

        <mo-dialog-footer>
          <mo-button variant="outline" type="button" [disabled]="saving()" (click)="onClose()"
            >Cancelar</mo-button
          >
          <mo-button type="submit" [loading]="saving()" loadingText="Guardando..."
            >Registrar entrada</mo-button
          >
        </mo-dialog-footer>
      </form>
    </mo-dialog>
  `,
})
export class RegisterEntryDialog {
  private readonly repo = inject(InventoryRepository)
  private readonly session = inject(SessionService)
  private readonly toast = inject(ToastService)
  readonly presenter = inject(RegisterEntryFormPresenter)

  readonly open = input<boolean>(false)
  readonly product = input<ProductSummary | null>(null)

  readonly closed = output<void>()
  readonly saved = output<void>()

  readonly saving = signal(false)
  readonly locationOptions = LOCATION_OPTIONS
  readonly paymentOptions = PAYMENT_OPTIONS

  private readonly formValue = toSignal(this.presenter.form.valueChanges, {
    initialValue: this.presenter.form.getRawValue(),
  })

  readonly entryTotal = computed(
    () => Number(this.formValue().cantidad ?? 0) * Number(this.formValue().costoUnitario ?? 0)
  )

  readonly paysFromCash = computed(() => this.formValue().metodoPago === 'efectivo_caja')

  constructor() {
    effect(() => {
      if (this.open()) {
        this.presenter.reset(registerEntryFormMapper.toFormValue(this.product()))
      }
    })
  }

  async submit(): Promise<void> {
    if (this.saving()) return
    const value = this.presenter.validate()
    if (!value) return

    const product = this.product()
    if (!product) return

    const auth = await this.session.getAuthContext()
    if (!auth) {
      this.presenter.setRootError('Sesion expirada')
      return
    }

    this.saving.set(true)
    this.presenter.form.disable({ emitEvent: false })

    try {
      const result = await registerEntry(
        { repo: this.repo, tiendaId: auth.tiendaId, createdBy: auth.userId },
        registerEntryFormMapper.toPayload(value, product.id),
      )
      if (!result.ok) {
        this.presenter.setRootError(result.error.message)
        return
      }
      this.toast.success(
        value.metodoPago === 'efectivo_caja'
          ? `Entrada registrada y salida de caja creada (${product.nombre})`
          : value.costoUnitario > 0
            ? `Entrada registrada y costo de ${product.nombre} actualizado`
            : `Entrada registrada (+${value.cantidad} ${product.nombre})`
      )
      this.saved.emit()
      this.closed.emit()
    } catch (error) {
      this.presenter.setRootError(getErrorMessage(error, 'Error al registrar entrada'))
    } finally {
      this.saving.set(false)
      this.presenter.form.enable({ emitEvent: false })
    }
  }

  onClose(): void {
    if (this.saving()) return
    this.closed.emit()
  }

}
