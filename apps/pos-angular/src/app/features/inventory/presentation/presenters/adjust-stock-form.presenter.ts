import { inject, Injectable, signal } from '@angular/core'
import { NonNullableFormBuilder } from '@angular/forms'
import {
  adjustStockFormSchema,
  createAdjustStockDefaults,
  type AdjustStockFormValue,
} from '@angular-app/features/inventory/presentation/forms/adjust-stock-form.factory'

type AdjustStockFormErrors = Partial<Record<keyof AdjustStockFormValue | 'root', string>>

@Injectable()
export class AdjustStockFormPresenter {
  private readonly fb = inject(NonNullableFormBuilder)

  readonly errors = signal<AdjustStockFormErrors>({})
  readonly form = this.fb.group(createAdjustStockDefaults())

  reset(initial: Partial<AdjustStockFormValue> = {}): void {
    this.form.reset(createAdjustStockDefaults(initial))
    this.errors.set({})
  }

  validate(): AdjustStockFormValue | null {
    this.form.markAllAsTouched()
    const parsed = adjustStockFormSchema.safeParse(this.form.getRawValue())
    if (!parsed.success) {
      const errors: AdjustStockFormErrors = {}
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof AdjustStockFormValue | undefined
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
