import { Injectable, inject, signal } from '@angular/core'
import { NonNullableFormBuilder } from '@angular/forms'
import {
  createResetPasswordFormDefaults,
  resetPasswordFormSchema,
  type ResetPasswordFormValue,
} from '@/modules/auth/forms/reset-password-form.factory'

type ResetPasswordFormErrors = Partial<
  Record<keyof ResetPasswordFormValue | 'root', string>
>

@Injectable()
export class ResetPasswordFormPresenter {
  private readonly fb = inject(NonNullableFormBuilder)

  readonly errors = signal<ResetPasswordFormErrors>({})
  readonly form = this.fb.group(createResetPasswordFormDefaults())

  validate(): ResetPasswordFormValue | null {
    this.form.markAllAsTouched()
    const parsed = resetPasswordFormSchema.safeParse(this.form.getRawValue())

    if (!parsed.success) {
      const errors: ResetPasswordFormErrors = {}
      for (const issue of parsed.error.issues) {
        // El refine de coincidencia emite el issue en `path: ['confirmPassword']`,
        // así que cae naturalmente sobre ese campo.
        const field = issue.path[0] as keyof ResetPasswordFormValue | undefined
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
