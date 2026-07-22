export type Role = 'admin' | 'cajero'

export type TiendaId = string
export type UserId = string

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

export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'other'

export type CashSessionStatus = 'open' | 'closed'

export type CashMovementType = 'cash_in' | 'cash_out' | 'expense' | 'correction'

export type CashMovementStatus = 'active' | 'voided'

export type InventoryLocation = 'punto_venta' | 'bodega'

export type InventoryMovementType =
  | 'entry'
  | 'sale_exit'
  | 'adjustment'
  | 'void_return'
  | 'transfer_out'
  | 'transfer_in'
