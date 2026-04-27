'use client'

import { FormInput, SubmitButton, FormError } from '@/shared/components/forms'
import { useLoginForm } from './hooks/use-login-form'

export function LoginForm() {
  const { form, formAction, isPending, serverError } = useLoginForm()

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <FormInput
        control={form.control}
        name="email"
        label="Correo electrónico"
        type="email"
        placeholder="tu@correo.com"
        autoComplete="email"
        required
      />

      <FormInput
        control={form.control}
        name="password"
        label="Contraseña"
        type="password"
        placeholder="••••••••"
        autoComplete="current-password"
        required
      />

      {serverError && <FormError message={serverError} />}

      <SubmitButton
        isLoading={isPending}
        size="full"
        className="mt-2"
      >
        Iniciar sesión
      </SubmitButton>
    </form>
  )
}
