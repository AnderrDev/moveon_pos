'use client'

import { useState } from 'react'
import type { StockReportRow } from '../application/actions/stock-report.action'

interface Props {
  rows: StockReportRow[]
}

export function StockReportSection({ rows }: Props) {
  const [soloLow, setSoloLow] = useState(false)

  const lowCount = rows.filter((r) => r.isLow).length
  const visible  = soloLow ? rows.filter((r) => r.isLow) : rows

  return (
    <div className="rounded-xl border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b px-5 py-4">
        <div>
          <h3 className="font-display text-sm font-bold">Estado de stock</h3>
          {lowCount > 0 && (
            <p className="mt-0.5 text-xs text-destructive font-medium">
              {lowCount} producto{lowCount !== 1 ? 's' : ''} con stock bajo
            </p>
          )}
        </div>
        <div className="flex items-center gap-3 print:hidden">
          {lowCount > 0 && (
            <button
              onClick={() => setSoloLow((v) => !v)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                soloLow
                  ? 'border-destructive bg-destructive/10 text-destructive'
                  : 'border-border bg-background text-muted-foreground hover:bg-muted'
              }`}
            >
              {soloLow ? 'Ver todos' : `Solo bajo stock (${lowCount})`}
            </button>
          )}
          <button
            onClick={() => window.print()}
            className="rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
          >
            <svg viewBox="0 0 16 16" fill="none" className="inline h-3.5 w-3.5 mr-1" aria-hidden>
              <path d="M4 6V2h8v4M4 12H2V7h12v5h-2" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
              <rect x="4" y="10" width="8" height="4" rx="0.5" stroke="currentColor" strokeWidth="1.25"/>
            </svg>
            Imprimir
          </button>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <p className="text-sm text-muted-foreground">
            {soloLow ? 'No hay productos con stock bajo' : 'Sin productos en inventario'}
          </p>
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Producto</th>
              <th className="px-5 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Stock actual</th>
              <th className="px-5 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Mínimo</th>
              <th className="px-5 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {visible.map((row) => (
              <tr key={row.productId} className={row.isLow ? 'bg-destructive/5' : 'hover:bg-muted/20'}>
                <td className="px-5 py-3">
                  <span className="font-medium">{row.nombre}</span>
                  {row.sku && (
                    <code className="ml-2 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                      {row.sku}
                    </code>
                  )}
                </td>
                <td className={`px-5 py-3 text-right font-mono font-semibold tabular-nums ${row.isLow ? 'text-destructive' : 'text-foreground'}`}>
                  {row.currentStock}
                </td>
                <td className="px-5 py-3 text-right font-mono tabular-nums text-muted-foreground">
                  {row.minimumStock}
                </td>
                <td className="px-5 py-3 text-center">
                  {row.isLow ? (
                    <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">
                      Stock bajo
                    </span>
                  ) : (
                    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                      OK
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
