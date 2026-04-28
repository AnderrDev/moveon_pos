'use client'

import { useState, useEffect, useTransition, useRef } from 'react'
import { useCartStore } from '../store/cart.store'
import { createSaleAction } from '../application/actions/sale.actions'
import { listClientesAction, type ClienteOption } from '@/modules/customers/application/actions/list-clientes.action'
import { Dialog } from '@/shared/components/ui/Dialog'
import { Button } from '@/shared/components/ui/Button'
import { cn } from '@/shared/lib/utils'
import { formatCurrency as formatCOP } from '@/shared/lib/format'
import { getPaymentMethodLabel, PAYMENT_METHOD_OPTIONS } from '@/shared/lib/payment-methods'
import type { PaymentMethod } from '@/shared/types'
import type { TicketData } from './SaleSuccessModal'

interface Props {
  open: boolean
  onClose: () => void
  cashSessionId: string
  onSuccess: (saleId: string, saleNumber: string, change: number, ticketData: TicketData) => void
}

export function PaymentModal({ open, onClose, cashSessionId, onSuccess }: Props) {
  const { items, totals, payments, addPayment, removePayment, clearPayments, totalPaid, remainingAmount, clearCart } = useCartStore()
  const [metodo, setMetodo] = useState<PaymentMethod>('cash')
  const [amount, setAmount] = useState('')
  const [error, setError]   = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  /* ── Cliente opcional ─────────────────────────────────── */
  const [allClientes, setAllClientes]           = useState<ClienteOption[]>([])
  const [clienteQuery, setClienteQuery]         = useState('')
  const [clienteDropOpen, setClienteDropOpen]   = useState(false)
  const [selectedCliente, setSelectedCliente]   = useState<ClienteOption | null>(null)
  const clienteRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open && allClientes.length === 0) {
      listClientesAction().then(setAllClientes)
    }
    if (!open) {
      setClienteQuery('')
      setSelectedCliente(null)
      setClienteDropOpen(false)
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const filteredClientes = clienteQuery.trim().length >= 1
    ? allClientes.filter((c) =>
        c.nombre.toLowerCase().includes(clienteQuery.toLowerCase()) ||
        (c.documento?.toLowerCase().includes(clienteQuery.toLowerCase()) ?? false)
      ).slice(0, 6)
    : []

  /* ── Totales ──────────────────────────────────────────── */
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
      clienteId: selectedCliente?.id,
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
      payments:       payments.map((p) => ({ metodo: p.metodo, amount: p.amount })),
      subtotal:       totals.subtotal,
      discountTotal:  totals.discountTotal,
      taxTotal:       totals.taxTotal,
      total:          totals.total,
      change,
      idempotencyKey: `${cashSessionId}-${Date.now()}`,
    }

    // Capturar datos del ticket antes de vaciar el carrito
    const ticketData: TicketData = {
      items:    items.map((i) => ({
        nombre:         i.nombre,
        sku:            i.sku,
        quantity:       i.quantity,
        unitPrice:      i.unitPrice,
        discountAmount: i.discountAmount,
        total:          i.total,
        ivaTasa:        i.ivaTasa,
      })),
      payments:      payments.map((p) => ({ metodo: p.metodo, amount: p.amount })),
      totals:        { ...totals },
      clienteNombre: selectedCliente?.nombre ?? null,
    }

    startTransition(async () => {
      const result = await createSaleAction(dto)
      if (result.error) { setError(result.error); return }
      clearCart()
      clearPayments()
      onSuccess(result.saleId!, result.saleNumber!, change, ticketData)
    })
  }

  function handleClose() {
    clearPayments()
    setAmount('')
    setError(null)
    onClose()
  }

  return (
    <Dialog open={open} onClose={handleClose} title="Cobrar venta" isBusy={isPending}>
      <div className="space-y-5">

        {/* ── Cliente opcional ─────────────────────────── */}
        <div ref={clienteRef} className="relative">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Cliente <span className="font-normal normal-case">(opcional)</span>
          </p>
          {selectedCliente ? (
            <div className="flex items-center justify-between rounded-lg border border-primary/40 bg-primary/5 px-3 py-2 text-sm">
              <div>
                <span className="font-medium text-foreground">{selectedCliente.nombre}</span>
                {selectedCliente.documento && (
                  <span className="ml-2 text-xs text-muted-foreground">{selectedCliente.documento}</span>
                )}
              </div>
              <button
                onClick={() => { setSelectedCliente(null); setClienteQuery('') }}
                className="ml-2 text-muted-foreground hover:text-destructive"
                aria-label="Quitar cliente"
              >
                <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" aria-hidden>
                  <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
          ) : (
            <>
              <input
                type="search"
                value={clienteQuery}
                onChange={(e) => { setClienteQuery(e.target.value); setClienteDropOpen(true) }}
                onFocus={() => clienteQuery && setClienteDropOpen(true)}
                onBlur={() => setTimeout(() => setClienteDropOpen(false), 150)}
                placeholder="Buscar por nombre o documento…"
                className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              {clienteDropOpen && filteredClientes.length > 0 && (
                <ul className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border bg-card shadow-lg">
                  {filteredClientes.map((c) => (
                    <li
                      key={c.id}
                      onMouseDown={() => { setSelectedCliente(c); setClienteQuery(''); setClienteDropOpen(false) }}
                      className="flex cursor-pointer items-center justify-between px-3 py-2 text-sm hover:bg-muted"
                    >
                      <span className="font-medium">{c.nombre}</span>
                      {c.documento && <span className="text-xs text-muted-foreground">{c.documento}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>

        {/* ── Resumen ─────────────────────────────────── */}
        <div className="rounded-xl bg-muted/50 px-4 py-3">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Total venta</span>
            <span className="font-semibold text-foreground">{formatCOP(totals.total)}</span>
          </div>
          {paid > 0 && (
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Pagado</span>
              <span className="font-semibold text-emerald-600">{formatCOP(paid)}</span>
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

        {/* ── Pagos registrados ────────────────────────── */}
        {payments.length > 0 && (
          <div className="space-y-1.5">
            {payments.map((p, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg border bg-background px-3 py-2 text-sm">
                <span className="font-medium">{getPaymentMethodLabel(p.metodo)}</span>
                <div className="flex items-center gap-3">
                  <span className="font-mono font-semibold tabular-nums">{formatCOP(p.amount)}</span>
                  <button onClick={() => removePayment(i)} className="text-muted-foreground hover:text-destructive">×</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Agregar pago ─────────────────────────────── */}
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Método de pago</p>
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
            {PAYMENT_METHOD_OPTIONS.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => setMetodo(m.value)}
                className={cn(
                  'rounded-lg border py-2 text-xs font-medium transition-colors',
                  metodo === m.value
                    ? 'border-primary bg-primary text-primary-foreground'
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
            <Button variant="outline" onClick={handleAddPayment} disabled={!amount || parseInt(amount, 10) <= 0}>
              Agregar
            </Button>
          </div>

          {remaining > 0 && (
            <button
              type="button"
              onClick={() => setAmount(String(remaining))}
              className="w-full rounded-lg border border-dashed py-2 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary"
            >
              Monto exacto: {formatCOP(remaining)}
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
            disabled={!canConfirm}
            isLoading={isPending}
            loadingText="Procesando…"
            className={cn(!canConfirm && 'opacity-50 cursor-not-allowed')}
          >
            Confirmar · {formatCOP(totals.total)}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
