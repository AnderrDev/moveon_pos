'use client'

import { useState, useEffect, useTransition, useCallback } from 'react'
import { listSessionSalesAction, type SessionSaleRow } from '../application/actions/list-session-sales.action'
import { voidSaleAction } from '../application/actions/sale.actions'
import { cn } from '@/shared/lib/utils'

function formatCOP(v: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v)
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
}

const METODO_LABEL: Record<string, string> = {
  cash: 'Efectivo', card: 'Tarjeta', nequi: 'Nequi',
  daviplata: 'Daviplata', transfer: 'Transferencia',
}

interface Props {
  cashSessionId: string
  refreshTrigger: number
}

export function SalesHistory({ cashSessionId, refreshTrigger }: Props) {
  const [sales, setSales]     = useState<SessionSaleRow[]>([])
  const [loading, setLoading] = useState(true)
  const [voidTarget, setVoidTarget] = useState<SessionSaleRow | null>(null)
  const [voidReason, setVoidReason] = useState('')
  const [voidError, setVoidError]   = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const load = useCallback(async () => {
    setLoading(true)
    const data = await listSessionSalesAction(cashSessionId)
    setSales(data)
    setLoading(false)
  }, [cashSessionId])

  useEffect(() => { load() }, [load, refreshTrigger])

  function handleVoid(sale: SessionSaleRow) {
    setVoidTarget(sale)
    setVoidReason('')
    setVoidError(null)
  }

  function handleConfirmVoid() {
    if (!voidTarget || !voidReason.trim()) return
    const formData = new FormData()
    formData.set('saleId', voidTarget.id)
    formData.set('voidedReason', voidReason)
    startTransition(async () => {
      const result = await voidSaleAction({ error: null }, formData)
      if (result.error) { setVoidError(result.error); return }
      setVoidTarget(null)
      load()
    })
  }

  const totalVentas = sales.filter((s) => s.status === 'completed').reduce((s, v) => s + v.total, 0)

  return (
    <div className="flex h-full flex-col">
      <div className="border-b px-4 py-3 flex items-center justify-between">
        <div>
          <h2 className="font-display text-sm font-bold uppercase tracking-wide text-muted-foreground">
            Historial del turno
          </h2>
          {sales.length > 0 && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {sales.filter((s) => s.status === 'completed').length} venta{sales.filter((s) => s.status === 'completed').length !== 1 ? 's' : ''} · {formatCOP(totalVentas)}
            </p>
          )}
        </div>
        <button onClick={load} className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors" title="Actualizar">
          <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" aria-hidden>
            <path d="M14 8A6 6 0 112 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M14 4v4h-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">Cargando…</div>
        ) : sales.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center px-4">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-muted-foreground" aria-hidden>
                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <rect x="9" y="3" width="6" height="4" rx="1" stroke="currentColor" strokeWidth="1.5"/>
              </svg>
            </div>
            <p className="text-sm text-muted-foreground">Sin ventas en este turno</p>
          </div>
        ) : (
          <div className="divide-y">
            {sales.map((sale) => (
              <div key={sale.id} className={cn('px-4 py-3', sale.status === 'voided' && 'opacity-50')}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-foreground">#{sale.saleNumber}</span>
                      {sale.status === 'voided' && (
                        <span className="rounded-full bg-destructive/10 px-1.5 py-0.5 text-[10px] font-semibold text-destructive">Anulada</span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {formatTime(sale.createdAt)} · {sale.itemCount} ítem{sale.itemCount !== 1 ? 's' : ''} · {sale.payments.map((p) => METODO_LABEL[p.metodo] ?? p.metodo).join(', ')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="font-semibold tabular-nums text-sm">{formatCOP(sale.total)}</span>
                    {sale.status === 'completed' && (
                      <button
                        onClick={() => handleVoid(sale)}
                        className="rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        title="Anular venta"
                      >
                        <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" aria-hidden>
                          <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.25"/>
                          <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dialog de anulación (inline) */}
      {voidTarget && (
        <div className="border-t bg-card p-4 space-y-3">
          <p className="text-sm font-semibold text-foreground">Anular venta #{voidTarget.saleNumber}</p>
          <input
            type="text"
            placeholder="Motivo de anulación"
            value={voidReason}
            onChange={(e) => setVoidReason(e.target.value)}
            className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          {voidError && <p className="text-xs text-destructive">{voidError}</p>}
          <div className="flex gap-2">
            <button
              onClick={() => setVoidTarget(null)}
              className="flex-1 rounded-lg border py-1.5 text-sm font-medium hover:bg-muted transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirmVoid}
              disabled={!voidReason.trim() || isPending}
              className="flex-1 rounded-lg bg-destructive py-1.5 text-sm font-medium text-white disabled:opacity-50 hover:bg-destructive/90 transition-colors"
            >
              {isPending ? 'Anulando…' : 'Confirmar'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
