'use client'

import { useState, useTransition } from 'react'
import { Pencil, ToggleRight, ToggleLeft } from 'lucide-react'
import { Button } from '@/shared/components/ui/Button'
import { useToast } from '@/shared/components/feedback/ToastProvider'
import { ProductFormDialog } from './ProductFormDialog'
import { toggleProductActiveAction } from '../application/actions/product.actions'
import type { Product, Categoria } from '../domain/entities/product.entity'

interface ProductoActionsProps {
  product: Product
  categorias: Categoria[]
}

export function ProductoActions({ product, categorias }: ProductoActionsProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const toast = useToast()

  const toggle = () => {
    startTransition(async () => {
      const result = await toggleProductActiveAction(product.id, !product.isActive)
      if (result.error) toast.error(result.error)
      else toast.success(result.message ?? 'Producto actualizado')
    })
  }

  return (
    <>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon-sm" onClick={() => setDialogOpen(true)} title="Editar">
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={toggle}
          isLoading={isPending}
          title={product.isActive ? 'Desactivar' : 'Activar'}
          className={product.isActive ? 'text-muted-foreground' : 'text-green-600'}
        >
          {product.isActive
            ? <ToggleRight className="h-4 w-4" />
            : <ToggleLeft className="h-4 w-4" />
          }
        </Button>
      </div>

      <ProductFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        product={product}
        categorias={categorias}
      />
    </>
  )
}
