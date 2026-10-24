import { inject, Injectable, signal } from '@angular/core'
import { NonNullableFormBuilder } from '@angular/forms'
import {
  empleadoFormSchema,
  createEmpleadoFormDefaults,
  type EmpleadoFormValue,
} from '@angular-app/features/expenses/presentation/forms/empleado-form.factory'

type EmpleadoFormErrors = Partial<Record<keyof EmpleadoFormValue | 'root', string>>

@Injectable()
export class EmpleadoFormPresenter {
  private readonly fb = inject(NonNullableFormBuilder)

  readonly errors = signal<EmpleadoFormErrors>({})
  readonly form = this.fb.group(createEmpleadoFormDefaults())

  reset(initial: Partial<EmpleadoFormValue> = {}): void {
    this.form.reset(createEmpleadoFormDefaults(initial))
    this.errors.set({})
  }

  validate(): EmpleadoFormValue | null {
    this.form.markAllAsTouched()
    const parsed = empleadoFormSchema.safeParse(this.form.getRawValue())
    if (!parsed.success) {
      const errors: EmpleadoFormErrors = {}
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof EmpleadoFormValue | undefined
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
