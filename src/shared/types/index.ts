export type Role = 'admin' | 'cajero'

export type TiendaId = string
export type UserId = string

export interface UserTienda {
  userId: UserId
  tiendaId: TiendaId
  role: Role
  isActive: boolean
}

export interface AuditFields {
  createdAt: Date
  updatedAt: Date
  createdBy?: UserId
}

export type IvaRate = 0 | 5 | 19

export type ProductType = 'simple' | 'prepared' | 'ingredient'

export type SaleStatus = 'completed' | 'voided'

export type BillingStatus =
  | 'not_required'
  | 'pending'
  | 'sent'
  | 'accepted'
  | 'rejected'
  | 'failed'

export type BillingDocStatus =
  | 'pending'
  | 'sent'
  | 'accepted'
  | 'rejected'
  | 'cancelled'
  | 'failed'

export type BillingDocType = 'invoice' | 'pos_document' | 'credit_note'

export type PaymentMethod = 'cash' | 'card' | 'nequi' | 'daviplata' | 'transfer' | 'other'

export type CashSessionStatus = 'open' | 'closed'

export type CashMovementType = 'cash_in' | 'cash_out' | 'expense' | 'correction'

export type InventoryMovementType = 'entry' | 'sale_exit' | 'adjustment' | 'void_return'
