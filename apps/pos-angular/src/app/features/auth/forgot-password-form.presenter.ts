import { Injectable, inject, signal } from '@angular/core'
import { NonNullableFormBuilder } from '@angular/forms'
import {
  createForgotPasswordFormDefaults,
  forgotPasswordFormSchema,
  type ForgotPasswordFormValue,
} from '@/modules/auth/forms/forgot-password-form.factory'

type ForgotPasswordFormErrors = Partial<
  Record<keyof ForgotPasswordFormValue | 'root', string>
>

@Injectable()
export class ForgotPasswordFormPresenter {
  private readonly fb = inject(NonNullableFormBuilder)

  readonly errors = signal<ForgotPasswordFormErrors>({})
  readonly form = this.fb.group(createForgotPasswordFormDefaults())

  validate(): ForgotPasswordFormValue | null {
    this.form.markAllAsTouched()
    const parsed = forgotPasswordFormSchema.safeParse(this.form.getRawValue())

    if (!parsed.success) {
      const errors: ForgotPasswordFormErrors = {}
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof ForgotPasswordFormValue | undefined
        if (field && !errors[field]) errors[field] = issue.message
      }
      this.errors.set(errors)
      return null
    }

    this.errors.set({})
    return parsed.data
  }

  setRootError(message: string): void {
    this.errors.update((errors) => ({ ...errors, root: message }))
  }
}
