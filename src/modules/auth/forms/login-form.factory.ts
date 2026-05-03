import { z } from 'zod'

// ── Schema del formulario ─────────────────────────────────────────────────────

export const loginFormSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'El correo es obligatorio')
    .email('Ingresa un correo electrónico válido'),

  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
})

// ── Tipos derivados ───────────────────────────────────────────────────────────

export type LoginFormValue = z.infer<typeof loginFormSchema>

// ── Valores por defecto ───────────────────────────────────────────────────────

export function createLoginFormDefaults(
  initial: Partial<LoginFormValue> = {},
): LoginFormValue {
  return {
    email: initial.email ?? '',
    password: initial.password ?? '',
  }
}
