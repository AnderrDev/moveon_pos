import { inject, Injectable, signal } from '@angular/core'
import { NonNullableFormBuilder } from '@angular/forms'
import { cashHistoryFormSchema, createCashHistoryFormDefaults, type CashHistoryFormValue } from '../forms/cash-history-form.factory'
import { resolveCashHistoryPreset, type CashHistoryPreset } from '../../domain/services/cash-history'
@Injectable()
export class CashHistoryFormPresenter {
  private readonly fb = inject(NonNullableFormBuilder)
  private today = new Date().toISOString().slice(0, 10)
  readonly form = this.fb.group(createCashHistoryFormDefaults(this.today))
  readonly errors = signal<Partial<Record<keyof CashHistoryFormValue, string>>>({})
  reset(today = this.today): void {
    this.today = today
    this.form.reset(createCashHistoryFormDefaults(today))
    this.errors.set({})
  }
  setPreset(preset: Exclude<CashHistoryPreset, 'custom'>): void {
    this.form.patchValue({ preset, ...resolveCashHistoryPreset(this.today, preset) })
  }
  setCustom(): void { this.form.controls.preset.setValue('custom') }
  validate(): CashHistoryFormValue | null {
    const result = cashHistoryFormSchema.safeParse(this.form.getRawValue())
    this.form.markAllAsTouched()
    if (!result.success) {
      const errors: Partial<Record<keyof CashHistoryFormValue, string>> = {}
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof CashHistoryFormValue
        errors[key] ??= issue.message
      }
      this.errors.set(errors)
      return null
    }
    this.errors.set({})
    return result.data
  }
}
