'use client'

import { useActionState } from 'react'
import { openSessionAction } from '../application/actions/cash-register.actions'
import { SubmitButton } from '@/shared/components/forms/SubmitButton'
import { useActionFeedback } from '@/shared/hooks/use-action-feedback'
import { cn } from '@/shared/lib/utils'

const INITIAL = { error: null }
const isDev = process.env.NODE_ENV === 'development'
const inputCls = cn(
  'h-10 w-full rounded-lg border border-input bg-card px-3 text-sm shadow-sm',
  'placeholder:text-muted-foreground/60',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
)

export function OpenSessionForm() {
  const [state, action, pending] = useActionState(openSessionAction, INITIAL)

  useActionFeedback({
    state,
    pending,
    successMessage: 'Caja abierta correctamente',
    showErrorToast: true,
  })

  return (
    <div className="mx-auto max-w-md">
      <div className="rounded-2xl border bg-card p-8 shadow-sm">
        <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
          <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7 text-primary" aria-hidden>
            <rect x="2" y="7" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.75"/>
            <path d="M16 11a4 4 0 11-8 0" stroke="currentColor" strokeWidth="1.75"/>
            <path d="M6 7V5a2 2 0 014 0v2M14 7V5a2 2 0 014 0v2" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
          </svg>
        </div>
        <h2 className="font-display text-xl font-bold text-foreground">Abrir caja</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Ingresa el efectivo con el que abre el turno.
        </p>

        <form action={action} className="mt-6 space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              Monto de apertura <span className="text-destructive">*</span>
            </label>
            <input
              name="openingAmount"
              type="number"
              min="0"
              step="1"
              placeholder="0"
              defaultValue={isDev ? '50000' : undefined}
              required
              className={inputCls}
            />
          </div>

          {state.error && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {state.error}
            </p>
          )}

          <SubmitButton className="w-full" isLoading={pending} loadingText="Abriendo caja…">
            Abrir caja
          </SubmitButton>
        </form>
      </div>
    </div>
  )
}
