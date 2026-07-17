import type { Categoria } from '@angular-app/features/products/domain/entities/product.entity'
import type { CategoriaFormValue } from '@angular-app/features/products/presentation/forms/categoria-form.factory'

export const categoriaFormMapper = {
  toFormValue(categoria?: Categoria | null): CategoriaFormValue {
    return { nombre: categoria?.nombre ?? '' }
  },
}
