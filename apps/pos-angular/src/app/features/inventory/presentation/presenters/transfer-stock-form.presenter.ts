import { inject, Injectable, signal } from '@angular/core'
import { NonNullableFormBuilder } from '@angular/forms'
import {
  transferStockFormSchema,
  createTransferStockDefaults,
  type TransferStockFormValue,
} from '@angular-app/features/inventory/presentation/forms/transfer-stock-form.factory'

type TransferStockFormErrors = Partial<Record<keyof TransferStockFormValue | 'root', string>>

@Injectable()
export class TransferStockFormPresenter {
  private readonly fb = inject(NonNullableFormBuilder)

  readonly errors = signal<TransferStockFormErrors>({})
  readonly form = this.fb.group(createTransferStockDefaults())

  reset(initial: Partial<TransferStockFormValue> = {}): void {
    this.form.reset(createTransferStockDefaults(initial))
    this.errors.set({})
  }

  validate(): TransferStockFormValue | null {
    this.form.markAllAsTouched()
    const parsed = transferStockFormSchema.safeParse(this.form.getRawValue())
    if (!parsed.success) {
      const errors: TransferStockFormErrors = {}
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof TransferStockFormValue | undefined
        if (field && !errors[field]) errors[field] = issue.message
      }
      this.errors.set(errors)
      return null
    }
    this.errors.set({})
    return parsed.data
  }

  setRootError(message: string): void {
    this.errors.update((current) => ({ ...current, root: message }))
  }
}
