import type { Product, Categoria } from '../../domain/entities/product.entity'
import type { IvaRate, ProductType } from '@/shared/types'

export type ProductRow = {
  id: string
  tienda_id: string
  nombre: string
  sku: string | null
  codigo_barras: string | null
  categoria_id: string | null
  tipo: string
  unidad: string
  precio_venta: number
  costo: number | null
  iva_tasa: number
  stock_minimo: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export type CategoriaRow = {
  id: string
  tienda_id: string
  nombre: string
  orden: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export function rowToProduct(row: ProductRow): Product {
  return {
    id:           row.id,
    tiendaId:     row.tienda_id,
    nombre:       row.nombre,
    sku:          row.sku,
    codigoBarras: row.codigo_barras,
    categoriaId:  row.categoria_id,
    tipo:         row.tipo as ProductType,
    unidad:       row.unidad,
    precioVenta:  row.precio_venta,
    costo:        row.costo,
    ivaTasa:      row.iva_tasa as IvaRate,
    stockMinimo:  row.stock_minimo,
    isActive:     row.is_active,
    createdAt:    new Date(row.created_at),
    updatedAt:    new Date(row.updated_at),
  }
}

export function rowToCategoria(row: CategoriaRow): Categoria {
  return {
    id:        row.id,
    tiendaId:  row.tienda_id,
    nombre:    row.nombre,
    orden:     row.orden,
    isActive:  row.is_active,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }
}
