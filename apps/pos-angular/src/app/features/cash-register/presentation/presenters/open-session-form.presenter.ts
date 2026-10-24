import { inject, Injectable, signal } from '@angular/core'
import { NonNullableFormBuilder } from '@angular/forms'
import {
  openSessionFormSchema,
  createOpenSessionDefaults,
  type OpenSessionFormValue,
} from '@angular-app/features/cash-register/presentation/forms/open-session-form.factory'

type OpenSessionFormErrors = Partial<Record<keyof OpenSessionFormValue | 'root', string>>

@Injectable()
export class OpenSessionFormPresenter {
  private readonly fb = inject(NonNullableFormBuilder)

  readonly errors = signal<OpenSessionFormErrors>({})
  readonly form = this.fb.group(createOpenSessionDefaults())

  reset(initial: Partial<OpenSessionFormValue> = {}): void {
    this.form.reset(createOpenSessionDefaults(initial))
    this.errors.set({})
  }

  validate(): OpenSessionFormValue | null {
    this.form.markAllAsTouched()
    const parsed = openSessionFormSchema.safeParse(this.form.getRawValue())
    if (!parsed.success) {
      const errors: OpenSessionFormErrors = {}
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof OpenSessionFormValue | undefined
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
