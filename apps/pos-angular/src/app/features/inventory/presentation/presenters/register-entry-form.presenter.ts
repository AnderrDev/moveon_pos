import { inject, Injectable, signal } from '@angular/core'
import { NonNullableFormBuilder } from '@angular/forms'
import {
  registerEntryFormSchema,
  createRegisterEntryDefaults,
  type RegisterEntryFormValue,
} from '@angular-app/features/inventory/presentation/forms/register-entry-form.factory'

type RegisterEntryFormErrors = Partial<Record<keyof RegisterEntryFormValue | 'root', string>>

@Injectable()
export class RegisterEntryFormPresenter {
  private readonly fb = inject(NonNullableFormBuilder)

  readonly errors = signal<RegisterEntryFormErrors>({})
  readonly form = this.fb.group(createRegisterEntryDefaults())

  reset(initial: Partial<RegisterEntryFormValue> = {}): void {
    this.form.reset(createRegisterEntryDefaults(initial))
    this.errors.set({})
  }

  validate(): RegisterEntryFormValue | null {
    this.form.markAllAsTouched()
    const parsed = registerEntryFormSchema.safeParse(this.form.getRawValue())
    if (!parsed.success) {
      const errors: RegisterEntryFormErrors = {}
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof RegisterEntryFormValue | undefined
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
