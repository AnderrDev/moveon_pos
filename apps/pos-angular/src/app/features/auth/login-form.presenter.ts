import { Injectable, inject, signal } from '@angular/core'
import { NonNullableFormBuilder } from '@angular/forms'
import {
  createLoginFormDefaults,
  loginFormSchema,
  type LoginFormValue,
} from '@/modules/auth/forms/login-form.factory'

type LoginFormErrors = Partial<Record<keyof LoginFormValue | 'root', string>>

@Injectable()
export class LoginFormPresenter {
  private readonly fb = inject(NonNullableFormBuilder)

  readonly errors = signal<LoginFormErrors>({})
  readonly form = this.fb.group(createLoginFormDefaults())

  validate(): LoginFormValue | null {
    this.form.markAllAsTouched()
    const parsed = loginFormSchema.safeParse(this.form.getRawValue())

    if (!parsed.success) {
      const errors: LoginFormErrors = {}
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof LoginFormValue | undefined
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
