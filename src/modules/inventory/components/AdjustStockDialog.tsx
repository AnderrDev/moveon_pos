'use client'

import { useActionState } from 'react'
import { adjustStockAction } from '../application/actions/inventory.actions'
import { Dialog } from '@/shared/components/ui/Dialog'
import { Button } from '@/shared/components/ui/Button'
import { SubmitButton } from '@/shared/components/forms/SubmitButton'
import { useActionFeedback } from '@/shared/hooks/use-action-feedback'
import { cn } from '@/shared/lib/utils'
import type { Product } from '@/modules/products/domain/entities/product.entity'

interface Props {
  product: Pick<Product, 'id' | 'nombre' | 'sku'>
  currentStock: number
  onClose: () => void
}

const INITIAL = { error: null }
const isDev = process.env.NODE_ENV === 'development'
const inputCls = cn(
  'h-10 w-full rounded-lg border border-input bg-card px-3 text-sm shadow-sm',
  'placeholder:text-muted-foreground/60',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
)

export function AdjustStockDialog({ product, currentStock, onClose }: Props) {
  const [state, action, pending] = useActionState(adjustStockAction, INITIAL)

  useActionFeedback({
    state,
    pending,
    onSuccess: onClose,
    successMessage: 'Ajuste de stock guardado',
    showErrorToast: true,
  })

  return (
    <Dialog open onClose={onClose} title={`Ajustar stock — ${product.nombre}`} isBusy={pending}>
      <form action={action} className="space-y-4">
        <input type="hidden" name="productId" value={product.id} />

        <div className="rounded-lg bg-muted/60 px-4 py-3 text-sm">
          <span className="text-muted-foreground">Stock actual:</span>{' '}
          <span className="font-semibold">{currentStock}</span>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">
            Ajuste de cantidad <span className="text-destructive">*</span>
          </label>
          <input
            name="cantidadDelta"
            type="number"
            step="0.001"
            placeholder="Ej: 5 para sumar, -3 para restar"
            defaultValue={isDev ? '5' : undefined}
            required
            className={inputCls}
          />
          <p className="mt-1 text-xs text-muted-foreground">Usa un número negativo para restar unidades.</p>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">
            Motivo del ajuste <span className="text-destructive">*</span>
          </label>
          <input
            name="motivo"
            type="text"
            placeholder="Ej. Conteo físico, producto dañado"
            defaultValue={isDev ? 'Conteo físico' : undefined}
            required
            minLength={3}
            maxLength={200}
            className={inputCls}
          />
        </div>

        {state.error && (
          <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {state.error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>Cancelar</Button>
          <SubmitButton isLoading={pending} loadingText="Guardando…">Guardar ajuste</SubmitButton>
        </div>
      </form>
    </Dialog>
  )
}
