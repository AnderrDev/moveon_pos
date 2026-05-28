import type { ResetPasswordFormValue } from './reset-password-form.factory'

/**
 * Traduce los valores del formulario al payload de actualización de contraseña.
 * TypeScript puro — sin imports de Angular ni Supabase.
 */
export const resetPasswordFormMapper = {
  /**
   * Valores del formulario → payload para updateUser.
   * Solo se envía la nueva contraseña; `confirmPassword` es validación de UI.
   */
  toUpdatePayload(value: ResetPasswordFormValue): { password: string } {
    return {
      password: value.password,
    }
  },
}
