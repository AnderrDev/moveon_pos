'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { registerEntryAction } from '../application/actions/inventory.actions'
import { Dialog } from '@/shared/components/ui/Dialog'
import { Button } from '@/shared/components/ui/Button'
import { SubmitButton } from '@/shared/components/forms/SubmitButton'
import { cn } from '@/shared/lib/utils'
import type { Product } from '@/modules/products/domain/entities/product.entity'

interface Props {
  products: Pick<Product, 'id' | 'nombre' | 'sku'>[]
}

const INITIAL = { error: null }
const isDev = process.env.NODE_ENV === 'development'

export function RegisterEntryDialog({ products }: Props) {
  const [open, setOpen] = useState(false)
  const [state, action, pending] = useActionState(registerEntryAction, INITIAL)
  const prevPending = useRef(false)

  useEffect(() => {
    if (prevPending.current && !pending && !state.error) setOpen(false)
    prevPending.current = pending
  }, [pending, state.error])

  return (
    <>
      <Button onClick={() => setOpen(true)}>+ Registrar entrada</Button>

      <Dialog open={open} onClose={() => setOpen(false)} title="Registrar entrada de mercancía">
        <form action={action} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              Producto <span className="text-destructive">*</span>
            </label>
            <select
              name="productId"
              required
              className={cn(
                'h-10 w-full rounded-lg border border-input bg-card px-3 text-sm shadow-sm',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              )}
            >
              <option value="">Selecciona un producto…</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}{p.sku ? ` (${p.sku})` : ''}
                </option>
              ))}
            </select>
          </div>

          <Field label="Cantidad" required>
            <input
              name="cantidad"
              type="number"
              min="0.001"
              step="0.001"
              placeholder="0"
              defaultValue={isDev ? '10' : undefined}
              required
              className={inputCls}
            />
          </Field>

          <Field label="Costo unitario (opcional)">
            <input
              name="costoUnitario"
              type="number"
              min="0"
              step="1"
              placeholder="0"
              defaultValue={isDev ? '80000' : undefined}
              className={inputCls}
            />
          </Field>

          <Field label="Motivo / referencia (opcional)">
            <input
              name="motivo"
              type="text"
              placeholder="Ej. Factura #123, compra proveedor X"
              defaultValue={isDev ? 'Compra inicial proveedor' : undefined}
              maxLength={200}
              className={inputCls}
            />
          </Field>

          {state.error && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {state.error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <SubmitButton>Registrar entrada</SubmitButton>
          </div>
        </form>
      </Dialog>
    </>
  )
}

const inputCls = cn(
  'h-10 w-full rounded-lg border border-input bg-card px-3 text-sm shadow-sm',
  'placeholder:text-muted-foreground/60',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
)

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-foreground">
        {label}{required && <span className="ml-0.5 text-destructive">*</span>}
      </label>
      {children}
    </div>
  )
}
