import type { LoginFormValue } from '@angular-app/features/auth/presentation/forms/login-form.factory'

/**
 * Traduce los valores del formulario al payload de la Server Action.
 * Sin imports de React — TypeScript puro.
 */
export const loginFormMapper = {

  /**
   * Valores del formulario → credenciales para signInWithPassword.
   */
  toSignInPayload(value: LoginFormValue): { email: string; password: string } {
    return {
      email:    value.email.trim().toLowerCase(),
      password: value.password,
    }
  },
}
