import { inject, Injectable, signal } from '@angular/core'
import { NonNullableFormBuilder } from '@angular/forms'
import {
  createLoyaltySettingsFormDefaults,
  loyaltySettingsFormSchema,
  type LoyaltySettingsFormValue,
} from '@/modules/settings/forms/loyalty-settings-form.factory'

type LoyaltySettingsFormErrors = Partial<
  Record<keyof LoyaltySettingsFormValue | 'root', string>
>

@Injectable()
export class LoyaltySettingsFormPresenter {
  private readonly fb = inject(NonNullableFormBuilder)

  readonly errors = signal<LoyaltySettingsFormErrors>({})
  readonly form = this.fb.group(createLoyaltySettingsFormDefaults())

  reset(initial: Partial<LoyaltySettingsFormValue> = {}): void {
    this.form.reset(createLoyaltySettingsFormDefaults(initial))
    this.errors.set({})
  }

  validate(): LoyaltySettingsFormValue | null {
    this.form.markAllAsTouched()
    const parsed = loyaltySettingsFormSchema.safeParse(this.form.getRawValue())
    if (!parsed.success) {
      const errors: LoyaltySettingsFormErrors = {}
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof LoyaltySettingsFormValue | undefined
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
