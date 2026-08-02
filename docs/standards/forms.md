# Estándar: Sistema de Formularios — Patrón 3 archivos (Angular)

> Todo formulario de negocio sigue el mismo patrón de 3 archivos.
> Implementación de referencia: feature `auth` — `presentation/pages/login.page.ts` + `presentation/presenters/login-form.presenter.ts` + `presentation/forms/login-form.{factory,mapper}.ts` (todo dentro de `apps/pos-angular/src/app/features/auth/`).

---

## 0. Stack

- **Schema + tipos + defaults**: Zod, TypeScript puro (`features/<feature>/presentation/forms/`).
- **Mapper entidad ↔ form ↔ payload**: TypeScript puro (`features/<feature>/presentation/forms/`).
- **Presenter**: Angular `@Injectable` con `NonNullableFormBuilder` y signal de errores (`features/<feature>/presentation/presenters/<feature>-form.presenter.ts`).
- **Componente Angular**: standalone, importa `ReactiveFormsModule`, consume el presenter con `inject()`.

Nada del flujo usa React, RHF, Zustand ni shadcn.

> `presentation/forms/` es TS puro (schemas Zod + mappers) aunque viva en presentación: es el contrato del formulario, no del backend (ADR 0015 §3).

---

## 1. El patrón de 3 archivos

```
apps/pos-angular/src/app/features/<feature>/presentation/
  forms/
    <feature>-form.factory.ts      ← Zod schema + tipos + createDefaults() (TS puro)
    <feature>-form.mapper.ts       ← entidad ↔ form ↔ payload (TS puro)
  presenters/
    <feature>-form.presenter.ts    ← Reactive Form + validación Zod + setRootError()
  pages/ (o dialogs/)
    <feature>.page.ts              ← componente standalone que consume el presenter
```

Cada archivo tiene **una sola responsabilidad**.

---

## 2. Archivo 1: Factory

**Qué va aquí:** schema Zod del formulario, tipos derivados, constantes de validación y `createDefaults()`.

> **Distinto del DTO.** El DTO (`domain/dtos/`) valida lo que llega al backend (RPC, Edge Function). El form schema valida lo que el usuario puede escribir en pantalla. Pueden diferir: por ejemplo, `tiendaId` no es campo del formulario — lo aporta el presenter desde el contexto de auth.

```typescript
// features/products/presentation/forms/product-form.factory.ts
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
// features/products/presentation/forms/product-form.mapper.ts
import type { Product } from '@angular-app/features/products/domain/entities/product.entity'
import type { CreateProductDto, UpdateProductDto } from '@angular-app/features/products/domain/dtos/product.dto'
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
// features/products/presentation/presenters/product-form.presenter.ts
import { Injectable, inject, signal } from '@angular/core'
import { NonNullableFormBuilder } from '@angular/forms'
import {
  createProductFormDefaults,
  productFormSchema,
  type ProductFormValue,
} from '@angular-app/features/products/presentation/forms/product-form.factory'

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
// features/products/presentation/pages/product-form.page.ts
import { Component, inject, signal } from '@angular/core'
import { ReactiveFormsModule } from '@angular/forms'
import { Router } from '@angular/router'
import { SessionService } from '@angular-app/core/auth/session.service'
import { ProductRepository } from '@angular-app/features/products/domain/repositories/product.repository'
import { createProduct } from '@angular-app/features/products/domain/usecases/create-product.use-case'
import { productFormMapper } from '@angular-app/features/products/presentation/forms/product-form.mapper'
import { ProductFormPresenter } from '@angular-app/features/products/presentation/presenters/product-form.presenter'

@Component({
  selector: 'mo-product-form-page',
  standalone: true,
  imports: [ReactiveFormsModule],
  providers: [ProductFormPresenter],
  templateUrl: './product-form.page.html',
})
export class ProductFormPage {
  private readonly sessionService = inject(SessionService)
  private readonly repo = inject(ProductRepository)   // la ABSTRACCIÓN, nunca la clase Supabase
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
    const result = await createProduct(
      { repo: this.repo },
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
- El componente sólo invoca `presenter.validate()`, mappea y delega en un **use-case** (escrituras) o en la abstracción del repositorio (lecturas simples) — ADR 0015 §6.3.
- Inyecta el contrato de `domain/repositories/` (`abstract class`), nunca la implementación de `data/` — el linter lo bloquea.
- Sin `subscribe` manuales: usa signals; si necesitas `Observable`, usa `toSignal()`.
- Sin lógica de negocio en el template.

---

## 6. Relación entre archivos

```
(todo dentro de features/products/)

domain/entities/product.entity.ts                    ← Product interface
        ↑
domain/dtos/product.dto.ts                           ← schemas Zod del backend (CreateProductDto, UpdateProductDto)
        ↑
presentation/forms/product-form.factory.ts           ← schema del form, tipo, createDefaults()
        ↑
presentation/forms/product-form.mapper.ts            ← entidad ↔ form ↔ payload
        ↑
presentation/presenters/product-form.presenter.ts    ← FormGroup + validate() + signals
        ↑
presentation/pages/product-form.page.ts              ← componente standalone: presenter + use-case
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
apps/pos-angular/src/app/features/<feature>/         (estructura ADR 0015)
  <feature>.providers.ts     ← composition root: { provide: Contrato, useClass: Impl }
  domain/
    entities/                ← interfaces de dominio
    repositories/            ← contratos abstract class (TS puro, token de DI)
    usecases/                ← funciones puras con deps inyectadas + Zod + Result
    dtos/
      <feature>.dto.ts       ← schemas Zod del backend (CreateDto, UpdateDto)
  data/
    models/                  ← row types + mappers row ↔ entidad
    repositories/
      <feature>.repository.ts ← @Injectable Supabase, extends el contrato de dominio
  presentation/
    forms/
      <feature>-form.factory.ts
      <feature>-form.mapper.ts
    presenters/<feature>-form.presenter.ts
    pages/<feature>.page.ts
    dialogs/ · components/ · services/
```

> Implementaciones de referencia: `products`, `expenses` y `customers` (cableado completo post-ADR 0015).

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
