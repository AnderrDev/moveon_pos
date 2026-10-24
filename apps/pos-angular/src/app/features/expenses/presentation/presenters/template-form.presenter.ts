import { inject, Injectable, signal } from '@angular/core'
import { NonNullableFormBuilder } from '@angular/forms'
import {
  templateFormSchema,
  createTemplateFormDefaults,
  type TemplateFormValue,
} from '@angular-app/features/expenses/presentation/forms/template-form.factory'

type TemplateFormErrors = Partial<Record<keyof TemplateFormValue | 'root', string>>

@Injectable()
export class TemplateFormPresenter {
  private readonly fb = inject(NonNullableFormBuilder)

  readonly errors = signal<TemplateFormErrors>({})
  readonly form = this.fb.group(createTemplateFormDefaults())

  reset(initial: Partial<TemplateFormValue> = {}): void {
    this.form.reset(createTemplateFormDefaults(initial))
    this.errors.set({})
  }

  validate(): TemplateFormValue | null {
    this.form.markAllAsTouched()
    const parsed = templateFormSchema.safeParse(this.form.getRawValue())
    if (!parsed.success) {
      const errors: TemplateFormErrors = {}
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof TemplateFormValue | undefined
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
