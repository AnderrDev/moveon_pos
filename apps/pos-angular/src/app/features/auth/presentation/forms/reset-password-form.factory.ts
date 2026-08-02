import { z } from 'zod'

// ── Schema del formulario ─────────────────────────────────────────────────────

export const resetPasswordFormSchema = z
  .object({
    password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
    confirmPassword: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  })

// ── Tipos derivados ───────────────────────────────────────────────────────────

export type ResetPasswordFormValue = z.infer<typeof resetPasswordFormSchema>

// ── Valores por defecto ───────────────────────────────────────────────────────

export function createResetPasswordFormDefaults(
  initial: Partial<ResetPasswordFormValue> = {},
): ResetPasswordFormValue {
  return {
    password: initial.password ?? '',
    confirmPassword: initial.confirmPassword ?? '',
  }
}
