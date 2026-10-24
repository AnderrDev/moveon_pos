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
import { ReactiveFormsModule } from '@angular/forms'
import { getErrorMessage } from '@/shared/lib/error-message'
import { formatCurrency } from '@/shared/lib/format'
import { ButtonComponent } from '@angular-app/shared/atoms/button.component'
import { FormCheckboxComponent } from '@angular-app/shared/molecules/form-checkbox.component'
import { FormCurrencyInputComponent } from '@angular-app/shared/molecules/form-currency-input.component'
import { FormErrorComponent } from '@angular-app/shared/molecules/form-error.component'
import { FormTextareaComponent } from '@angular-app/shared/molecules/form-textarea.component'
import { DialogFooterComponent } from '@angular-app/shared/molecules/dialog-footer.component'
import { DialogComponent } from '@angular-app/shared/organisms/dialog.component'
import { ToastService } from '@angular-app/shared/organisms/toast/toast.service'
import { SessionService } from '@angular-app/core/auth/session.service'
import { INVENTORY_COST_CORRECTION_REASON_MIN_LENGTH } from '@angular-app/features/inventory/domain/dtos/inventory.dto'
import type { InventoryMovement } from '@angular-app/features/inventory/domain/entities/inventory.entity'
import { InventoryRepository } from '@angular-app/features/inventory/domain/repositories/inventory.repository'
import { correctEntryCost } from '@angular-app/features/inventory/domain/usecases/correct-entry-cost.use-case'
import { entryCostCorrectionFormMapper } from '@angular-app/features/inventory/presentation/forms/entry-cost-correction-form.mapper'
import { EntryCostCorrectionFormPresenter } from '@angular-app/features/inventory/presentation/presenters/entry-cost-correction-form.presenter'
import { MoneyPipe } from '@angular-app/shared/pipes/money.pipe'

interface ProductSummary {
  id: string
  nombre: string
  costo: number | null
}

@Component({
  selector: 'mo-correct-entry-cost-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [EntryCostCorrectionFormPresenter],
  imports: [MoneyPipe, 
    ReactiveFormsModule,
    ButtonComponent,
    FormCheckboxComponent,
    FormCurrencyInputComponent,
    FormErrorComponent,
    FormTextareaComponent,
    DialogFooterComponent,
    DialogComponent,
  ],
  template: `
    <mo-dialog
      [open]="open()"
      title="Corregir costo de entrada"
      description="La cantidad y la ubicación no cambiarán. El valor anterior y el nuevo quedarán auditados."
      [busy]="saving()"
      (closed)="onClose()"
    >
      @if (movement(); as movement) {
        <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-4">
          <div class="bg-muted/50 grid grid-cols-2 gap-3 rounded-lg px-3.5 py-3">
            <div class="col-span-2 flex items-center justify-between border-b pb-2 text-sm">
              <span class="font-semibold">{{ product()?.nombre }}</span>
              <span class="text-muted-foreground">
                Costo vigente: {{ moneyOrDash(product()?.costo ?? null) }}
              </span>
            </div>
            <div>
              <p class="text-muted-foreground text-xs">Entrada registrada</p>
              <p class="font-semibold">{{ movement.cantidad }} unidades</p>
            </div>
            <div class="text-right">
              <p class="text-muted-foreground text-xs">Costo anterior</p>
              <p class="font-semibold">{{ moneyOrDash(movement.costoUnitario) }}</p>
            </div>
            <div class="col-span-2 flex items-center justify-between border-t pt-2 text-sm">
              <span class="text-muted-foreground">Total anterior</span>
              <span class="font-semibold">{{ moneyOrDash(oldTotal()) }}</span>
            </div>
          </div>

          <mo-form-currency-input
            controlName="newCost"
            label="Nuevo costo por unidad"
            [required]="true"
            [error]="presenter.errors().newCost ?? null"
          />

          <div
            class="border-primary/20 bg-primary/5 flex items-center justify-between rounded-lg border px-3.5 py-3"
          >
            <span class="text-sm font-medium">Nuevo total de la compra</span>
            <span class="text-foreground text-lg font-bold tabular-nums">{{ (newTotal() | money) }}</span>
          </div>

          <mo-form-checkbox
            controlName="updateProductCost"
            label="Actualizar también el costo vigente del producto"
            description="Las ventas futuras usarán este costo. Para una entrada antigua, desmárcalo si hubo compras posteriores."
          />

          @if (!isLatestEntry()) {
            <p class="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Esta no es la entrada más reciente. Revisa antes de cambiar el costo vigente del
              producto.
            </p>
          }

          <mo-form-textarea
            controlName="reason"
            label="Motivo de la corrección"
            [required]="true"
            [rows]="3"
            placeholder="Ej. El costo de la factura se digitó incorrectamente"
            [description]="reasonHint"
            [error]="presenter.errors().reason ?? null"
          />

          <mo-form-error [message]="presenter.errors().root ?? null" />

          <mo-dialog-footer>
            <mo-button variant="outline" type="button" [disabled]="saving()" (click)="onClose()">
              Cancelar
            </mo-button>
            <mo-button type="submit" [loading]="saving()" loadingText="Guardando...">
              Guardar corrección
            </mo-button>
          </mo-dialog-footer>
        </form>
      }
    </mo-dialog>
  `,
})
export class CorrectEntryCostDialog {
  private readonly repo = inject(InventoryRepository)
  private readonly session = inject(SessionService)
  private readonly toast = inject(ToastService)

  readonly presenter = inject(EntryCostCorrectionFormPresenter)
  readonly form = this.presenter.form

  readonly open = input<boolean>(false)
  readonly movement = input<InventoryMovement | null>(null)
  readonly product = input<ProductSummary | null>(null)
  readonly isLatestEntry = input<boolean>(false)

  readonly closed = output<void>()
  readonly saved = output<void>()

  readonly saving = signal(false)
  readonly reasonHint = `Mínimo ${INVENTORY_COST_CORRECTION_REASON_MIN_LENGTH} caracteres.`

  private readonly formValue = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  })

  readonly oldTotal = computed(() => {
    const movement = this.movement()
    return movement?.costoUnitario == null ? null : movement.cantidad * movement.costoUnitario
  })

  readonly newTotal = computed(() => {
    const movement = this.movement()
    return (movement?.cantidad ?? 0) * Number(this.formValue().newCost ?? 0)
  })

  constructor() {
    effect(() => {
      if (!this.open()) return
      const movement = this.movement()
      if (!movement) return
      this.presenter.reset(
        entryCostCorrectionFormMapper.toFormValue(movement, this.isLatestEntry())
      )
    })
  }

  async submit(): Promise<void> {
    if (this.saving()) return
    const movement = this.movement()
    if (!movement) return

    const value = this.presenter.validate()
    if (!value) return

    const auth = await this.session.getAuthContext()
    if (!auth) {
      this.presenter.setRootError('Sesión expirada')
      return
    }

    this.saving.set(true)
    this.form.disable({ emitEvent: false })
    try {
      const result = await correctEntryCost(
        { repo: this.repo, tiendaId: auth.tiendaId, correctedBy: auth.userId },
        entryCostCorrectionFormMapper.toPayload(value, movement.id)
      )
      if (!result.ok) {
        this.presenter.setRootError(result.error.message)
        return
      }
      this.toast.success(
        value.updateProductCost
          ? 'Costo de entrada y costo del producto actualizados'
          : 'Costo de entrada corregido'
      )
      this.saved.emit()
      this.closed.emit()
    } catch (error) {
      this.presenter.setRootError(getErrorMessage(error, 'No se pudo corregir el costo'))
    } finally {
      this.saving.set(false)
      this.form.enable({ emitEvent: false })
    }
  }

  onClose(): void {
    if (this.saving()) return
    this.closed.emit()
  }


  moneyOrDash(value: number | null): string {
    return value == null ? '—' : formatCurrency(value)
  }
}
