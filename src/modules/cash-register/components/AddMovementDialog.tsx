'use client'

import { useActionState, useState } from 'react'
import { addCashMovementAction } from '../application/actions/cash-register.actions'
import { Dialog } from '@/shared/components/ui/Dialog'
import { Button } from '@/shared/components/ui/Button'
import { SubmitButton } from '@/shared/components/forms/SubmitButton'
import { useActionFeedback } from '@/shared/hooks/use-action-feedback'
import { cn } from '@/shared/lib/utils'

interface Props { sessionId: string }

type MovType = 'cash_in' | 'cash_out' | 'expense'
const INITIAL = { error: null }
const isDev = process.env.NODE_ENV === 'development'
const inputCls = cn(
  'h-10 w-full rounded-lg border border-input bg-card px-3 text-sm shadow-sm',
  'placeholder:text-muted-foreground/60',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
)

export function AddMovementDialog({ sessionId }: Props) {
  const [open, setOpen] = useState(false)
  const [tipo, setTipo] = useState<MovType>('cash_in')
  const boundAction = addCashMovementAction.bind(null, sessionId)
  const [state, action, pending] = useActionState(boundAction, INITIAL)

  useActionFeedback({
    state,
    pending,
    onSuccess: () => setOpen(false),
    successMessage: 'Movimiento registrado',
    showErrorToast: true,
  })

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>+ Movimiento</Button>

      <Dialog open={open} onClose={() => setOpen(false)} title="Registrar movimiento" isBusy={pending}>
        <form action={action} className="space-y-4">
          <input type="hidden" name="tipo" value={tipo} />

          <div>
            <p className="mb-2 text-sm font-medium text-foreground">Tipo de movimiento</p>
            <div className="grid grid-cols-3 gap-2">
              {([
                { value: 'cash_in',  label: 'Ingreso' },
                { value: 'cash_out', label: 'Egreso' },
                { value: 'expense',  label: 'Gasto' },
              ] as { value: MovType; label: string }[]).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setTipo(opt.value)}
                  className={cn(
                    'rounded-lg border py-2 text-sm font-medium transition-colors',
                    tipo === opt.value
                      ? 'border-primary bg-primary text-white'
                      : 'border-border bg-background text-foreground hover:bg-muted',
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="mov-amount" className="mb-1.5 block text-sm font-medium text-foreground">
              Monto <span className="text-destructive">*</span>
            </label>
            <input id="mov-amount" name="amount" type="number" inputMode="numeric" min="1" step="1" placeholder="0" defaultValue={isDev ? '10000' : undefined} required className={inputCls} />
          </div>

          <div>
            <label htmlFor="mov-motivo" className="mb-1.5 block text-sm font-medium text-foreground">
              Motivo <span className="text-destructive">*</span>
            </label>
            <input id="mov-motivo" name="motivo" type="text" placeholder="Ej. Compra de bolsas, vuelto cliente" defaultValue={isDev ? 'Prueba movimiento' : undefined} required minLength={3} maxLength={200} className={inputCls} />
          </div>

          {state.error && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>Cancelar</Button>
            <SubmitButton isLoading={pending} loadingText="Registrando…">Registrar</SubmitButton>
          </div>
        </form>
      </Dialog>
    </>
  )
}
