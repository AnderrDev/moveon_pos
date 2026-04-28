'use client'

import { useActionState, useState } from 'react'
import { closeSessionAction } from '../application/actions/cash-register.actions'
import { Dialog } from '@/shared/components/ui/Dialog'
import { Button } from '@/shared/components/ui/Button'
import { SubmitButton } from '@/shared/components/forms/SubmitButton'
import { useActionFeedback } from '@/shared/hooks/use-action-feedback'
import { cn } from '@/shared/lib/utils'
import { formatCurrency as formatCOP } from '@/shared/lib/format'
import { PAYMENT_METHOD_CLOSURE_OPTIONS } from '@/shared/lib/payment-methods'
import type { CashSessionPaymentBreakdown } from '../domain/repositories/cash-register.repository'

interface Props {
  sessionId: string
  openingAmount: number
  cashMovementNet: number
  expectedCashAmount: number
  expectedSalesAmount: number
  paymentBreakdown: CashSessionPaymentBreakdown[]
}

const INITIAL = { error: null }
const isDev = process.env.NODE_ENV === 'development'
const inputCls = cn(
  'h-10 w-full rounded-lg border border-input bg-card px-3 text-sm shadow-sm',
  'placeholder:text-muted-foreground/60',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
)

const digitalMethods = PAYMENT_METHOD_CLOSURE_OPTIONS.filter((method) => method.value !== 'cash')
const fieldNameByMethod: Record<string, string> = {
  card:      'actualCardAmount',
  nequi:     'actualNequiAmount',
  daviplata: 'actualDaviplataAmount',
  transfer:  'actualTransferAmount',
  other:     'actualOtherAmount',
}

function amountFromInput(value: string): number {
  return Number(value || 0)
}

export function CloseSessionDialog({
  sessionId,
  openingAmount,
  cashMovementNet,
  expectedCashAmount,
  expectedSalesAmount,
  paymentBreakdown,
}: Props) {
  const [open, setOpen] = useState(false)
  const boundAction = closeSessionAction.bind(null, sessionId)
  const [state, action, pending] = useActionState(boundAction, INITIAL)
  const expectedByMethod = new Map(paymentBreakdown.map((payment) => [payment.metodo, payment.total]))
  const [cashCount, setCashCount] = useState(isDev ? String(expectedCashAmount) : '')
  const [digitalAmounts, setDigitalAmounts] = useState<Record<string, string>>(() => Object.fromEntries(
    digitalMethods.map((method) => [method.value, isDev ? String(expectedByMethod.get(method.value) ?? 0) : '']),
  ))

  const actualCashAmount = amountFromInput(cashCount)
  const actualCashSales = actualCashAmount - openingAmount - cashMovementNet
  const actualDigitalTotal = digitalMethods.reduce((sum, method) => sum + amountFromInput(digitalAmounts[method.value] ?? ''), 0)
  const actualSalesAmount = actualCashSales + actualDigitalTotal
  const cashDifference = expectedCashAmount - actualCashAmount
  const salesDifference = expectedSalesAmount - actualSalesAmount

  useActionFeedback({
    state,
    pending,
    onSuccess: () => setOpen(false),
    successMessage: 'Caja cerrada correctamente',
    showErrorToast: true,
  })

  return (
    <>
      <Button variant="destructive" onClick={() => setOpen(true)}>Cerrar caja</Button>

      <Dialog open={open} onClose={() => setOpen(false)} title="Cerrar caja" isBusy={pending}>
        <form action={action} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border bg-muted/40 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ventas esperadas</p>
              <p className="mt-1 font-display text-2xl font-bold tabular-nums">{formatCOP(expectedSalesAmount)}</p>
            </div>
            <div className="rounded-lg border bg-muted/40 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ventas confirmadas</p>
              <p className={`mt-1 font-display text-2xl font-bold tabular-nums ${salesDifference === 0 ? 'text-foreground' : 'text-destructive'}`}>
                {formatCOP(actualSalesAmount)}
              </p>
            </div>
          </div>

          <div>
            <label htmlFor="close-cash" className="mb-1.5 block text-sm font-medium text-foreground">
              Efectivo contado en caja <span className="text-destructive">*</span>
            </label>
            <input
              id="close-cash"
              name="actualCashAmount"
              type="number"
              inputMode="numeric"
              min="0"
              step="1"
              placeholder="0"
              value={cashCount}
              onChange={(event) => setCashCount(event.target.value)}
              required
              className={inputCls}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Esperado físico: {formatCOP(expectedCashAmount)}. Incluye base, ventas en efectivo y movimientos.
            </p>
          </div>

          <div className="rounded-lg border">
            <div className="border-b px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Confirmación por medios no efectivo</p>
            </div>
            <div className="divide-y">
              {digitalMethods.map((method) => {
                const expected = expectedByMethod.get(method.value) ?? 0

                return (
                  <label key={method.value} className="grid gap-2 px-4 py-3 sm:grid-cols-[1fr_150px] sm:items-center">
                    <span>
                      <span className="block text-sm font-medium text-foreground">{method.label}</span>
                      <span className="text-xs text-muted-foreground">Esperado: {formatCOP(expected)}</span>
                    </span>
                    <input
                      name={fieldNameByMethod[method.value]}
                      type="number"
                      inputMode="numeric"
                      min="0"
                      step="1"
                      placeholder="0"
                      value={digitalAmounts[method.value] ?? ''}
                      onChange={(event) => setDigitalAmounts((current) => ({
                        ...current,
                        [method.value]: event.target.value,
                      }))}
                      className={inputCls}
                    />
                  </label>
                )
              })}
            </div>
          </div>

          <div className="grid gap-2 rounded-lg bg-muted/50 px-4 py-3 text-sm sm:grid-cols-2">
            <div>
              <span className="text-muted-foreground">Diferencia ventas:</span>{' '}
              <span className={`font-semibold tabular-nums ${salesDifference === 0 ? 'text-foreground' : 'text-destructive'}`}>
                {formatCOP(salesDifference)}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Diferencia efectivo físico:</span>{' '}
              <span className={`font-semibold tabular-nums ${cashDifference === 0 ? 'text-foreground' : 'text-destructive'}`}>
                {formatCOP(cashDifference)}
              </span>
            </div>
          </div>

          <div>
            <label htmlFor="close-notes" className="mb-1.5 block text-sm font-medium text-foreground">Notas de cierre</label>
            <textarea
              id="close-notes"
              name="notasCierre"
              placeholder="Obligatorio si hay diferencias mayores a $5.000"
              rows={3}
              maxLength={500}
              className={cn(inputCls, 'h-auto py-2')}
            />
          </div>

          {state.error && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>Cancelar</Button>
            <SubmitButton variant="destructive" isLoading={pending} loadingText="Cerrando…">Confirmar cierre</SubmitButton>
          </div>
        </form>
      </Dialog>
    </>
  )
}
