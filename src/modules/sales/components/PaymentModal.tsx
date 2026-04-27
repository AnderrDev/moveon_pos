'use client'

import { useState, useTransition } from 'react'
import { useCartStore } from '../store/cart.store'
import { createSaleAction } from '../application/actions/sale.actions'
import { Dialog } from '@/shared/components/ui/Dialog'
import { Button } from '@/shared/components/ui/Button'
import { cn } from '@/shared/lib/utils'
import type { PaymentMethod } from '@/shared/types'

function formatCOP(v: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v)
}

const METODOS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash',      label: 'Efectivo' },
  { value: 'card',      label: 'Tarjeta' },
  { value: 'nequi',     label: 'Nequi' },
  { value: 'daviplata', label: 'Daviplata' },
  { value: 'transfer',  label: 'Transferencia' },
]

interface Props {
  open: boolean
  onClose: () => void
  cashSessionId: string
  onSuccess: (saleId: string, saleNumber: string, change: number) => void
}

export function PaymentModal({ open, onClose, cashSessionId, onSuccess }: Props) {
  const { items, totals, payments, addPayment, removePayment, clearPayments, totalPaid, remainingAmount, clearCart } = useCartStore()
  const [metodo, setMetodo] = useState<PaymentMethod>('cash')
  const [amount, setAmount] = useState('')
  const [error, setError]   = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const paid      = totalPaid()
  const remaining = remainingAmount()
  const change    = paid > totals.total ? paid - totals.total : 0
  const canConfirm = paid >= totals.total && items.length > 0

  function handleAddPayment() {
    const amt = parseInt(amount.replace(/\D/g, ''), 10)
    if (!amt || amt <= 0) return
    addPayment({ metodo, amount: amt })
    setAmount('')
  }

  function handleConfirm() {
    if (!canConfirm) return
    setError(null)

    const dto = {
      cashSessionId,
      items: items.map((i) => ({
        productId:      i.productId,
        productoNombre: i.nombre,
        productoSku:    i.sku,
        quantity:       i.quantity,
        unitPrice:      i.unitPrice,
        discountAmount: i.discountAmount,
        taxRate:        i.ivaTasa,
        taxAmount:      i.taxAmount,
        total:          i.total,
      })),
      payments: payments.map((p) => ({ metodo: p.metodo, amount: p.amount })),
      subtotal:       totals.subtotal,
      discountTotal:  totals.discountTotal,
      taxTotal:       totals.taxTotal,
      total:          totals.total,
      change,
      idempotencyKey: `${cashSessionId}-${Date.now()}`,
    }

    startTransition(async () => {
      const result = await createSaleAction(dto)
      if (result.error) {
        setError(result.error)
        return
      }
      clearCart()
      clearPayments()
      onSuccess(result.saleId!, result.saleNumber!, change)
    })
  }

  function handleClose() {
    clearPayments()
    setAmount('')
    setError(null)
    onClose()
  }

  return (
    <Dialog open={open} onClose={handleClose} title="Cobrar venta">
      <div className="space-y-5">
        {/* Resumen */}
        <div className="rounded-xl bg-muted/50 px-4 py-3">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Total venta</span>
            <span className="font-semibold text-foreground">{formatCOP(totals.total)}</span>
          </div>
          {paid > 0 && (
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Pagado</span>
              <span className="font-semibold text-green-600">{formatCOP(paid)}</span>
            </div>
          )}
          {remaining > 0 && (
            <div className="mt-1 flex justify-between text-sm font-semibold">
              <span className="text-foreground">Falta</span>
              <span className="text-destructive">{formatCOP(remaining)}</span>
            </div>
          )}
          {change > 0 && (
            <div className="mt-1 flex justify-between font-display font-bold">
              <span>Cambio</span>
              <span className="text-primary">{formatCOP(change)}</span>
            </div>
          )}
        </div>

        {/* Pagos registrados */}
        {payments.length > 0 && (
          <div className="space-y-1.5">
            {payments.map((p, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg border bg-background px-3 py-2 text-sm">
                <span className="font-medium capitalize">{METODOS.find((m) => m.value === p.metodo)?.label ?? p.metodo}</span>
                <div className="flex items-center gap-3">
                  <span className="font-mono font-semibold tabular-nums">{formatCOP(p.amount)}</span>
                  <button onClick={() => removePayment(i)} className="text-muted-foreground hover:text-destructive">×</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Agregar pago */}
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Agregar pago</p>
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
            {METODOS.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => setMetodo(m.value)}
                className={cn(
                  'rounded-lg border py-2 text-xs font-medium transition-colors',
                  metodo === m.value
                    ? 'border-primary bg-primary text-white'
                    : 'border-border bg-background hover:bg-muted',
                )}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
              placeholder={remaining > 0 ? String(remaining) : '0'}
              onKeyDown={(e) => e.key === 'Enter' && handleAddPayment()}
              className={cn(
                'h-10 flex-1 rounded-lg border border-input bg-card px-3 text-sm',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              )}
            />
            <Button
              variant="outline"
              onClick={handleAddPayment}
              disabled={!amount || parseInt(amount, 10) <= 0}
            >
              Agregar
            </Button>
          </div>

          {/* Atajo: monto exacto */}
          {remaining > 0 && (
            <button
              type="button"
              onClick={() => { setAmount(String(remaining)); }}
              className="w-full rounded-lg border border-dashed py-2 text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors"
            >
              Agregar monto exacto: {formatCOP(remaining)}
            </button>
          )}
        </div>

        {error && (
          <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={handleClose} disabled={isPending}>Cancelar</Button>
          <Button
            onClick={handleConfirm}
            disabled={!canConfirm || isPending}
            className={cn(!canConfirm && 'opacity-50 cursor-not-allowed')}
          >
            {isPending ? 'Procesando…' : `Confirmar venta · ${formatCOP(totals.total)}`}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
