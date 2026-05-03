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
import { FormCurrencyInputComponent } from '../../shared/forms/form-currency-input.component'
import { FormTextareaComponent } from '../../shared/forms/form-textarea.component'
import { FormErrorComponent } from '../../shared/forms/form-error.component'
import { CashRegisterRepository } from './cash-register.repository'
import { SessionService } from '../../core/auth/session.service'
import { ToastService } from '../../shared/feedback/toast.service'
import type { CashSession } from '@/modules/cash-register/domain/entities/cash-session.entity'

@Component({
  selector: 'mo-close-session-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    DialogComponent,
    ButtonComponent,
    FormCurrencyInputComponent,
    FormTextareaComponent,
    FormErrorComponent,
  ],
  template: `
    <mo-dialog
      [open]="open()"
      title="Cerrar caja"
      description="Captura el conteo final de cada metodo de pago"
      [busy]="saving()"
      width="lg"
      (closed)="onClose()"
    >
      <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-4">
        <div class="grid gap-4 sm:grid-cols-2">
          <mo-form-currency-input controlName="actualCashAmount" label="Efectivo en caja" [required]="true" />
          <mo-form-currency-input controlName="actualCardAmount" label="Tarjeta" />
          <mo-form-currency-input controlName="actualNequiAmount" label="Nequi" />
          <mo-form-currency-input controlName="actualDaviplataAmount" label="Daviplata" />
          <mo-form-currency-input controlName="actualTransferAmount" label="Transferencias" />
          <mo-form-currency-input controlName="actualOtherAmount" label="Otros" />
        </div>

        <mo-form-textarea
          controlName="notasCierre"
          label="Notas de cierre"
          [rows]="3"
          description="Obligatorio si las diferencias superan los $5.000"
        />

        <mo-form-error [message]="rootError()" />

        <div class="flex justify-end gap-2 pt-2">
          <mo-button variant="outline" type="button" [disabled]="saving()" (click)="onClose()"
            >Cancelar</mo-button
          >
          <mo-button
            variant="destructive"
            type="submit"
            [loading]="saving()"
            loadingText="Cerrando..."
            >Confirmar cierre</mo-button
          >
        </div>
      </form>
    </mo-dialog>
  `,
})
export class CloseSessionDialog {
  private readonly repo = inject(CashRegisterRepository)
  private readonly session = inject(SessionService)
  private readonly toast = inject(ToastService)

  readonly open = input<boolean>(false)
  readonly cashSession = input<CashSession | null>(null)

  readonly closed = output<void>()
  readonly saved = output<void>()

  readonly saving = signal(false)
  readonly rootError = signal<string | null>(null)

  readonly form = new FormGroup({
    actualCashAmount: new FormControl<number>(0, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0)],
    }),
    actualCardAmount: new FormControl<number>(0, { nonNullable: true }),
    actualNequiAmount: new FormControl<number>(0, { nonNullable: true }),
    actualDaviplataAmount: new FormControl<number>(0, { nonNullable: true }),
    actualTransferAmount: new FormControl<number>(0, { nonNullable: true }),
    actualOtherAmount: new FormControl<number>(0, { nonNullable: true }),
    notasCierre: new FormControl<string>('', { nonNullable: true }),
  })

  constructor() {
    effect(() => {
      if (this.open()) {
        this.form.reset({
          actualCashAmount: this.cashSession()?.openingAmount ?? 0,
          actualCardAmount: 0,
          actualNequiAmount: 0,
          actualDaviplataAmount: 0,
          actualTransferAmount: 0,
          actualOtherAmount: 0,
          notasCierre: '',
        })
        this.rootError.set(null)
      }
    })
  }

  async submit(): Promise<void> {
    if (this.saving()) return
    this.form.markAllAsTouched()
    if (this.form.invalid) return

    const cashSession = this.cashSession()
    if (!cashSession) return

    const auth = await this.session.getAuthContext()
    if (!auth) {
      this.rootError.set('Sesion expirada')
      return
    }

    this.saving.set(true)
    this.form.disable({ emitEvent: false })

    try {
      const value = this.form.getRawValue()
      await this.repo.closeSession({
        sessionId: cashSession.id,
        tiendaId: auth.tiendaId,
        closedBy: auth.userId,
        actualCashAmount: value.actualCashAmount,
        actualPayments: [
          { metodo: 'card', total: value.actualCardAmount },
          { metodo: 'nequi', total: value.actualNequiAmount },
          { metodo: 'daviplata', total: value.actualDaviplataAmount },
          { metodo: 'transfer', total: value.actualTransferAmount },
          { metodo: 'other', total: value.actualOtherAmount },
        ],
        notasCierre: value.notasCierre.trim() || undefined,
      })
      this.toast.success('Caja cerrada')
      this.saved.emit()
      this.closed.emit()
    } catch (error) {
      this.rootError.set(error instanceof Error ? error.message : 'Error al cerrar caja')
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
