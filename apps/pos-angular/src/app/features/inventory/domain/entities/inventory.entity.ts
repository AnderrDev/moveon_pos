import type { InventoryLocation, InventoryMovementType, TiendaId, UserId } from '@/shared/types'

export interface StockLevel {
  productId: string
  tiendaId: TiendaId
  puntoVentaStock: number
  bodegaStock: number
  totalStock: number
  minimumStock: number
  isLow: boolean
}

export type EntryPaymentMethod = 'efectivo_caja' | 'efectivo_externo' | 'transferencia' | 'tarjeta'

export interface InventoryMovement {
  id: string
  tiendaId: TiendaId
  productId: string
  tipo: InventoryMovementType
  ubicacion: InventoryLocation
  cantidad: number
  costoUnitario: number | null
  motivo: string | null
  /** Solo entradas: cómo se pagó la compra (`null` = no registrado). */
  metodoPago: EntryPaymentMethod | null
  referenciaTipo: string | null
  referenciaId: string | null
  createdBy: UserId
  createdAt: Date
}
