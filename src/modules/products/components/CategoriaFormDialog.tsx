'use client'

import { useEffect } from 'react'
import { Dialog } from '@/shared/components/ui/Dialog'
import { Button } from '@/shared/components/ui/Button'
import { FormInput, SubmitButton, FormError } from '@/shared/components/forms'
import { useCategoriaForm } from '../hooks/use-categoria-form'
import type { Categoria } from '../domain/entities/product.entity'

interface CategoriaFormDialogProps {
  open: boolean
  onClose: () => void
  /** Si se pasa → modo edición */
  categoria?: Categoria | null
}

export function CategoriaFormDialog({ open, onClose, categoria }: CategoriaFormDialogProps) {
  const { form, formAction, isPending, serverError, isEditMode, reset } = useCategoriaForm({
    categoria,
  })

  // Reset al abrir/cambiar categoría
  useEffect(() => {
    if (open) reset(categoria)
  }, [open, categoria, reset])

  // Cerrar al guardar con éxito
  const prevError = serverError
  useEffect(() => {
    if (!isPending && prevError === null && form.formState.isSubmitSuccessful) {
      onClose()
    }
  }, [isPending, prevError, form.formState.isSubmitSuccessful, onClose])

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEditMode ? 'Editar categoría' : 'Nueva categoría'}
      description="Las categorías ayudan a organizar el catálogo en el punto de venta."
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
          <Button type="button" variant="outline" onClick={onClose}>
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
