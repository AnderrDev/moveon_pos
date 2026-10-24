import { Injectable, signal } from '@angular/core'
import { FormControl, FormGroup } from '@angular/forms'
import {
  adjustStampsFormSchema,
  createAdjustStampsFormDefaults,
  type AdjustStampsFormValue,
} from '@angular-app/features/loyalty/presentation/forms/adjust-stamps-form.factory'

type AdjustStampsFormErrors = Partial<Record<keyof AdjustStampsFormValue | 'root', string>>

/** Ajuste manual de sellos del club (RN-LF16). El delta arranca vacío (null). */
@Injectable()
export class AdjustStampsFormPresenter {
  readonly errors = signal<AdjustStampsFormErrors>({})
  readonly form = new FormGroup({
    delta: new FormControl<number | null>(null),
    reason: new FormControl<string>('', { nonNullable: true }),
  })

  reset(): void {
    this.form.reset(createAdjustStampsFormDefaults())
    this.errors.set({})
  }

  validate(): AdjustStampsFormValue | null {
    this.form.markAllAsTouched()
    const raw = this.form.getRawValue()
    // Delta vacío → NaN para que el schema lo rechace con su mensaje.
    const parsed = adjustStampsFormSchema.safeParse({ delta: raw.delta ?? Number.NaN, reason: raw.reason })
    if (!parsed.success) {
      const errors: AdjustStampsFormErrors = {}
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof AdjustStampsFormValue | undefined
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
