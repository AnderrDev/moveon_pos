'use client'

import { useState, useTransition } from 'react'
import { Pencil, ToggleLeft, ToggleRight } from 'lucide-react'
import { Button } from '@/shared/components/ui/Button'
import { useToast } from '@/shared/components/feedback/ToastProvider'
import { CategoriaFormDialog } from './CategoriaFormDialog'
import {
  deactivateCategoriaAction,
  activateCategoriaAction,
} from '../application/actions/categoria.actions'
import type { Categoria } from '../domain/entities/product.entity'

interface CategoriaActionsProps {
  categoria: Categoria
}

export function CategoriaActions({ categoria }: CategoriaActionsProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const toast = useToast()

  const toggleActive = () => {
    startTransition(async () => {
      const action = categoria.isActive ? deactivateCategoriaAction : activateCategoriaAction
      const result = await action(categoria.id)
      if (result.error) toast.error(result.error)
      else toast.success(result.message ?? 'Categoría actualizada')
    })
  }

  return (
    <>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setDialogOpen(true)}
          title="Editar"
          aria-label="Editar categoría"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={toggleActive}
          isLoading={isPending}
          title={categoria.isActive ? 'Desactivar' : 'Activar'}
          aria-label={categoria.isActive ? 'Desactivar categoría' : 'Activar categoría'}
          className={categoria.isActive ? 'text-muted-foreground' : 'text-green-600'}
        >
          {categoria.isActive
            ? <ToggleRight className="h-4 w-4" />
            : <ToggleLeft className="h-4 w-4" />
          }
        </Button>
      </div>

      <CategoriaFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        categoria={categoria}
      />
    </>
  )
}
