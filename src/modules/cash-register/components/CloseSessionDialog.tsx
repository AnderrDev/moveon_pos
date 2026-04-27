'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { closeSessionAction } from '../application/actions/cash-register.actions'
import { Dialog } from '@/shared/components/ui/Dialog'
import { Button } from '@/shared/components/ui/Button'
import { SubmitButton } from '@/shared/components/forms/SubmitButton'
import { cn } from '@/shared/lib/utils'

interface Props {
  sessionId: string
  expectedAmount: number
}

function formatCOP(value: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value)
}

const INITIAL = { error: null }
const isDev = process.env.NODE_ENV === 'development'
const inputCls = cn(
  'h-10 w-full rounded-lg border border-input bg-card px-3 text-sm shadow-sm',
  'placeholder:text-muted-foreground/60',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
)

export function CloseSessionDialog({ sessionId, expectedAmount }: Props) {
  const [open, setOpen] = useState(false)
  const boundAction = closeSessionAction.bind(null, sessionId)
  const [state, action, pending] = useActionState(boundAction, INITIAL)
  const prevPending = useRef(false)

  useEffect(() => {
    if (prevPending.current && !pending && !state.error) setOpen(false)
    prevPending.current = pending
  }, [pending, state.error])

  return (
    <>
      <Button variant="destructive" onClick={() => setOpen(true)}>Cerrar caja</Button>

      <Dialog open={open} onClose={() => setOpen(false)} title="Cerrar caja">
        <form action={action} className="space-y-4">
          <div className="rounded-lg bg-muted/60 px-4 py-3 text-sm">
            <span className="text-muted-foreground">Efectivo esperado:</span>{' '}
            <span className="font-semibold">{formatCOP(expectedAmount)}</span>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              Efectivo contado en caja <span className="text-destructive">*</span>
            </label>
            <input name="actualCashAmount" type="number" min="0" step="1" placeholder="0" defaultValue={isDev ? String(expectedAmount) : undefined} required className={inputCls} />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">Notas de cierre (opcional)</label>
            <textarea
              name="notasCierre"
              placeholder="Observaciones del turno…"
              rows={3}
              maxLength={500}
              className={cn(inputCls, 'h-auto py-2')}
            />
          </div>

          {state.error && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <SubmitButton variant="destructive">Confirmar cierre</SubmitButton>
          </div>
        </form>
      </Dialog>
    </>
  )
}
