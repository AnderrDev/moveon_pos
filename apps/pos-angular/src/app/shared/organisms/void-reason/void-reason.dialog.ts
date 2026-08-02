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
import { DialogComponent } from '../dialog.component'
import { ButtonComponent } from '../../atoms/button.component'
import { FormTextareaComponent } from '../../molecules/form-textarea.component'
import { FormErrorComponent } from '../../molecules/form-error.component'
import { isValidVoidReason, VOID_REASON_MIN_LENGTH } from './void-reason'

@Component({
  selector: 'mo-void-reason-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, DialogComponent, ButtonComponent, FormTextareaComponent, FormErrorComponent],
  template: `
    <mo-dialog
      [open]="open()"
      [title]="title()"
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
          [placeholder]="placeholder()"
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
  readonly title = input<string>('Anular')
  /** Etiqueta legible del elemento a anular (ej: "la venta V-000123"). */
  readonly targetLabel = input<string | null>(null)
  readonly placeholder = input<string>('Describe por qué se anula')

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
    const label = this.targetLabel()
    return label ? `Vas a anular ${label}.` : 'Vas a anular este elemento.'
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
