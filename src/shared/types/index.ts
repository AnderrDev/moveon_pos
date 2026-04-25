export type Role = 'admin' | 'cajero'

export type TiendaId = string
export type UserId = string

export interface UserTienda {
  userId: UserId
  tiendaId: TiendaId
  role: Role
  active: boolean
}

export interface AuditFields {
  createdAt: Date
  updatedAt: Date
  createdBy?: UserId
}

export type IvaRate = 0 | 5 | 19

export type ProductType = 'simple' | 'prepared' | 'ingredient'

export type SaleStatus = 'completed' | 'voided'

export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'other'

export type CashSessionStatus = 'open' | 'closed'

export type InventoryMovementType = 'entrada' | 'salida' | 'ajuste' | 'venta' | 'anulacion'
