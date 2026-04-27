'use client'

import { useEffect } from 'react'
import { Dialog } from '@/shared/components/ui/Dialog'
import { Button } from '@/shared/components/ui/Button'
import {
  FormInput,
  FormSelect,
  FormNumberInput,
  FormCurrencyInput,
  FormCheckbox,
  SubmitButton,
  FormError,
} from '@/shared/components/forms'
import { useActionFeedback } from '@/shared/hooks/use-action-feedback'
import { useProductForm } from '../hooks/use-product-form'
import type { Product, Categoria } from '../domain/entities/product.entity'
import type { SelectOption } from '@/shared/components/forms'

interface ProductFormDialogProps {
  open: boolean
  onClose: () => void
  product?: Product | null
  categorias: Categoria[]
}

const TIPO_OPTIONS: SelectOption[] = [
  { value: 'simple',     label: 'Simple' },
  { value: 'prepared',   label: 'Preparado (batido)' },
  { value: 'ingredient', label: 'Ingrediente' },
]

const IVA_OPTIONS: SelectOption[] = [
  { value: '0',  label: '0% — Exento' },
  { value: '5',  label: '5%' },
  { value: '19', label: '19%' },
]

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
      {children}
    </p>
  )
}

export function ProductFormDialog({ open, onClose, product, categorias }: ProductFormDialogProps) {
  const { form, formAction, isPending, serverError, message, isEditMode, reset } = useProductForm({ product })

  useEffect(() => {
    if (open) reset(product)
  }, [open, product, reset])

  useActionFeedback({
    state: { error: serverError, message },
    pending: isPending,
    onSuccess: onClose,
    successMessage: isEditMode ? 'Producto actualizado correctamente' : 'Producto creado correctamente',
    showErrorToast: true,
  })

  const categoriaOptions: SelectOption[] = [
    { value: '', label: 'Sin categoría' },
    ...categorias
      .filter((c) => c.isActive)
      .map((c) => ({ value: c.id, label: c.nombre })),
  ]

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEditMode ? 'Editar producto' : 'Nuevo producto'}
      className="max-w-2xl"
      isBusy={isPending}
    >
      <form action={formAction} className="space-y-6">

        {/* ── Identificación ─────────────────────────────────── */}
        <div className="space-y-4">
          <SectionLabel>Identificación</SectionLabel>
          <div className="grid grid-cols-2 gap-4">
            <FormInput
              control={form.control}
              name="nombre"
              label="Nombre"
              placeholder="Ej: Whey Protein 2Kg"
              required
              className="col-span-2 sm:col-span-1"
            />
            <FormInput
              control={form.control}
              name="sku"
              label="SKU"
              placeholder="Ej: WHY-VAN-2KG"
              autoComplete="off"
            />
          </div>
          <FormInput
            control={form.control}
            name="codigoBarras"
            label="Código de barras"
            placeholder="7501000000000"
            autoComplete="off"
          />
        </div>

        {/* ── Clasificación ──────────────────────────────────── */}
        <div className="space-y-4 border-t pt-5">
          <SectionLabel>Clasificación</SectionLabel>
          <div className="grid grid-cols-2 gap-4">
            <FormSelect
              control={form.control}
              name="tipo"
              label="Tipo"
              options={TIPO_OPTIONS}
              required
            />
            <FormSelect
              control={form.control}
              name="categoriaId"
              label="Categoría"
              options={categoriaOptions}
              placeholder="Sin categoría"
            />
          </div>
          <FormInput
            control={form.control}
            name="unidad"
            label="Unidad"
            placeholder="und, kg, ml…"
            required
          />
        </div>

        {/* ── Precios y tributos ─────────────────────────────── */}
        <div className="space-y-4 border-t pt-5">
          <SectionLabel>Precios y tributos</SectionLabel>
          <div className="grid grid-cols-3 gap-4">
            <FormCurrencyInput
              control={form.control}
              name="precioVenta"
              label="Precio de venta"
              required
            />
            <FormCurrencyInput
              control={form.control}
              name="costo"
              label="Costo"
            />
            <FormSelect
              control={form.control}
              name="ivaTasa"
              label="IVA"
              options={IVA_OPTIONS}
              required
            />
          </div>
        </div>

        {/* ── Control de inventario ──────────────────────────── */}
        <div className="space-y-4 border-t pt-5">
          <SectionLabel>Inventario</SectionLabel>
          <div className="flex items-end gap-6">
            <FormNumberInput
              control={form.control}
              name="stockMinimo"
              label="Stock mínimo"
              placeholder="0"
              className="w-36"
            />
            <div className="pb-1">
              <FormCheckbox
                control={form.control}
                name="isActive"
                label="Producto activo"
              />
            </div>
          </div>
        </div>

        {serverError && <FormError message={serverError} />}

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t pt-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <SubmitButton isLoading={isPending} loadingText="Guardando…">
            {isEditMode ? 'Guardar cambios' : 'Crear producto'}
          </SubmitButton>
        </div>
      </form>
    </Dialog>
  )
}
