'use client'

import { useActionState, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  productFormSchema,
  type ProductFormValue,
  createProductFormDefaults,
} from '../forms/product-form.factory'
import { productFormMapper } from '../forms/product-form.mapper'
import type { Product } from '../domain/entities/product.entity'
import {
  createProductAction,
  updateProductAction,
  type ProductActionState,
} from '../application/actions/product.actions'

const initialState: ProductActionState = { error: null }

interface UseProductFormOptions {
  product?: Product | null
  onSuccess?: () => void
}

export function useProductForm({ product, onSuccess: _onSuccess }: UseProductFormOptions = {}) {
  const isEditMode = !!product

  const boundAction = isEditMode
    ? updateProductAction.bind(null, product.id, product.precioVenta)
    : createProductAction

  const [actionState, formAction, isPending] = useActionState(boundAction, initialState)

  const form = useForm<ProductFormValue>({
    resolver: zodResolver(productFormSchema),
    defaultValues: isEditMode
      ? productFormMapper.toFormValue(product)
      : createProductFormDefaults(),
  })

  const reset = useCallback((p?: Product | null) => {
    form.reset(p ? productFormMapper.toFormValue(p) : createProductFormDefaults())
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
