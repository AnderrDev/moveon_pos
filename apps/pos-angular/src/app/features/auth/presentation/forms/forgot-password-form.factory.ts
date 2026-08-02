import { z } from 'zod'

// ── Schema del formulario ─────────────────────────────────────────────────────

export const forgotPasswordFormSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'El correo es obligatorio')
    .email('Ingresa un correo electrónico válido'),
})

// ── Tipos derivados ───────────────────────────────────────────────────────────

export type ForgotPasswordFormValue = z.infer<typeof forgotPasswordFormSchema>

// ── Valores por defecto ───────────────────────────────────────────────────────

export function createForgotPasswordFormDefaults(
  initial: Partial<ForgotPasswordFormValue> = {},
): ForgotPasswordFormValue {
  return {
    email: initial.email ?? '',
  }
}
