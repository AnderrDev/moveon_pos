'use client'

import { useActionState, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  categoriaFormSchema,
  createCategoriaFormDefaults,
  type CategoriaFormValue,
} from '../forms/categoria-form.factory'
import { categoriaFormMapper } from '../forms/categoria-form.mapper'
import type { Categoria } from '../domain/entities/product.entity'
import {
  createCategoriaAction,
  updateCategoriaAction,
  type ActionState,
} from '../application/actions/categoria.actions'

const initialState: ActionState = { error: null }

interface UseCategoriaFormOptions {
  categoria?: Categoria | null
}

export function useCategoriaForm({ categoria }: UseCategoriaFormOptions = {}) {
  const isEditMode = !!categoria

  // Bind updateAction con el id cuando estamos en modo edición
  const boundAction = isEditMode
    ? updateCategoriaAction.bind(null, categoria.id)
    : createCategoriaAction

  const [actionState, formAction, isPending] = useActionState(boundAction, initialState)

  const form = useForm<CategoriaFormValue>({
    resolver: zodResolver(categoriaFormSchema),
    defaultValues: isEditMode
      ? categoriaFormMapper.toFormValue(categoria)
      : createCategoriaFormDefaults(),
  })

  // Resetear el formulario al cambiar la categoría seleccionada
  const reset = useCallback((c?: Categoria | null) => {
    form.reset(c ? categoriaFormMapper.toFormValue(c) : createCategoriaFormDefaults())
  }, [form])

  return {
    form,
    formAction,
    isPending,
    serverError: actionState.error,
    isEditMode,
    reset,
  }
}
