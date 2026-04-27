'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/shared/components/ui/Button'
import { ProductFormDialog } from './ProductFormDialog'
import type { Categoria } from '../domain/entities/product.entity'

interface AddProductoButtonProps {
  categorias: Categoria[]
}

export function AddProductoButton({ categorias }: AddProductoButtonProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        Nuevo producto
      </Button>
      <ProductFormDialog open={open} onClose={() => setOpen(false)} categorias={categorias} />
    </>
  )
}
