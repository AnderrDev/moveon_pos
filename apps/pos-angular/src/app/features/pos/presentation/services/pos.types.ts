import type { IvaRate, PaymentMethod, ProductType } from '@/shared/types'

export interface PosProductComponent {
  /** Necesario para derivar la disponibilidad de un combo desde su stock. */
  componenteId: string
  nombre: string
  cantidad: number
}

/**
 * Opción excluyente que el cajero elige al vender (ej. tipo de proteína del
 * batido). El recargo es informativo en el cliente: el precio efectivo lo
 * recalcula `create_sale_atomic` desde la base (ADR 0017 §2.3).
 */
export interface PosProductOption {
  id: string
  grupo: string
  nombre: string
  precioExtra: number
  esDefault: boolean
}

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
  /** MOVE ON Club: genera sellos y puede canjearse como recompensa (RN-LF06). */
  participaFidelizacion: boolean
  /**
   * Stock disponible. `null` = el producto no rastrea stock ni se puede derivar
   * (`prepared`). En los combos es un valor derivado del producto incluido más
   * escaso, no un stock propio (ADR 0018).
   */
  stockDisponible: number | null
  /** Componentes que se descuentan automáticamente al vender este producto. */
  components: PosProductComponent[]
  /** Opciones elegibles al venderlo. Vacío = se vende directo, sin diálogo. */
  options: PosProductOption[]
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
