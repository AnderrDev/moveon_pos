'use client'

import { useState } from 'react'
import { useCartStore } from '../store/cart.store'
import { Button } from '@/shared/components/ui/Button'
import { cn } from '@/shared/lib/utils'
import { formatCurrency as formatCOP } from '@/shared/lib/format'

interface Props {
  onCheckout: () => void
  disabled?: boolean
}

export function CartPanel({ onCheckout, disabled }: Props) {
  const { items, totals, updateQuantity, removeItem, updateDiscount } = useCartStore()
  const [discountTarget, setDiscountTarget] = useState<string | null>(null)
  const [discountInput, setDiscountInput]   = useState('')

  function openDiscount(key: string, current: number) {
    setDiscountTarget(key)
    setDiscountInput(current > 0 ? String(current) : '')
  }

  function applyDiscount(key: string) {
    const val = parseInt(discountInput.replace(/\D/g, ''), 10)
    updateDiscount(key, isNaN(val) ? 0 : val)
    setDiscountTarget(null)
    setDiscountInput('')
  }

  /* ── Empty state ──────────────────────────────────────── */
  if (items.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 py-16 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
          <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-muted-foreground" aria-hidden>
            <path
              d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"
              stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
            />
            <line x1="3" y1="6" x2="21" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M16 10a4 4 0 01-8 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Carrito vacío</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Selecciona un producto del catálogo
          </p>
        </div>
      </div>
    )
  }

  /* ── Ítems ────────────────────────────────────────────── */
  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto">
        <div className="divide-y">
          {items.map((item) => (
            <div key={item.key} className="px-4 py-3.5">

              {/* Nombre + eliminar */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{item.nombre}</p>
                  {item.sku && (
                    <p className="font-mono text-[11px] text-muted-foreground">{item.sku}</p>
                  )}
                </div>
                <button
                  onClick={() => removeItem(item.key)}
                  aria-label="Eliminar del carrito"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                >
                  <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" aria-hidden>
                    <path
                      d="M2 4h12M5 4V2h6v2M6 7v6M10 7v6M3 4l1 9h8l1-9"
                      stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>

              {/* Cantidad + precio */}
              <div className="mt-2.5 flex items-center justify-between gap-2">
                {/* Stepper de cantidad */}
                <div className="flex items-center rounded-lg border bg-background">
                  <button
                    onClick={() => updateQuantity(item.key, item.quantity - 1)}
                    aria-label="Reducir cantidad"
                    className="flex h-9 w-9 items-center justify-center rounded-l-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" aria-hidden>
                      <path d="M2 8h12" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
                    </svg>
                  </button>
                  <span className="w-9 text-center text-sm font-bold tabular-nums">
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => updateQuantity(item.key, item.quantity + 1)}
                    aria-label="Aumentar cantidad"
                    className="flex h-9 w-9 items-center justify-center rounded-r-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" aria-hidden>
                      <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
                    </svg>
                  </button>
                </div>

                {/* Precios */}
                <div className="text-right">
                  <p className="text-sm font-bold tabular-nums text-foreground">
                    {formatCOP(item.total)}
                  </p>
                  <p className="text-[11px] tabular-nums text-muted-foreground">
                    {formatCOP(item.unitPrice)} × {item.quantity}
                    {item.ivaTasa > 0 && ` · IVA ${item.ivaTasa}%`}
                  </p>
                </div>
              </div>

              {/* Descuento inline */}
              {discountTarget === item.key ? (
                <div className="mt-2.5 flex items-center gap-1.5">
                  <input
                    type="text"
                    inputMode="numeric"
                    autoFocus
                    value={discountInput}
                    onChange={(e) => setDiscountInput(e.target.value.replace(/\D/g, ''))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') applyDiscount(item.key)
                      if (e.key === 'Escape') setDiscountTarget(null)
                    }}
                    placeholder="Descuento $"
                    className="h-8 flex-1 rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                  <button
                    onClick={() => applyDiscount(item.key)}
                    className="h-8 rounded-md bg-primary px-2.5 text-xs font-semibold text-primary-foreground transition-colors hover:brightness-110"
                  >
                    OK
                  </button>
                  <button
                    onClick={() => setDiscountTarget(null)}
                    className="h-8 rounded-md border px-2 text-xs text-muted-foreground transition-colors hover:bg-muted"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => openDiscount(item.key, item.discountAmount)}
                  className={cn(
                    'mt-1.5 text-[11px] transition-colors',
                    item.discountAmount > 0
                      ? 'font-medium text-primary hover:brightness-90'
                      : 'text-muted-foreground hover:text-primary',
                  )}
                >
                  {item.discountAmount > 0
                    ? `Desc: −${formatCOP(item.discountAmount)} · Cambiar`
                    : '+ Agregar descuento'}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Totales + cobrar ──────────────────────────────── */}
      <div className="border-t bg-card px-4 pb-5 pt-4">
        <div className="space-y-1.5">
          {totals.discountTotal > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Descuentos</span>
              <span className="font-medium tabular-nums text-destructive">
                −{formatCOP(totals.discountTotal)}
              </span>
            </div>
          )}
          {totals.taxTotal > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">IVA</span>
              <span className="tabular-nums text-muted-foreground">
                {formatCOP(totals.taxTotal)}
              </span>
            </div>
          )}
        </div>

        {/* Total */}
        <div className="mt-3 flex items-end justify-between border-t pt-3">
          <span className="text-sm font-semibold text-muted-foreground">Total</span>
          <span className="font-display text-2xl font-bold tabular-nums text-primary">
            {formatCOP(totals.total)}
          </span>
        </div>

        <Button
          className="mt-4 h-12 w-full text-base font-bold tracking-wide"
          onClick={onCheckout}
          disabled={disabled || items.length === 0}
        >
          Cobrar {formatCOP(totals.total)}
        </Button>
      </div>
    </div>
  )
}
