import type { IvaRate, PaymentMethod, ProductType } from '@/shared/types'

export interface PosProduct {
  id: string
  nombre: string
  sku: string | null
  codigoBarras: string | null
  precioVenta: number
  /** Solo se entrega al POS cuando el usuario activo es administrador. */
  costo: number | null
  ivaTasa: IvaRate
  categoriaId: string | null
  paraQueSirve: string | null
  recomendadoPara: string | null
  tipo: ProductType
  /** Stock disponible. `null` = el producto no rastrea stock (ej. `prepared`). */
  stockDisponible: number | null
}

export interface PosCategory {
  id: string
  nombre: string
}

export interface OpenCashSession {
  id: string
  openingAmount: number
}

export interface PaymentEntry {
  metodo: PaymentMethod
  amount: number
  referencia?: string
}
