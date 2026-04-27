'use client'

import { useActionState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { loginFormSchema, createLoginFormDefaults, type LoginFormValue } from '../forms/login-form.factory'
import { signInAction, type SignInActionState } from '../application/actions/sign-in.action'

const initialState: SignInActionState = { error: null }

export function useLoginForm() {
  const [actionState, formAction, isPending] = useActionState(signInAction, initialState)

  const form = useForm<LoginFormValue>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: createLoginFormDefaults(),
  })

  return {
    form,
    formAction,
    isPending,
    serverError: actionState.error,
  }
}
