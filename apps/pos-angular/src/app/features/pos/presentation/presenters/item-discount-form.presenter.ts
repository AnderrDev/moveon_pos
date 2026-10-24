import { inject, Injectable, signal } from '@angular/core'
import { NonNullableFormBuilder } from '@angular/forms'
import {
  createItemDiscountDefaults,
  createItemDiscountFormSchema,
  type ItemDiscountFormValue,
} from '@angular-app/features/pos/presentation/forms/item-discount-form.factory'

type ItemDiscountFormErrors = Partial<Record<keyof ItemDiscountFormValue | 'root', string>>

@Injectable()
export class ItemDiscountFormPresenter {
  private readonly fb = inject(NonNullableFormBuilder)

  readonly errors = signal<ItemDiscountFormErrors>({})
  readonly form = this.fb.group(createItemDiscountDefaults())

  reset(initial: Partial<ItemDiscountFormValue> = {}): void {
    this.form.reset(createItemDiscountDefaults(initial))
    this.errors.set({})
  }

  /** Valida contra el precio unitario de la línea que se está descontando. */
  validate(unitPrice: number): ItemDiscountFormValue | null {
    this.form.markAllAsTouched()
    const parsed = createItemDiscountFormSchema(unitPrice).safeParse(this.form.getRawValue())
    if (!parsed.success) {
      const errors: ItemDiscountFormErrors = {}
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof ItemDiscountFormValue | undefined
        if (field && !errors[field]) errors[field] = issue.message
      }
      this.errors.set(errors)
      return null
    }
    this.errors.set({})
    return parsed.data
  }

  clearErrors(): void {
    this.errors.set({})
  }
}
