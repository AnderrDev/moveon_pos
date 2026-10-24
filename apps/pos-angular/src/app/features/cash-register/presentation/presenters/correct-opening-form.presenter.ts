import { inject, Injectable, signal } from '@angular/core'
import { NonNullableFormBuilder } from '@angular/forms'
import {
  correctOpeningFormSchema,
  createCorrectOpeningDefaults,
  type CorrectOpeningFormValue,
} from '@angular-app/features/cash-register/presentation/forms/correct-opening-form.factory'

type CorrectOpeningFormErrors = Partial<Record<keyof CorrectOpeningFormValue | 'root', string>>

@Injectable()
export class CorrectOpeningFormPresenter {
  private readonly fb = inject(NonNullableFormBuilder)

  readonly errors = signal<CorrectOpeningFormErrors>({})
  readonly form = this.fb.group(createCorrectOpeningDefaults())

  reset(initial: Partial<CorrectOpeningFormValue> = {}): void {
    this.form.reset(createCorrectOpeningDefaults(initial))
    this.errors.set({})
  }

  validate(): CorrectOpeningFormValue | null {
    this.form.markAllAsTouched()
    const parsed = correctOpeningFormSchema.safeParse(this.form.getRawValue())
    if (!parsed.success) {
      const errors: CorrectOpeningFormErrors = {}
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof CorrectOpeningFormValue | undefined
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
