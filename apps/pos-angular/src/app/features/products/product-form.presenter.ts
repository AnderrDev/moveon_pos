import { inject, Injectable, signal } from '@angular/core'
import { NonNullableFormBuilder } from '@angular/forms'
import {
  createProductFormDefaults,
  productFormSchema,
  type ProductFormValue,
} from '@/modules/products/forms/product-form.factory'

type ProductFormErrors = Partial<Record<keyof ProductFormValue | 'root', string>>

@Injectable()
export class ProductFormPresenter {
  private readonly fb = inject(NonNullableFormBuilder)

  readonly errors = signal<ProductFormErrors>({})
  readonly form = this.fb.group(createProductFormDefaults())

  reset(initial: Partial<ProductFormValue> = {}): void {
    this.form.reset(createProductFormDefaults(initial))
    this.errors.set({})
  }

  validate(): ProductFormValue | null {
    this.form.markAllAsTouched()
    const parsed = productFormSchema.safeParse(this.form.getRawValue())
    if (!parsed.success) {
      const errors: ProductFormErrors = {}
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof ProductFormValue | undefined
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
