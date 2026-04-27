# Estándar: Sistema de Formularios — Patrón 3 Archivos

> Todo formulario de negocio sigue el mismo patrón de 3 archivos.
> La implementación de referencia está en `src/modules/products/forms/` y `src/modules/products/hooks/`.

---

## 1. El patrón de 3 archivos

```
src/modules/<feature>/
  forms/
    <feature>-form.factory.ts    ← schema Zod + tipos + valores por defecto
    <feature>-form.mapper.ts     ← traducción entidad ↔ valores del formulario
  hooks/
    use-<feature>-form.ts        ← orquestación de pantalla (presenter)
```

Cada archivo tiene **una sola responsabilidad**. El componente de página solo habla con el hook.

---

## 2. Archivo 1: Factory

**Qué va aquí:** el schema Zod del formulario, los tipos derivados, las constantes de validación y la función que crea los valores por defecto.

> **Distinto del DTO de la Server Action.** El DTO (`application/dtos/`) valida lo que llega al servidor. La factory valida lo que el usuario puede escribir en el formulario. Pueden diferir: por ejemplo, `tiendaId` nunca es un campo del formulario — lo aporta el servidor desde el contexto de auth.

```typescript
// src/modules/products/forms/product-form.factory.ts
import { z } from 'zod'
import { salePriceSchema, skuSchema, ivaRateSchema, productTypeSchema } from '@/shared/validations/common'

// ── Constantes de validación (importables por tests y por el mapper) ──────────

export const PRODUCT_NAME_MIN = 2
export const PRODUCT_NAME_MAX = 100
export const PRODUCT_SKU_MAX  = 50

// ── Schema del formulario ─────────────────────────────────────────────────────

export const productFormSchema = z.object({
  nombre:       z.string().trim().min(PRODUCT_NAME_MIN, `Mínimo ${PRODUCT_NAME_MIN} caracteres`).max(PRODUCT_NAME_MAX),
  sku:          skuSchema.optional().or(z.literal('')),
  codigoBarras: z.string().max(50).optional().or(z.literal('')),
  categoriaId:  z.string().uuid('Selecciona una categoría válida').optional().or(z.literal('')),
  tipo:         productTypeSchema,
  unidad:       z.string().min(1, 'La unidad es obligatoria').default('und'),
  precioVenta:  salePriceSchema,
  costo:        z.number().nonnegative().optional(),
  ivaTasa:      ivaRateSchema,
  stockMinimo:  z.number().int().nonnegative().default(0),
  activo:       z.boolean().default(true),
})

// ── Tipos derivados del schema (nunca se definen a mano) ──────────────────────

export type ProductFormValue = z.infer<typeof productFormSchema>

// ── Función de valores por defecto ───────────────────────────────────────────

export function createProductFormDefaults(
  initial?: Partial<ProductFormValue>,
): ProductFormValue {
  return {
    nombre:       initial?.nombre       ?? '',
    sku:          initial?.sku          ?? '',
    codigoBarras: initial?.codigoBarras ?? '',
    categoriaId:  initial?.categoriaId  ?? '',
    tipo:         initial?.tipo         ?? 'simple',
    unidad:       initial?.unidad       ?? 'und',
    precioVenta:  initial?.precioVenta  ?? 0,
    costo:        initial?.costo,
    ivaTasa:      initial?.ivaTasa      ?? 0,
    stockMinimo:  initial?.stockMinimo  ?? 0,
    activo:       initial?.activo       ?? true,
  }
}
```

**Reglas:**
- Usa siempre `.trim()` en strings requeridos — equivalente a `trimmedRequiredValidator` de Angular.
- Exporta las constantes de validación para que los tests las importen directamente.
- La función de defaults acepta un `Partial<>` para reutilizarse tanto en creación como en edición.
- **No importes** nada de React Hook Form aquí — este archivo es TypeScript puro.

---

## 3. Archivo 2: Mapper

**Qué va aquí:** traducción entre la entidad de dominio y los valores del formulario, y entre los valores del formulario y los payloads de las Server Actions. Sin imports de React ni de RHF.

```typescript
// src/modules/products/forms/product-form.mapper.ts
import type { Product } from '../domain/entities/product.entity'
import type { CreateProductDto, UpdateProductDto } from '../application/dtos/product.dto'
import type { ProductFormValue } from './product-form.factory'

export const productFormMapper = {

  /** Entidad de dominio → valores iniciales del formulario (para edición) */
  toFormValue(product?: Product | null): ProductFormValue {
    return {
      nombre:       product?.nombre       ?? '',
      sku:          product?.sku          ?? '',
      codigoBarras: product?.codigoBarras ?? '',
      categoriaId:  product?.categoriaId  ?? '',
      tipo:         product?.tipo         ?? 'simple',
      unidad:       product?.unidad       ?? 'und',
      precioVenta:  product?.precioVenta  ?? 0,
      costo:        product?.costo        ?? undefined,
      ivaTasa:      product?.ivaTasa      ?? 0,
      stockMinimo:  product?.stockMinimo  ?? 0,
      activo:       product?.activo       ?? true,
    }
  },

  /** Valores del formulario → payload de creación (para la Server Action) */
  toCreatePayload(value: ProductFormValue, tiendaId: string): CreateProductDto {
    return {
      tiendaId,
      nombre:       value.nombre.trim(),
      sku:          value.sku?.trim().toUpperCase() || undefined,
      codigoBarras: value.codigoBarras?.trim()      || undefined,
      categoriaId:  value.categoriaId               || undefined,
      tipo:         value.tipo,
      unidad:       value.unidad,
      precioVenta:  value.precioVenta,
      costo:        value.costo,
      ivaTasa:      value.ivaTasa,
      stockMinimo:  value.stockMinimo,
      activo:       value.activo,
    }
  },

  /** Valores del formulario → payload de actualización */
  toUpdatePayload(value: ProductFormValue): UpdateProductDto {
    return {
      nombre:       value.nombre.trim(),
      sku:          value.sku?.trim().toUpperCase() || undefined,
      codigoBarras: value.codigoBarras?.trim()      || undefined,
      categoriaId:  value.categoriaId               || undefined,
      tipo:         value.tipo,
      unidad:       value.unidad,
      precioVenta:  value.precioVenta,
      costo:        value.costo,
      ivaTasa:      value.ivaTasa,
      stockMinimo:  value.stockMinimo,
      activo:       value.activo,
    }
  },
}
```

**Reglas:**
- Sin imports de Angular, React, RHF ni Supabase — el mapper es TypeScript puro.
- Siempre clona arrays y objetos anidados para evitar referencias compartidas entre el estado del form y el dominio.
- `toCreatePayload` y `toUpdatePayload` pueden divergir cuando las reglas de negocio evolucionen — no los fusiones prematuramente.
- Los strings vacíos `''` se normalizan a `undefined` para campos opcionales antes de enviar al servidor.

---

## 4. Archivo 3: Hook (Presenter)

**Qué va aquí:** todo lo que la pantalla necesita — crear el form, manejar creación/edición, ejecutar el submit, exponer estado. El nombre refleja la pantalla que coordina.

```typescript
// src/modules/products/hooks/use-product-form.ts
'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { productFormSchema, type ProductFormValue, createProductFormDefaults } from '../forms/product-form.factory'
import { productFormMapper } from '../forms/product-form.mapper'
import { createProductAction, updateProductAction } from '../application/actions/product.actions'
import type { Product } from '../domain/entities/product.entity'

interface UseProductFormOptions {
  product?: Product       // si se pasa → modo edición
  tiendaId: string
  onSuccess?: () => void  // callback al guardar con éxito (redirigir, cerrar modal, etc.)
}

export function useProductForm({ product, tiendaId, onSuccess }: UseProductFormOptions) {
  const isEditMode = !!product

  const form = useForm<ProductFormValue>({
    resolver: zodResolver(productFormSchema),
    defaultValues: isEditMode
      ? productFormMapper.toFormValue(product)
      : createProductFormDefaults(),
  })

  const submit = async () => {
    // 1. Disparar validación de todos los campos antes de leer valores
    const isValid = await form.trigger()
    if (!isValid) return

    // 2. Leer valores (equivalente a form.getRawValue() en Angular)
    const values = form.getValues()

    // 3. Mapear al payload correcto según modo
    const result = isEditMode
      ? await updateProductAction(product!.id, productFormMapper.toUpdatePayload(values))
      : await createProductAction(productFormMapper.toCreatePayload(values, tiendaId))

    // 4. Manejar error del servidor
    if (!result.ok) {
      form.setError('root', { message: result.error.message })
      return
    }

    // 5. Éxito
    form.reset()
    onSuccess?.()
  }

  return {
    form,
    isEditMode,
    submit,
    isSubmitting: form.formState.isSubmitting,
  }
}
```

**Reglas:**
- El hook es `'use client'` — nunca lo importes en Server Components.
- El componente de página **nunca** llama a `useForm` directamente; siempre usa el hook.
- `form.trigger()` antes de `form.getValues()` — equivalente a `form.markAllAsTouched()` de Angular.
- Usa `form.getValues()` (incluye campos desactivados), no `form.watch()` ni desestructurado.
- `onSuccess` desacopla el hook de la navegación — el hook no sabe nada de rutas.

---

## 5. El componente de página — delgado

El componente solo llama al hook y conecta el template. Sin lógica de negocio.

```typescript
// src/app/(app)/productos/nuevo/page.tsx  o como modal
'use client'

import { useProductForm } from '@/modules/products/hooks/use-product-form'
import { FormInput, FormSelect, FormCurrencyInput, FormCheckbox, SubmitButton, FormError } from '@/shared/components/forms'

interface Props {
  categorias: { value: string; label: string }[]
  tiendaId: string
  product?: Product  // si viene → modo edición
}

export function ProductFormPage({ categorias, tiendaId, product }: Props) {
  const { form, isEditMode, submit } = useProductForm({ product, tiendaId })

  return (
    <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
      <FormInput
        control={form.control}
        name="nombre"
        label="Nombre del producto"
        required
      />
      <FormInput
        control={form.control}
        name="sku"
        label="SKU"
        description="Solo mayúsculas, números y guiones. Ej: PRO-WHY-2KG"
      />
      <FormCurrencyInput
        control={form.control}
        name="precioVenta"
        label="Precio de venta"
        required
      />
      <FormSelect
        control={form.control}
        name="categoriaId"
        label="Categoría"
        options={categorias}
        placeholder="Sin categoría"
      />
      <FormCheckbox
        control={form.control}
        name="activo"
        label="Activo"
        checkLabel="Disponible para la venta"
      />

      <FormError message={form.formState.errors.root?.message} />

      <SubmitButton isLoading={form.formState.isSubmitting} size="full">
        {isEditMode ? 'Actualizar producto' : 'Crear producto'}
      </SubmitButton>
    </form>
  )
}
```

---

## 6. Utilidad compartida: formErrorResolver

Equivalente a `resolveFormError` de Angular. Obtiene el primer mensaje de error del formulario para mostrarlo como notificación global.

```typescript
// src/shared/forms/form-error-resolver.ts
import type { FieldErrors, FieldValues } from 'react-hook-form'

/**
 * Devuelve el primer mensaje de error del formulario.
 * Útil para mostrar una notificación toast al fallar el submit.
 *
 * Uso:
 *   const firstError = formErrorResolver(form.formState.errors)
 *   if (firstError) toast.error(firstError)
 */
export function formErrorResolver<TValues extends FieldValues>(
  errors: FieldErrors<TValues>,
): string | null {
  for (const key of Object.keys(errors)) {
    const error = errors[key as keyof typeof errors]
    if (!error) continue

    // Error directo en el campo
    if (typeof error.message === 'string') return error.message

    // Error anidado (objetos o arrays)
    if (typeof error === 'object' && !('message' in error)) {
      const nested = formErrorResolver(error as FieldErrors<FieldValues>)
      if (nested) return nested
    }
  }
  return null
}
```

---

## 7. Relación entre los archivos de un módulo

```
domain/entities/product.entity.ts      ← Product interface
        ↑
forms/product-form.mapper.ts            ← toFormValue(Product) → ProductFormValue
        ↑                                  toCreatePayload(ProductFormValue) → CreateProductDto
application/dtos/product.dto.ts         ← CreateProductDto, UpdateProductDto (para Server Actions)
        ↑
forms/product-form.factory.ts           ← productFormSchema, ProductFormValue, createProductFormDefaults()
        ↑
hooks/use-product-form.ts               ← crea el form, llama mapper, llama actions
        ↑
app/(app)/productos/page.tsx            ← llama el hook, renderiza los campos
```

---

## 8. Cuándo extraer más archivos

Los 3 archivos son suficientes para la mayoría de formularios. Extrae solo cuando haya una razón real:

- **Validators separados** — cuando validadores se comparten entre dos o más formularios de features distintas → mueve a `src/shared/validations/`.
- **Hook separado por modo** — si el flujo de creación y edición divergen mucho → `use-create-product-form.ts` y `use-edit-product-form.ts`.

No pre-dividas anticipando crecimiento.

---

## 9. Estructura de carpetas del módulo completo

```
src/modules/<feature>/
  domain/
    entities/               ← interfaces de dominio
    repositories/           ← interfaces de repositorio
  application/
    dtos/
      <feature>.dto.ts      ← schemas para Server Actions (CreateDto, UpdateDto)
    use-cases/
    actions/
  forms/                    ← patrón 3 archivos (presentación)
    <feature>-form.factory.ts
    <feature>-form.mapper.ts
  hooks/                    ← presenter como hook React
    use-<feature>-form.ts
  infrastructure/
    repositories/           ← implementaciones Supabase
    mappers/                ← DB row ↔ Domain entity
```

---

## 10. Checklist antes de crear un formulario nuevo

- [ ] Existe `<feature>-form.factory.ts` con schema, tipos y `createDefaultValues()`
- [ ] Existe `<feature>-form.mapper.ts` con `toFormValue`, `toCreatePayload`, `toUpdatePayload`
- [ ] Existe `use-<feature>-form.ts` que llama al mapper y las actions — no el componente
- [ ] El componente de página es delgado: llama el hook, renderiza campos
- [ ] `tiendaId` viene del contexto del servidor, no del formulario
- [ ] Los strings vacíos se normalizan a `undefined` antes de enviar al servidor
- [ ] `form.trigger()` antes de `form.getValues()` en el submit
- [ ] `<FormError>` para errores raíz del servidor
- [ ] `<SubmitButton isLoading={form.formState.isSubmitting}>`
