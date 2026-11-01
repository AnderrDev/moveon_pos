import { inject, Injectable, signal } from '@angular/core'
import { NonNullableFormBuilder } from '@angular/forms'
import {
  createSplitProductDefaults,
  splitProductFormSchema,
  type SplitProductFormValue,
} from '@angular-app/features/inventory/presentation/forms/split-product-form.factory'

type SplitProductFormErrors = Partial<Record<keyof SplitProductFormValue | 'root', string>>

@Injectable()
export class SplitProductFormPresenter {
  private readonly fb = inject(NonNullableFormBuilder)

  readonly errors = signal<SplitProductFormErrors>({})
  readonly form = this.fb.group(createSplitProductDefaults())

  reset(initial: Partial<SplitProductFormValue> = {}): void {
    this.form.reset(createSplitProductDefaults(initial))
    this.errors.set({})
  }

  validate(): SplitProductFormValue | null {
    this.form.markAllAsTouched()
    const parsed = splitProductFormSchema.safeParse(this.form.getRawValue())
    if (!parsed.success) {
      const errors: SplitProductFormErrors = {}
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof SplitProductFormValue | undefined
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
