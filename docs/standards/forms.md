# Estándar: Sistema de Formularios — Patrón 3 archivos (Angular)

> Todo formulario de negocio sigue el mismo patrón de 3 archivos.
> Implementación de referencia: `apps/pos-angular/src/app/features/auth/login.page.ts` + `login-form.presenter.ts` + `src/modules/auth/forms/login-form.{factory,mapper}.ts`.

---

## 0. Stack

- **Schema + tipos + defaults**: Zod, TypeScript puro (`src/modules/<feature>/forms/`).
- **Mapper entidad ↔ form ↔ payload**: TypeScript puro (`src/modules/<feature>/forms/`).
- **Presenter**: Angular `@Injectable` con `NonNullableFormBuilder` y signal de errores (`apps/pos-angular/src/app/features/<feature>/<feature>-form.presenter.ts`).
- **Componente Angular**: standalone, importa `ReactiveFormsModule`, consume el presenter con `inject()`.

Nada del flujo usa React, RHF, Zustand ni shadcn.

---

## 1. El patrón de 3 archivos

```
src/modules/<feature>/forms/
  <feature>-form.factory.ts        ← Zod schema + tipos + createDefaults()
  <feature>-form.mapper.ts         ← entidad ↔ form ↔ payload (TS puro)

apps/pos-angular/src/app/features/<feature>/
  <feature>-form.presenter.ts      ← Reactive Form + validación Zod + setRootError()
  <feature>.page.ts                ← componente standalone que consume el presenter
```

Cada archivo tiene **una sola responsabilidad**.

---

## 2. Archivo 1: Factory

**Qué va aquí:** schema Zod del formulario, tipos derivados, constantes de validación y `createDefaults()`.

> **Distinto del DTO.** El DTO (`application/dtos/`) valida lo que llega al backend (RPC, Edge Function). El form schema valida lo que el usuario puede escribir en pantalla. Pueden diferir: por ejemplo, `tiendaId` no es campo del formulario — lo aporta el presenter desde el contexto de auth.

```typescript
// src/modules/products/forms/product-form.factory.ts
import { z } from 'zod'
import {
  salePriceSchema,
  skuSchema,
  ivaRateSchema,
  productTypeSchema,
} from '@/shared/validations/common'

export const PRODUCT_NAME_MIN = 2
export const PRODUCT_NAME_MAX = 100

export const productFormSchema = z.object({
  nombre: z.string().trim().min(PRODUCT_NAME_MIN).max(PRODUCT_NAME_MAX),
  sku: skuSchema.optional().or(z.literal('')),
  codigoBarras: z.string().max(50).optional().or(z.literal('')),
  categoriaId: z.string().uuid('Selecciona una categoría válida').optional().or(z.literal('')),
  tipo: productTypeSchema,
  unidad: z.string().min(1, 'La unidad es obligatoria').default('und'),
  precioVenta: salePriceSchema,
  costo: z.number().nonnegative().optional(),
  ivaTasa: ivaRateSchema,
  stockMinimo: z.number().int().nonnegative().default(0),
  activo: z.boolean().default(true),
})

export type ProductFormValue = z.infer<typeof productFormSchema>

export function createProductFormDefaults(initial: Partial<ProductFormValue> = {}): ProductFormValue {
  return {
    nombre: initial.nombre ?? '',
    sku: initial.sku ?? '',
    codigoBarras: initial.codigoBarras ?? '',
    categoriaId: initial.categoriaId ?? '',
    tipo: initial.tipo ?? 'simple',
    unidad: initial.unidad ?? 'und',
    precioVenta: initial.precioVenta ?? 0,
    costo: initial.costo,
    ivaTasa: initial.ivaTasa ?? 0,
    stockMinimo: initial.stockMinimo ?? 0,
    activo: initial.activo ?? true,
  }
}
```

**Reglas:**
- `.trim()` en strings requeridos.
- Exporta constantes de validación para que los tests las importen.
- `createDefaults()` acepta `Partial<>` para reutilizarse en creación y edición.
- **No importes** Angular, RxJS ni Supabase aquí. TS puro.

---

## 3. Archivo 2: Mapper

**Qué va aquí:** traducción entidad ↔ valores del form, y form → payload de servicio Angular / RPC.

```typescript
// src/modules/products/forms/product-form.mapper.ts
import type { Product } from '../domain/entities/product.entity'
import type { CreateProductDto, UpdateProductDto } from '../application/dtos/product.dto'
import type { ProductFormValue } from './product-form.factory'

export const productFormMapper = {
  toFormValue(product?: Product | null): ProductFormValue {
    return {
      nombre: product?.nombre ?? '',
      sku: product?.sku ?? '',
      codigoBarras: product?.codigoBarras ?? '',
      categoriaId: product?.categoriaId ?? '',
      tipo: product?.tipo ?? 'simple',
      unidad: product?.unidad ?? 'und',
      precioVenta: product?.precioVenta ?? 0,
      costo: product?.costo ?? undefined,
      ivaTasa: product?.ivaTasa ?? 0,
      stockMinimo: product?.stockMinimo ?? 0,
      activo: product?.activo ?? true,
    }
  },

  toCreatePayload(value: ProductFormValue, tiendaId: string): CreateProductDto {
    return {
      tiendaId,
      nombre: value.nombre.trim(),
      sku: value.sku?.trim().toUpperCase() || undefined,
      codigoBarras: value.codigoBarras?.trim() || undefined,
      categoriaId: value.categoriaId || undefined,
      tipo: value.tipo,
      unidad: value.unidad,
      precioVenta: value.precioVenta,
      costo: value.costo,
      ivaTasa: value.ivaTasa,
      stockMinimo: value.stockMinimo,
      activo: value.activo,
    }
  },

  toUpdatePayload(value: ProductFormValue): UpdateProductDto {
    return {
      nombre: value.nombre.trim(),
      sku: value.sku?.trim().toUpperCase() || undefined,
      codigoBarras: value.codigoBarras?.trim() || undefined,
      categoriaId: value.categoriaId || undefined,
      tipo: value.tipo,
      unidad: value.unidad,
      precioVenta: value.precioVenta,
      costo: value.costo,
      ivaTasa: value.ivaTasa,
      stockMinimo: value.stockMinimo,
      activo: value.activo,
    }
  },
}
```

**Reglas:**
- TS puro: sin Angular, sin RxJS, sin Supabase.
- Strings vacíos `''` → `undefined` al construir payloads.
- `toCreatePayload` y `toUpdatePayload` pueden divergir cuando las reglas evolucionen — no los fusiones prematuramente.

---

## 4. Archivo 3: Presenter (Angular `@Injectable`)

**Qué va aquí:** crear el `FormGroup` desde los defaults, validar con Zod antes de leer `getRawValue()`, exponer signals de errores y submit.

```typescript
// apps/pos-angular/src/app/features/products/product-form.presenter.ts
import { Injectable, inject, signal } from '@angular/core'
import { NonNullableFormBuilder } from '@angular/forms'
import {
  createProductFormDefaults,
  productFormSchema,
  type ProductFormValue,
} from '@/modules/products/forms/product-form.factory'

type ProductFormErrors = Partial<Record<keyof ProductFormValue | 'root', string>>

@Injectable()
export class ProductFormPresenter {
  private readonly fb = inject(NonNullableFormBuilder)

  readonly errors = signal<ProductFormErrors>({})
  readonly form = this.fb.group(createProductFormDefaults())

  reset(initial: Partial<ProductFormValue> = {}): void {
    this.form.reset(createProductFormDefaults(initial))
    this.errors.set({})
  }

  validate(): ProductFormValue | null {
    this.form.markAllAsTouched()
    const parsed = productFormSchema.safeParse(this.form.getRawValue())

    if (!parsed.success) {
      const errors: ProductFormErrors = {}
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof ProductFormValue | undefined
        if (field && !errors[field]) errors[field] = issue.message
      }
      this.errors.set(errors)
      return null
    }

    this.errors.set({})
    return parsed.data
  }

  setRootError(message: string): void {
    this.errors.update((current) => ({ ...current, root: message }))
  }
}
```

**Reglas:**
- El presenter **no** llama Supabase. Sólo orquesta el form. La pantalla inyecta los servicios de aplicación que sí hablan con la DB.
- `validate()` siempre antes de `getRawValue()`.
- `errors` es un `signal<>` para que el template use control flow (`@if`).
- Nunca expongas el `FormGroup` para mutarlo desde el componente — sí para enlazar `[formGroup]` y `formControlName`.

---

## 5. El componente Angular — delgado

```typescript
// apps/pos-angular/src/app/features/products/product-form.page.ts
import { Component, inject, signal } from '@angular/core'
import { ReactiveFormsModule } from '@angular/forms'
import { Router } from '@angular/router'
import { SessionService } from '../../core/auth/session.service'
import { ProductFormPresenter } from './product-form.presenter'
import { productFormMapper } from '@/modules/products/forms/product-form.mapper'
import { ProductService } from './product.service'

@Component({
  selector: 'mo-product-form-page',
  standalone: true,
  imports: [ReactiveFormsModule],
  providers: [ProductFormPresenter],
  templateUrl: './product-form.page.html',
})
export class ProductFormPage {
  private readonly sessionService = inject(SessionService)
  private readonly productService = inject(ProductService)
  private readonly router = inject(Router)

  readonly presenter = inject(ProductFormPresenter)
  readonly isSubmitting = signal(false)
  readonly form = this.presenter.form

  async submit(): Promise<void> {
    const value = this.presenter.validate()
    if (!value) return

    const auth = await this.sessionService.getAuthContext()
    if (!auth) {
      this.presenter.setRootError('No autenticado')
      return
    }

    this.isSubmitting.set(true)
    const result = await this.productService.create(
      productFormMapper.toCreatePayload(value, auth.tiendaId),
    )
    this.isSubmitting.set(false)

    if (!result.ok) {
      this.presenter.setRootError(result.error.message)
      return
    }

    this.presenter.reset()
    await this.router.navigateByUrl('/productos')
  }
}
```

**Reglas:**
- El componente sólo invoca `presenter.validate()`, mappea y delega en un servicio Angular.
- Sin `subscribe` manuales: usa signals; si necesitas `Observable`, usa `toSignal()`.
- Sin lógica de negocio en el template.

---

## 6. Relación entre archivos

```
domain/entities/product.entity.ts        ← Product interface
        ↑
forms/product-form.mapper.ts              ← entidad ↔ form ↔ payload (CreateProductDto, UpdateProductDto)
        ↑                                    
application/dtos/product.dto.ts           ← schemas Zod del backend
        ↑
forms/product-form.factory.ts             ← schema del form, tipo, createDefaults()
        ↑
features/products/product-form.presenter.ts ← FormGroup + validate() + signals
        ↑
features/products/product-form.page.ts    ← componente standalone que consume presenter + servicio
```

---

## 7. Cuándo extraer más archivos

Tres archivos son suficientes para la mayoría de formularios. Extrae sólo cuando haya razón real:

- **Validators compartidos** entre dos o más features → muévelos a `src/shared/validations/`.
- **Presenter por modo** si crear y editar divergen mucho → `product-create-form.presenter.ts` / `product-edit-form.presenter.ts`.
- **Servicios separados** por feature en lugar de un dios-service.

No pre-dividas anticipando crecimiento.

---

## 8. Estructura del módulo completo

```
src/modules/<feature>/
  domain/
    entities/                ← interfaces de dominio
    repositories/            ← interfaces (firmadas en TS puro)
  application/
    dtos/
      <feature>.dto.ts       ← schemas Zod del backend (CreateDto, UpdateDto)
    use-cases/               ← funciones puras con deps inyectadas
  forms/
    <feature>-form.factory.ts
    <feature>-form.mapper.ts

apps/pos-angular/src/app/features/<feature>/
  <feature>-form.presenter.ts
  <feature>.page.ts          ← (o .html separado)
  <feature>.service.ts       ← @Injectable que habla con Supabase / RPC
  infrastructure/            ← (cuando aplique) implementaciones de los repos del dominio
    supabase-<feature>.repository.ts
```

---

## 9. Checklist antes de crear un formulario nuevo

- [ ] Existe `<feature>-form.factory.ts` con schema Zod, tipos y `createDefaults()` con `Partial<>` overrides.
- [ ] Existe `<feature>-form.mapper.ts` con `toFormValue`, `toCreatePayload`, `toUpdatePayload`.
- [ ] Existe `<feature>-form.presenter.ts` que valida con Zod antes de `getRawValue()` y expone `errors` como `signal`.
- [ ] El componente `*.page.ts` es delgado: llama `presenter.validate()`, mappea y delega en un servicio.
- [ ] `tiendaId` viene del `SessionService.getAuthContext()`, no del formulario.
- [ ] Strings vacíos se normalizan a `undefined` antes de enviar al servidor.
- [ ] `[disabled]` y `class` se enlazan vía signals/computed, no `subscribe`.
- [ ] Errores de root se muestran con `@if (presenter.errors().root)` en el template.
- [ ] El `<button type="submit">` se deshabilita con un `signal<boolean>` mientras dura el submit.
