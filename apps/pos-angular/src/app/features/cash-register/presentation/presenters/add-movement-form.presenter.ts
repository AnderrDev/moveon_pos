import { inject, Injectable, signal } from '@angular/core'
import { NonNullableFormBuilder } from '@angular/forms'
import {
  addMovementFormSchema,
  createAddMovementDefaults,
  type AddMovementFormValue,
} from '@angular-app/features/cash-register/presentation/forms/add-movement-form.factory'

type AddMovementFormErrors = Partial<Record<keyof AddMovementFormValue | 'root', string>>

@Injectable()
export class AddMovementFormPresenter {
  private readonly fb = inject(NonNullableFormBuilder)

  readonly errors = signal<AddMovementFormErrors>({})
  readonly form = this.fb.group(createAddMovementDefaults())

  reset(initial: Partial<AddMovementFormValue> = {}): void {
    this.form.reset(createAddMovementDefaults(initial))
    this.errors.set({})
  }

  validate(): AddMovementFormValue | null {
    this.form.markAllAsTouched()
    const parsed = addMovementFormSchema.safeParse(this.form.getRawValue())
    if (!parsed.success) {
      const errors: AddMovementFormErrors = {}
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof AddMovementFormValue | undefined
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
