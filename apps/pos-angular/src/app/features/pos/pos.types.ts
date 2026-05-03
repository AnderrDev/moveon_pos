import type { IvaRate, PaymentMethod } from '@/shared/types'

export interface PosProduct {
  id: string
  nombre: string
  sku: string | null
  codigoBarras: string | null
  precioVenta: number
  ivaTasa: IvaRate
  categoriaId: string | null
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
