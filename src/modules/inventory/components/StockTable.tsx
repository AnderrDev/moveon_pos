'use client'

import { useState } from 'react'
import { Badge } from '@/shared/components/ui/Badge'
import { Button } from '@/shared/components/ui/Button'
import { AdjustStockDialog } from './AdjustStockDialog'
import { KardexDialog } from './KardexDialog'
import type { StockLevel } from '../domain/entities/inventory.entity'
import type { InventoryMovement } from '../domain/entities/inventory.entity'
import type { Product } from '@/modules/products/domain/entities/product.entity'

interface StockRow {
  stockLevel: StockLevel
  product: Pick<Product, 'id' | 'nombre' | 'sku' | 'codigoBarras'>
}

interface Props {
  rows: StockRow[]
  kardexMap: Record<string, InventoryMovement[]>
}

export function StockTable({ rows, kardexMap }: Props) {
  const [adjustTarget, setAdjustTarget] = useState<StockRow | null>(null)
  const [kardexTarget, setKardexTarget] = useState<StockRow | null>(null)

  return (
    <>
      <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Producto</th>
              <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Stock actual</th>
              <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Mínimo</th>
              <th className="px-5 py-3.5 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">Estado</th>
              <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map(({ stockLevel, product }) => (
              <tr key={product.id} className="transition-colors hover:bg-muted/30">
                <td className="px-5 py-4">
                  <div className="font-medium text-foreground">{product.nombre}</div>
                  {product.sku && (
                    <code className="mt-0.5 rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                      {product.sku}
                    </code>
                  )}
                </td>
                <td className="px-5 py-4 text-right font-mono font-semibold tabular-nums">
                  <span className={stockLevel.isLow ? 'text-destructive' : 'text-foreground'}>
                    {stockLevel.currentStock}
                  </span>
                </td>
                <td className="px-5 py-4 text-right font-mono tabular-nums text-muted-foreground">
                  {stockLevel.minimumStock}
                </td>
                <td className="px-5 py-4 text-center">
                  {stockLevel.isLow ? (
                    <Badge variant="destructive">Stock bajo</Badge>
                  ) : (
                    <Badge variant="success">OK</Badge>
                  )}
                </td>
                <td className="px-5 py-4 text-right">
                  <div className="inline-flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setKardexTarget({ stockLevel, product })}
                    >
                      Kardex
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setAdjustTarget({ stockLevel, product })}
                    >
                      Ajustar
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {adjustTarget && (
        <AdjustStockDialog
          product={adjustTarget.product}
          currentStock={adjustTarget.stockLevel.currentStock}
          onClose={() => setAdjustTarget(null)}
        />
      )}

      {kardexTarget && (
        <KardexDialog
          productNombre={kardexTarget.product.nombre}
          movements={kardexMap[kardexTarget.product.id] ?? []}
          onClose={() => setKardexTarget(null)}
        />
      )}
    </>
  )
}
