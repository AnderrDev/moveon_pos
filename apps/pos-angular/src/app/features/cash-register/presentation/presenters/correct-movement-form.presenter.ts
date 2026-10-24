import { inject, Injectable, signal } from '@angular/core'
import { NonNullableFormBuilder } from '@angular/forms'
import {
  correctMovementFormSchema,
  createCorrectMovementDefaults,
  type CorrectMovementFormValue,
} from '@angular-app/features/cash-register/presentation/forms/correct-movement-form.factory'

type CorrectMovementFormErrors = Partial<Record<keyof CorrectMovementFormValue | 'root', string>>

@Injectable()
export class CorrectMovementFormPresenter {
  private readonly fb = inject(NonNullableFormBuilder)

  readonly errors = signal<CorrectMovementFormErrors>({})
  readonly form = this.fb.group(createCorrectMovementDefaults())

  reset(initial: Partial<CorrectMovementFormValue> = {}): void {
    this.form.reset(createCorrectMovementDefaults(initial))
    this.errors.set({})
  }

  validate(): CorrectMovementFormValue | null {
    this.form.markAllAsTouched()
    const parsed = correctMovementFormSchema.safeParse(this.form.getRawValue())
    if (!parsed.success) {
      const errors: CorrectMovementFormErrors = {}
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof CorrectMovementFormValue | undefined
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
