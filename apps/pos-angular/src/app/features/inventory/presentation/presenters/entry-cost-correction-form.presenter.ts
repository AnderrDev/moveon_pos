import { inject, Injectable, signal } from '@angular/core'
import { NonNullableFormBuilder } from '@angular/forms'
import {
  createEntryCostCorrectionDefaults,
  entryCostCorrectionFormSchema,
  type EntryCostCorrectionFormValue,
} from '@angular-app/features/inventory/presentation/forms/entry-cost-correction-form.factory'

type EntryCostCorrectionFormErrors = Partial<
  Record<keyof EntryCostCorrectionFormValue | 'root', string>
>

@Injectable()
export class EntryCostCorrectionFormPresenter {
  private readonly fb = inject(NonNullableFormBuilder)

  readonly errors = signal<EntryCostCorrectionFormErrors>({})
  readonly form = this.fb.group(createEntryCostCorrectionDefaults())

  reset(initial: Partial<EntryCostCorrectionFormValue> = {}): void {
    this.form.reset(createEntryCostCorrectionDefaults(initial))
    this.errors.set({})
  }

  validate(): EntryCostCorrectionFormValue | null {
    this.form.markAllAsTouched()
    const parsed = entryCostCorrectionFormSchema.safeParse(this.form.getRawValue())

    if (!parsed.success) {
      const errors: EntryCostCorrectionFormErrors = {}
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof EntryCostCorrectionFormValue | undefined
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
