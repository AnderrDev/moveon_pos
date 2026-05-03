import { inject, Injectable, signal } from '@angular/core'
import { NonNullableFormBuilder } from '@angular/forms'
import {
  categoriaFormSchema,
  createCategoriaFormDefaults,
  type CategoriaFormValue,
} from '@/modules/products/forms/categoria-form.factory'

type CategoriaFormErrors = Partial<Record<keyof CategoriaFormValue | 'root', string>>

@Injectable()
export class CategoriaFormPresenter {
  private readonly fb = inject(NonNullableFormBuilder)

  readonly errors = signal<CategoriaFormErrors>({})
  readonly form = this.fb.group(createCategoriaFormDefaults())

  reset(initial: Partial<CategoriaFormValue> = {}): void {
    this.form.reset(createCategoriaFormDefaults(initial))
    this.errors.set({})
  }

  validate(): CategoriaFormValue | null {
    this.form.markAllAsTouched()
    const parsed = categoriaFormSchema.safeParse(this.form.getRawValue())
    if (!parsed.success) {
      const errors: CategoriaFormErrors = {}
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof CategoriaFormValue | undefined
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
