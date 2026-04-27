'use client'

import { Dialog } from '@/shared/components/ui/Dialog'
import { Button } from '@/shared/components/ui/Button'

function formatCOP(v: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v)
}

interface Props {
  open: boolean
  saleNumber: string
  total: number
  change: number
  onClose: () => void
}

export function SaleSuccessModal({ open, saleNumber, total, change, onClose }: Props) {
  return (
    <Dialog open={open} onClose={onClose} title="">
      <div className="py-4 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <svg viewBox="0 0 24 24" fill="none" className="h-8 w-8 text-green-600" aria-hidden>
            <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <h2 className="font-display text-xl font-bold text-foreground">¡Venta completada!</h2>
        <p className="mt-1 text-sm text-muted-foreground">Venta #{saleNumber}</p>

        <div className="mt-6 space-y-2 rounded-xl bg-muted/50 px-5 py-4 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total cobrado</span>
            <span className="font-semibold">{formatCOP(total)}</span>
          </div>
          {change > 0 && (
            <div className="flex justify-between font-display font-bold text-primary">
              <span>Cambio al cliente</span>
              <span>{formatCOP(change)}</span>
            </div>
          )}
        </div>

        <Button className="mt-6 w-full" onClick={onClose} autoFocus>
          Nueva venta
        </Button>
      </div>
    </Dialog>
  )
}
