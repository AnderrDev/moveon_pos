import type { Categoria } from '../domain/entities/product.entity'
import type { CategoriaFormValue } from './categoria-form.factory'

export const categoriaFormMapper = {
  toFormValue(categoria?: Categoria | null): CategoriaFormValue {
    return { nombre: categoria?.nombre ?? '' }
  },
}
