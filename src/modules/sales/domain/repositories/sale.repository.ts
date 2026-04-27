import type { Result } from '@/shared/result'
import type { TiendaId, UserId, PaymentMethod } from '@/shared/types'
import type { Sale } from '../entities/sale.entity'

export interface CreateSaleItemInput {
  productId:      string
  productoNombre: string
  productoSku:    string | null
  quantity:       number
  unitPrice:      number
  discountAmount: number
  taxRate:        number
  taxAmount:      number
  total:          number
}

export interface CreatePaymentInput {
  metodo:     PaymentMethod
  amount:     number
  referencia?: string
}

export interface CreateSaleInput {
  tiendaId:       TiendaId
  cashSessionId:  string
  saleNumber:     string
  cashierId:      UserId
  clienteId?:     string
  items:          CreateSaleItemInput[]
  payments:       CreatePaymentInput[]
  subtotal:       number
  discountTotal:  number
  taxTotal:       number
  total:          number
  change:         number
  idempotencyKey: string
}

export interface VoidSaleInput {
  saleId:      string
  tiendaId:    TiendaId
  voidedBy:    UserId
  voidedReason: string
}

export interface SaleRepository {
  create(input: CreateSaleInput): Promise<Result<Sale>>
  findById(id: string, tiendaId: TiendaId): Promise<Result<Sale | null>>
  listBySession(cashSessionId: string, tiendaId: TiendaId): Promise<Result<Sale[]>>
  listByDate(tiendaId: TiendaId, date: Date): Promise<Result<Sale[]>>
  void(input: VoidSaleInput): Promise<Result<Sale>>
}
