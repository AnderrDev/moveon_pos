import { inject, Injectable, signal } from '@angular/core'
import { NonNullableFormBuilder } from '@angular/forms'
import {
  fundSettingsFormSchema,
  createFundSettingsFormDefaults,
  type FundSettingsFormValue,
} from '@angular-app/features/expenses/presentation/forms/fund-settings-form.factory'

type FundSettingsFormErrors = Partial<Record<keyof FundSettingsFormValue | 'root', string>>

@Injectable()
export class FundSettingsFormPresenter {
  private readonly fb = inject(NonNullableFormBuilder)

  readonly errors = signal<FundSettingsFormErrors>({})
  readonly form = this.fb.group(createFundSettingsFormDefaults())

  reset(initial: Partial<FundSettingsFormValue> = {}): void {
    this.form.reset(createFundSettingsFormDefaults(initial))
    this.errors.set({})
  }

  validate(): FundSettingsFormValue | null {
    this.form.markAllAsTouched()
    const parsed = fundSettingsFormSchema.safeParse(this.form.getRawValue())
    if (!parsed.success) {
      const errors: FundSettingsFormErrors = {}
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof FundSettingsFormValue | undefined
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
