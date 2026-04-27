'use client'

import { useEffect } from 'react'
import { Dialog } from '@/shared/components/ui/Dialog'
import { Button } from '@/shared/components/ui/Button'
import { FormInput, SubmitButton, FormError } from '@/shared/components/forms'
import { useActionFeedback } from '@/shared/hooks/use-action-feedback'
import { useCategoriaForm } from '../hooks/use-categoria-form'
import type { Categoria } from '../domain/entities/product.entity'

interface CategoriaFormDialogProps {
  open: boolean
  onClose: () => void
  /** Si se pasa → modo edición */
  categoria?: Categoria | null
}

export function CategoriaFormDialog({ open, onClose, categoria }: CategoriaFormDialogProps) {
  const { form, formAction, isPending, serverError, message, isEditMode, reset } = useCategoriaForm({
    categoria,
  })

  // Reset al abrir/cambiar categoría
  useEffect(() => {
    if (open) reset(categoria)
  }, [open, categoria, reset])

  useActionFeedback({
    state: { error: serverError, message },
    pending: isPending,
    onSuccess: onClose,
    successMessage: isEditMode ? 'Categoría actualizada correctamente' : 'Categoría creada correctamente',
    showErrorToast: true,
  })

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEditMode ? 'Editar categoría' : 'Nueva categoría'}
      description="Las categorías ayudan a organizar el catálogo en el punto de venta."
      isBusy={isPending}
    >
      <form action={formAction} className="space-y-5">
        <FormInput
          control={form.control}
          name="nombre"
          label="Nombre"
          placeholder="Ej: Proteínas, Creatinas, Bebidas…"
          required
          autoComplete="off"
        />

        {serverError && <FormError message={serverError} />}

        <div className="flex justify-end gap-3 border-t pt-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <SubmitButton isLoading={isPending} loadingText="Guardando…">
            {isEditMode ? 'Guardar cambios' : 'Crear categoría'}
          </SubmitButton>
        </div>
      </form>
    </Dialog>
  )
}
