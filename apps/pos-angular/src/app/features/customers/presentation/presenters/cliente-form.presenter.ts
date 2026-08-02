import { inject, Injectable, signal } from '@angular/core'
import { NonNullableFormBuilder } from '@angular/forms'
import {
  createClienteFormDefaults,
  clienteFormSchema,
  type ClienteFormValue,
} from '@angular-app/features/customers/presentation/forms/cliente-form.factory'

type ClienteFormErrors = Partial<Record<keyof ClienteFormValue | 'root', string>>

@Injectable()
export class ClienteFormPresenter {
  private readonly fb = inject(NonNullableFormBuilder)

  readonly errors = signal<ClienteFormErrors>({})
  readonly form = this.fb.group(createClienteFormDefaults())

  reset(initial: Partial<ClienteFormValue> = {}): void {
    this.form.reset(createClienteFormDefaults(initial))
    this.errors.set({})
  }

  validate(): ClienteFormValue | null {
    this.form.markAllAsTouched()
    const parsed = clienteFormSchema.safeParse(this.form.getRawValue())
    if (!parsed.success) {
      const errors: ClienteFormErrors = {}
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof ClienteFormValue | undefined
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
