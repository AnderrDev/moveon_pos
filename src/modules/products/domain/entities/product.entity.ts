import type { IvaRate, ProductType, TiendaId } from '@/shared/types'

export interface Product {
  id: string
  tiendaId: TiendaId
  nombre: string
  sku: string | null
  codigoBarras: string | null
  categoriaId: string | null
  tipo: ProductType
  unidad: string
  precioVenta: number
  costo: number | null
  ivaTasa: IvaRate
  stockMinimo: number
  activo: boolean
  createdAt: Date
  updatedAt: Date
}

export interface Categoria {
  id: string
  tiendaId: TiendaId
  nombre: string
  orden: number
  activo: boolean
  createdAt: Date
  updatedAt: Date
}
