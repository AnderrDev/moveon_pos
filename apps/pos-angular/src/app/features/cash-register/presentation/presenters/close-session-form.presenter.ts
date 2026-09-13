import { inject, Injectable, signal } from '@angular/core'
import { NonNullableFormBuilder } from '@angular/forms'
import {
  closeSessionFormSchema,
  createCloseSessionDefaults,
  type CloseSessionFormValue,
} from '@angular-app/features/cash-register/presentation/forms/close-session-form.factory'

type CloseSessionFormErrors = Partial<Record<keyof CloseSessionFormValue | 'root', string>>

@Injectable()
export class CloseSessionFormPresenter {
  private readonly fb = inject(NonNullableFormBuilder)

  readonly errors = signal<CloseSessionFormErrors>({})
  readonly form = this.fb.group(createCloseSessionDefaults())

  reset(initial: Partial<CloseSessionFormValue> = {}): void {
    this.form.reset(createCloseSessionDefaults(initial))
    this.errors.set({})
  }

  validate(): CloseSessionFormValue | null {
    this.form.markAllAsTouched()
    const parsed = closeSessionFormSchema.safeParse(this.form.getRawValue())
    if (!parsed.success) {
      const errors: CloseSessionFormErrors = {}
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof CloseSessionFormValue | undefined
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
