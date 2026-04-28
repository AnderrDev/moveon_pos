'use client'

import { useState, useEffect } from 'react'
import { Dialog } from '@/shared/components/ui/Dialog'
import { Button } from '@/shared/components/ui/Button'
import { formatShortDate, formatTime } from '@/shared/lib/format'
import { getKardexAction } from '../application/actions/inventory.actions'
import type { InventoryMovement } from '../domain/entities/inventory.entity'

const TIPO_LABELS: Record<string, { label: string; color: string }> = {
  entry:       { label: 'Entrada',   color: 'text-green-600' },
  sale_exit:   { label: 'Venta',     color: 'text-foreground' },
  adjustment:  { label: 'Ajuste',    color: 'text-primary' },
  void_return: { label: 'Anulación', color: 'text-muted-foreground' },
}

interface Props {
  productId: string
  productNombre: string
  onClose: () => void
}

export function KardexDialog({ productId, productNombre, onClose }: Props) {
  const [movements, setMovements] = useState<InventoryMovement[] | null>(null)

  useEffect(() => {
    getKardexAction(productId).then(setMovements)
  }, [productId])

  return (
    <Dialog open onClose={onClose} title={`Kardex — ${productNombre}`}>
      {movements === null ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : movements.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Sin movimientos registrados.</p>
      ) : (
        <div className="max-h-[400px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card">
              <tr className="border-b">
                <th className="py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Fecha</th>
                <th className="py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tipo</th>
                <th className="py-2 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cantidad</th>
                <th className="py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Motivo</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {movements.map((m) => {
                const meta = TIPO_LABELS[m.tipo] ?? { label: m.tipo, color: 'text-foreground' }
                return (
                  <tr key={m.id}>
                    <td className="py-2.5 text-xs text-muted-foreground">
                      {formatShortDate(m.createdAt)} {formatTime(m.createdAt)}
                    </td>
                    <td className={`py-2.5 font-medium ${meta.color}`}>{meta.label}</td>
                    <td className={`py-2.5 text-right font-mono font-semibold tabular-nums ${m.cantidad > 0 ? 'text-green-600' : 'text-destructive'}`}>
                      {m.cantidad > 0 ? '+' : ''}{m.cantidad}
                    </td>
                    <td className="py-2.5 text-xs text-muted-foreground">
                      {m.motivo ?? '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="mt-4 flex justify-end">
        <Button variant="outline" onClick={onClose}>Cerrar</Button>
      </div>
    </Dialog>
  )
}
