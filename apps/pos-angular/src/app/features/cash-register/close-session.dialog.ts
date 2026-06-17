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
import { getErrorMessage } from '@/shared/lib/error-message'
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms'
import { toSignal } from '@angular/core/rxjs-interop'
import { DialogComponent } from '../../shared/ui/dialog.component'
import { ButtonComponent } from '../../shared/ui/button.component'
import { FormCurrencyInputComponent } from '../../shared/forms/form-currency-input.component'
import { FormTextareaComponent } from '../../shared/forms/form-textarea.component'
import { FormErrorComponent } from '../../shared/forms/form-error.component'
import { CashRegisterRepository } from './cash-register.repository'
import { SessionService } from '../../core/auth/session.service'
import { ToastService } from '../../shared/feedback/toast.service'
import { formatCurrency } from '@/shared/lib/format'
import { getPaymentMethodLabel } from '@/shared/lib/payment-methods'
import {
  CASH_DIFFERENCE_THRESHOLD,
  computeMethodDifference,
  exceedsThreshold,
  isBalanced,
} from '@/modules/cash-register/domain/services/cash-closure'
import type { CashSession } from '@/modules/cash-register/domain/entities/cash-session.entity'
import type { PaymentMethod } from '@/shared/types'

/** Esperado por método, tipo simple del dominio (sin acoplar a Supabase). */
export interface ExpectedByMethod {
  metodo: string
  total: number
  count: number
}

/** Fila renderizada en el diálogo: esperado, conteo en vivo y diferencia. */
interface ClosureRow {
  metodo: PaymentMethod
  label: string
  controlName: string
  expected: number
  /** Número de pagos que componen `expected` (no confundir con `counted`: el monto físico contado). */
  expectedCount: number
  counted: number
  /** `counted - expected`: positivo = sobra, negativo = falta. */
  difference: number
}

const NON_CASH_METHODS: { metodo: Exclude<PaymentMethod, 'cash'>; controlName: string }[] = [
  { metodo: 'card', controlName: 'actualCardAmount' },
  { metodo: 'nequi', controlName: 'actualNequiAmount' },
  { metodo: 'daviplata', controlName: 'actualDaviplataAmount' },
  { metodo: 'transfer', controlName: 'actualTransferAmount' },
  { metodo: 'other', controlName: 'actualOtherAmount' },
]

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
        <div class="space-y-3">
          @for (row of rows(); track row.metodo) {
            <div class="rounded-lg border p-3">
              <div class="flex items-center justify-between gap-3">
                <span class="text-sm font-semibold">{{ row.label }}</span>
                <span class="text-muted-foreground text-[11px] font-semibold uppercase tracking-wide">
                  Esperado {{ money(row.expected) }} ({{ row.expectedCount }}
                  {{ row.expectedCount === 1 ? 'pago' : 'pagos' }})
                </span>
              </div>
              <div class="mt-2 grid items-end gap-3 sm:grid-cols-2">
                <mo-form-currency-input
                  [controlName]="row.controlName"
                  label="Conteo"
                  [required]="row.metodo === 'cash'"
                />
                <div class="text-right">
                  <p class="text-muted-foreground text-[11px] font-semibold uppercase tracking-wide">
                    Diferencia
                  </p>
                  <p class="font-semibold tabular-nums" [class]="differenceClass(row.difference)">
                    {{ differenceLabel(row.difference) }}
                  </p>
                </div>
              </div>
            </div>
          }
        </div>

        <mo-form-textarea
          controlName="notasCierre"
          label="Notas de cierre"
          [rows]="3"
          [description]="notesHint()"
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
  /** Esperado por método derivado del breakdown de ventas (no incluye efectivo derivado). */
  readonly expectedByMethod = input<ExpectedByMethod[]>([])
  /** Esperado en caja (RN-C03): apertura + ventas efectivo + movimientos. */
  readonly expectedCash = input<number>(0)

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

  /** Espejo reactivo del form para recalcular las diferencias al teclear. */
  private readonly formValue = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  })

  /** Esperado por método, indexado para lookup O(1). */
  private readonly expectedMap = computed(() => {
    const map = new Map<string, { total: number; count: number }>()
    for (const item of this.expectedByMethod()) {
      const cur = map.get(item.metodo) ?? { total: 0, count: 0 }
      map.set(item.metodo, { total: cur.total + item.total, count: cur.count + item.count })
    }
    return map
  })

  /** 6 filas fijas: efectivo (vs esperado en caja) + 5 no-efectivo (vs breakdown). */
  readonly rows = computed<ClosureRow[]>(() => {
    const value = this.formValue()
    const cashCounted = value.actualCashAmount ?? 0
    const cashExpected = this.expectedCash()
    const expectedMap = this.expectedMap()

    const cashRow: ClosureRow = {
      metodo: 'cash',
      label: getPaymentMethodLabel('cash'),
      controlName: 'actualCashAmount',
      expected: cashExpected,
      expectedCount: expectedMap.get('cash')?.count ?? 0,
      counted: cashCounted,
      difference: computeMethodDifference(cashExpected, cashCounted),
    }

    const nonCashRows = NON_CASH_METHODS.map(({ metodo, controlName }): ClosureRow => {
      const expected = expectedMap.get(metodo)?.total ?? 0
      const expectedCount = expectedMap.get(metodo)?.count ?? 0
      const counted = (value[controlName as keyof typeof value] as number | undefined) ?? 0
      return {
        metodo,
        label: getPaymentMethodLabel(metodo),
        controlName,
        expected,
        expectedCount,
        counted,
        difference: computeMethodDifference(expected, counted),
      }
    })

    return [cashRow, ...nonCashRows]
  })

  /** Alguna diferencia (cualquier método) supera el umbral. */
  readonly hasThresholdBreach = computed(() =>
    this.rows().some((row) => exceedsThreshold(row.difference)),
  )

  /** Pista para notas: obligatoria si alguna diferencia supera el umbral. */
  readonly notesHint = computed(() =>
    this.hasThresholdBreach()
      ? `Obligatorio: alguna diferencia supera ${formatCurrency(CASH_DIFFERENCE_THRESHOLD)}`
      : `Opcional. Obligatorio si las diferencias superan ${formatCurrency(CASH_DIFFERENCE_THRESHOLD)}`,
  )

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

  money(v: number): string {
    return formatCurrency(v)
  }

  /** Etiqueta legible de la diferencia con signo y rótulo Sobra/Falta. */
  differenceLabel(difference: number): string {
    if (isBalanced(difference)) return formatCurrency(0)
    const tag = difference > 0 ? 'sobra' : 'falta'
    return `${formatCurrency(Math.abs(difference))} ${tag}`
  }

  /** Verde/neutra si cuadra; resaltada (destructive) si hay descuadre. */
  differenceClass(difference: number): string {
    return isBalanced(difference) ? 'text-emerald-600' : 'text-destructive'
  }

  async submit(): Promise<void> {
    if (this.saving()) return
    this.form.markAllAsTouched()
    if (this.form.invalid) return

    const cashSession = this.cashSession()
    if (!cashSession) return

    // RN-C10 replicado en cliente: si alguna diferencia supera el umbral, la nota
    // es obligatoria. El RPC sigue siendo la autoridad y volverá a validarlo.
    if (this.hasThresholdBreach() && this.form.controls.notasCierre.value.trim() === '') {
      this.rootError.set(
        `Las diferencias superan ${formatCurrency(CASH_DIFFERENCE_THRESHOLD)}: agrega una nota de cierre`,
      )
      return
    }

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
      this.rootError.set(getErrorMessage(error, 'Error al cerrar caja'))
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
