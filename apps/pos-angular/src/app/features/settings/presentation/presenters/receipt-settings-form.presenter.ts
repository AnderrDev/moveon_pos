import { inject, Injectable, signal } from '@angular/core'
import { NonNullableFormBuilder } from '@angular/forms'
import {
  createReceiptSettingsFormDefaults,
  receiptSettingsFormSchema,
  type ReceiptSettingsFormValue,
} from '@angular-app/features/settings/presentation/forms/receipt-settings-form.factory'

type ReceiptSettingsFormErrors = Partial<
  Record<keyof ReceiptSettingsFormValue | 'root', string>
>

@Injectable()
export class ReceiptSettingsFormPresenter {
  private readonly fb = inject(NonNullableFormBuilder)

  readonly errors = signal<ReceiptSettingsFormErrors>({})
  readonly form = this.fb.group(createReceiptSettingsFormDefaults())

  reset(initial: Partial<ReceiptSettingsFormValue> = {}): void {
    this.form.reset(createReceiptSettingsFormDefaults(initial))
    this.errors.set({})
  }

  validate(): ReceiptSettingsFormValue | null {
    this.form.markAllAsTouched()
    const parsed = receiptSettingsFormSchema.safeParse(this.form.getRawValue())
    if (!parsed.success) {
      const errors: ReceiptSettingsFormErrors = {}
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof ReceiptSettingsFormValue | undefined
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
