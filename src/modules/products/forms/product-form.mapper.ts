import type { Product } from '../domain/entities/product.entity'
import type { CreateProductDto, UpdateProductDto } from '../application/dtos/product.dto'
import type { ProductFormValue } from './product-form.factory'

/**
 * Traduce entre la entidad de dominio y los valores del formulario,
 * y entre los valores del formulario y los payloads de las Server Actions.
 *
 * Sin imports de React ni de RHF — TypeScript puro.
 */
export const productFormMapper = {

  /**
   * Entidad de dominio → valores iniciales del formulario.
   * Usar en modo edición: defaultValues = productFormMapper.toFormValue(product)
   */
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
      isActive:       product?.isActive       ?? true,
    }
  },

  /**
   * Valores del formulario → payload de creación para la Server Action.
   * tiendaId viene del contexto de auth en el servidor, no del formulario.
   */
  toCreatePayload(value: ProductFormValue, tiendaId: string): CreateProductDto {
    return {
      tiendaId,
      nombre:       value.nombre.trim(),
      // Strings vacíos se normalizan a undefined antes de enviar al servidor
      sku:          value.sku?.trim().toUpperCase() || undefined,
      codigoBarras: value.codigoBarras?.trim()      || undefined,
      categoriaId:  value.categoriaId               || undefined,
      tipo:         value.tipo,
      unidad:       value.unidad.trim(),
      precioVenta:  value.precioVenta,
      costo:        value.costo,
      ivaTasa:      value.ivaTasa,
      stockMinimo:  value.stockMinimo,
      isActive:       value.isActive,
    }
  },

  /**
   * Valores del formulario → payload de actualización.
   * Puede divergir de toCreatePayload cuando las reglas de negocio evolucionen.
   */
  toUpdatePayload(value: ProductFormValue): UpdateProductDto {
    return {
      nombre:       value.nombre.trim(),
      sku:          value.sku?.trim().toUpperCase() || undefined,
      codigoBarras: value.codigoBarras?.trim()      || undefined,
      categoriaId:  value.categoriaId               || undefined,
      tipo:         value.tipo,
      unidad:       value.unidad.trim(),
      precioVenta:  value.precioVenta,
      costo:        value.costo,
      ivaTasa:      value.ivaTasa,
      stockMinimo:  value.stockMinimo,
      isActive:       value.isActive,
    }
  },
}
