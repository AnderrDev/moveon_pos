import { Injectable, inject, signal } from '@angular/core'
import { NonNullableFormBuilder } from '@angular/forms'
import {
  createExpenseFormDefaults,
  expenseFormSchema,
  type ExpenseFormValue,
} from '@/modules/expenses/forms/expense-form.factory'

type ExpenseFormErrors = Partial<Record<keyof ExpenseFormValue | 'root', string>>

@Injectable()
export class ExpenseFormPresenter {
  private readonly fb = inject(NonNullableFormBuilder)

  readonly errors = signal<ExpenseFormErrors>({})
  readonly form = this.fb.group(createExpenseFormDefaults())

  reset(initial: Partial<ExpenseFormValue> = {}): void {
    this.form.reset(createExpenseFormDefaults(initial))
    this.errors.set({})
  }

  validate(): ExpenseFormValue | null {
    this.form.markAllAsTouched()
    const parsed = expenseFormSchema.safeParse(this.form.getRawValue())

    if (!parsed.success) {
      const errors: ExpenseFormErrors = {}
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof ExpenseFormValue | undefined
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
