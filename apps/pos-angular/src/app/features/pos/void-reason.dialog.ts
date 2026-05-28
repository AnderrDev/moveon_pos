import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
} from '@angular/core'
import { toSignal } from '@angular/core/rxjs-interop'
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms'
import { DialogComponent } from '../../shared/ui/dialog.component'
import { ButtonComponent } from '../../shared/ui/button.component'
import { FormTextareaComponent } from '../../shared/forms/form-textarea.component'
import { FormErrorComponent } from '../../shared/forms/form-error.component'
import { isValidVoidReason, VOID_REASON_MIN_LENGTH } from './void-reason'

@Component({
  selector: 'mo-void-reason-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, DialogComponent, ButtonComponent, FormTextareaComponent, FormErrorComponent],
  template: `
    <mo-dialog
      [open]="open()"
      title="Anular venta"
      [description]="dialogDescription()"
      width="sm"
      (closed)="onClose()"
    >
      <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-4">
        <mo-form-textarea
          controlName="reason"
          label="Motivo de anulación"
          [rows]="3"
          [required]="true"
          placeholder="Describe por qué se anula esta venta"
          [description]="hint"
        />

        <mo-form-error [message]="reasonError()" />

        <div class="flex justify-end gap-2 pt-1">
          <mo-button variant="outline" type="button" (click)="onClose()">Cancelar</mo-button>
          <mo-button variant="destructive" type="submit" [disabled]="!canConfirm()">Anular</mo-button>
        </div>
      </form>
    </mo-dialog>
  `,
})
export class VoidReasonDialog {
  readonly open = input<boolean>(false)
  readonly saleNumber = input<string | null>(null)

  readonly closed = output<void>()
  readonly confirmed = output<string>()

  readonly reasonError = signal<string | null>(null)

  readonly hint = `Mínimo ${VOID_REASON_MIN_LENGTH} caracteres.`

  readonly form = new FormGroup({
    reason: new FormControl<string>('', { nonNullable: true }),
  })

  // OnPush: el botón debe habilitarse de forma reactiva mientras se escribe, sin
  // necesidad de pulsar primero. `valueChanges` -> signal evita depender del CD manual.
  private readonly reasonValue = toSignal(this.form.controls.reason.valueChanges, {
    initialValue: '',
  })

  readonly canConfirm = computed(() => isValidVoidReason(this.reasonValue()))

  readonly dialogDescription = computed(() => {
    const number = this.saleNumber()
    return number ? `Vas a anular la venta ${number}.` : 'Vas a anular esta venta.'
  })

  constructor() {
    effect(() => {
      if (this.open()) {
        this.form.reset({ reason: '' })
        this.reasonError.set(null)
      }
    })
  }

  submit(): void {
    const value = this.form.getRawValue().reason
    if (!isValidVoidReason(value)) {
      this.reasonError.set(`El motivo debe tener al menos ${VOID_REASON_MIN_LENGTH} caracteres`)
      return
    }

    this.reasonError.set(null)
    this.confirmed.emit(value.trim())
    this.closed.emit()
  }

  onClose(): void {
    this.closed.emit()
  }
}
