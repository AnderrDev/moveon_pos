import { inject, Injectable, signal } from '@angular/core'
import { NonNullableFormBuilder } from '@angular/forms'
import {
  nominaPagoFormSchema,
  createNominaPagoFormDefaults,
  type NominaPagoFormValue,
} from '@angular-app/features/expenses/presentation/forms/nomina-pago-form.factory'

type NominaPagoFormErrors = Partial<Record<keyof NominaPagoFormValue | 'root', string>>

@Injectable()
export class NominaPagoFormPresenter {
  private readonly fb = inject(NonNullableFormBuilder)

  readonly errors = signal<NominaPagoFormErrors>({})
  readonly form = this.fb.group(createNominaPagoFormDefaults())

  reset(initial: Partial<NominaPagoFormValue> = {}): void {
    this.form.reset(createNominaPagoFormDefaults(initial))
    this.errors.set({})
  }

  validate(): NominaPagoFormValue | null {
    this.form.markAllAsTouched()
    const parsed = nominaPagoFormSchema.safeParse(this.form.getRawValue())
    if (!parsed.success) {
      const errors: NominaPagoFormErrors = {}
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof NominaPagoFormValue | undefined
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
