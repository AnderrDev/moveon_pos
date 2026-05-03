import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core'
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms'
import { DialogComponent } from '../../shared/ui/dialog.component'
import { ButtonComponent } from '../../shared/ui/button.component'
import { FormNumberInputComponent } from '../../shared/forms/form-number-input.component'
import { FormTextareaComponent } from '../../shared/forms/form-textarea.component'
import { FormErrorComponent } from '../../shared/forms/form-error.component'
import { InventoryRepository } from './inventory.repository'
import { SessionService } from '../../core/auth/session.service'
import { ToastService } from '../../shared/feedback/toast.service'

interface ProductSummary {
  id: string
  nombre: string
  currentStock: number
}

@Component({
  selector: 'mo-adjust-stock-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    DialogComponent,
    ButtonComponent,
    FormNumberInputComponent,
    FormTextareaComponent,
    FormErrorComponent,
  ],
  template: `
    <mo-dialog
      [open]="open()"
      title="Ajustar stock"
      [description]="
        product()
          ? product()!.nombre + ' · stock actual ' + product()!.currentStock
          : null
      "
      [busy]="saving()"
      (closed)="onClose()"
    >
      <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-4">
        <mo-form-number-input
          controlName="cantidadDelta"
          label="Variación (+ entrada / − salida)"
          description="Ej: 5 para sumar, -3 para restar"
          [step]="1"
          [min]="null"
          [required]="true"
        />
        <mo-form-textarea
          controlName="motivo"
          label="Motivo"
          [required]="true"
          [rows]="3"
          placeholder="Conteo fisico, daño, perdida, etc."
        />

        <mo-form-error [message]="rootError()" />

        <div class="flex justify-end gap-2 pt-2">
          <mo-button variant="outline" type="button" [disabled]="saving()" (click)="onClose()"
            >Cancelar</mo-button
          >
          <mo-button type="submit" [loading]="saving()" loadingText="Guardando..."
            >Guardar ajuste</mo-button
          >
        </div>
      </form>
    </mo-dialog>
  `,
})
export class AdjustStockDialog {
  private readonly repo = inject(InventoryRepository)
  private readonly session = inject(SessionService)
  private readonly toast = inject(ToastService)

  readonly open = input<boolean>(false)
  readonly product = input<ProductSummary | null>(null)

  readonly closed = output<void>()
  readonly saved = output<void>()

  readonly saving = signal(false)
  readonly rootError = signal<string | null>(null)

  readonly form = new FormGroup({
    cantidadDelta: new FormControl<number>(0, {
      nonNullable: true,
      validators: [Validators.required],
    }),
    motivo: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(3)],
    }),
  })

  constructor() {
    effect(() => {
      if (this.open()) {
        this.form.reset({ cantidadDelta: 0, motivo: '' })
        this.rootError.set(null)
      }
    })
  }

  async submit(): Promise<void> {
    if (this.saving()) return
    this.form.markAllAsTouched()
    if (this.form.invalid) return

    const value = this.form.getRawValue()
    if (Number(value.cantidadDelta) === 0) {
      this.rootError.set('La variación no puede ser cero')
      return
    }

    const product = this.product()
    if (!product) return

    const auth = await this.session.getAuthContext()
    if (!auth) {
      this.rootError.set('Sesion expirada')
      return
    }

    this.saving.set(true)
    this.form.disable({ emitEvent: false })

    try {
      await this.repo.adjustStock({
        tiendaId: auth.tiendaId,
        productId: product.id,
        cantidadDelta: Number(value.cantidadDelta),
        motivo: value.motivo.trim(),
        createdBy: auth.userId,
      })
      this.toast.success('Ajuste registrado')
      this.saved.emit()
      this.closed.emit()
    } catch (error) {
      this.rootError.set(error instanceof Error ? error.message : 'Error al ajustar stock')
    } finally {
      this.saving.set(false)
      this.form.enable({ emitEvent: false })
    }
  }

  onClose(): void {
    if (this.saving()) return
    this.closed.emit()
  }
}
