import type { ForgotPasswordFormValue } from './forgot-password-form.factory'

/**
 * Traduce los valores del formulario al payload de la solicitud de reset.
 * TypeScript puro — sin imports de Angular ni Supabase.
 */
export const forgotPasswordFormMapper = {
  /**
   * Valores del formulario → email normalizado para resetPasswordForEmail.
   */
  toResetRequest(value: ForgotPasswordFormValue): { email: string } {
    return {
      email: value.email.trim().toLowerCase(),
    }
  },
}
