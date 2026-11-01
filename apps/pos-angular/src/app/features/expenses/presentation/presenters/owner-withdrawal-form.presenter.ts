import { inject, Injectable, signal } from '@angular/core'
import { NonNullableFormBuilder } from '@angular/forms'
import {
  createOwnerWithdrawalFormDefaults,
  ownerWithdrawalFormSchema,
  type OwnerWithdrawalFormValue,
} from '@angular-app/features/expenses/presentation/forms/owner-withdrawal-form.factory'

type OwnerWithdrawalFormErrors = Partial<Record<keyof OwnerWithdrawalFormValue | 'root', string>>

@Injectable()
export class OwnerWithdrawalFormPresenter {
  private readonly fb = inject(NonNullableFormBuilder)

  readonly errors = signal<OwnerWithdrawalFormErrors>({})
  readonly form = this.fb.group(createOwnerWithdrawalFormDefaults())

  reset(initial: Partial<OwnerWithdrawalFormValue> = {}): void {
    this.form.reset(createOwnerWithdrawalFormDefaults(initial))
    this.errors.set({})
  }

  validate(): OwnerWithdrawalFormValue | null {
    this.form.markAllAsTouched()
    const parsed = ownerWithdrawalFormSchema.safeParse(this.form.getRawValue())
    if (!parsed.success) {
      const errors: OwnerWithdrawalFormErrors = {}
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof OwnerWithdrawalFormValue | undefined
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
