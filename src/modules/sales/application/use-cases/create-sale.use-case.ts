import { err, type Result } from '@/shared/result'
import type { Role, TiendaId, UserId } from '@/shared/types'
import type { ProductRepository } from '@/modules/products/domain/repositories/product.repository'
import type { InventoryRepository } from '@/modules/inventory/domain/repositories/inventory.repository'
import type { CashRegisterRepository } from '@/modules/cash-register/domain/repositories/cash-register.repository'
import type { Sale } from '../../domain/entities/sale.entity'
import type { SaleRepository } from '../../domain/repositories/sale.repository'
import {
  calculateCartItem,
  calculateCartTotals,
  validateDiscountAuthorization,
  validatePaymentsForSale,
} from '../../domain/services/sale-calculator'
import type { CreateSaleDto } from '../dtos/sale.dto'

export interface CreateSaleUseCaseInput extends CreateSaleDto {
  tiendaId: TiendaId
  cashierId: UserId
  cashierRole: Role
}

export interface CreateSaleUseCaseDeps {
  cashRepository: CashRegisterRepository
  inventoryRepository: InventoryRepository
  productRepository: ProductRepository
  saleRepository: SaleRepository
  now?: () => Date
}

function createSaleNumber(now: Date): string {
  const prefix = `${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
  return `${prefix}-${String(now.getTime())}`
}

export async function createSaleUseCase(
  input: CreateSaleUseCaseInput,
  deps: CreateSaleUseCaseDeps,
): Promise<Result<Sale>> {
  const sessionRes = await deps.cashRepository.getOpenSession(input.tiendaId)
  if (!sessionRes.ok) return err(sessionRes.error)
  if (!sessionRes.value) return err(new Error('No hay caja abierta. Abre la caja antes de vender.'))
  if (sessionRes.value.id !== input.cashSessionId) {
    return err(new Error('La sesión de caja no coincide con la caja activa.'))
  }

  const calculatedItems = []
  const saleItems = []
  const requestedByProduct = new Map<string, number>()

  for (const item of input.items) {
    const productRes = await deps.productRepository.findById(item.productId, input.tiendaId)
    if (!productRes.ok) return err(productRes.error)
    if (!productRes.value || !productRes.value.isActive) {
      return err(new Error(`Producto no disponible: "${item.productoNombre}"`))
    }

    const product = productRes.value
    if (item.discountAmount > product.precioVenta) {
      return err(new Error(`El descuento de "${product.nombre}" no puede superar el precio unitario`))
    }

    const calculated = calculateCartItem({
      productId:      product.id,
      nombre:         product.nombre,
      sku:            product.sku,
      unitPrice:      product.precioVenta,
      ivaTasa:        product.ivaTasa,
      quantity:       item.quantity,
      discountAmount: item.discountAmount,
    })
    calculatedItems.push(calculated)

    saleItems.push({
      productId:      calculated.productId,
      productoNombre: calculated.nombre,
      productoSku:    calculated.sku,
      quantity:       calculated.quantity,
      unitPrice:      calculated.unitPrice,
      discountAmount: calculated.discountAmount,
      taxRate:        calculated.ivaTasa,
      taxAmount:      calculated.taxAmount,
      total:          calculated.total,
      productType:    product.tipo,
    })

    if (product.tipo !== 'prepared') {
      requestedByProduct.set(product.id, (requestedByProduct.get(product.id) ?? 0) + item.quantity)
    }
  }

  const totals = calculateCartTotals(calculatedItems)
  const totalPaid = input.payments.reduce((sum, p) => sum + p.amount, 0)
  const change = Math.max(0, totalPaid - totals.total)

  const paymentError = validatePaymentsForSale(input.payments, totals.total)
  if (paymentError) return err(new Error(paymentError))

  const discountError = validateDiscountAuthorization(input.cashierRole, totals.subtotal, totals.discountTotal)
  if (discountError) return err(new Error(discountError))

  for (const [productId, quantity] of requestedByProduct) {
    const stockRes = await deps.inventoryRepository.getStock(productId, input.tiendaId)
    if (!stockRes.ok) return err(stockRes.error)
    if (stockRes.value < quantity) {
      const item = saleItems.find((saleItem) => saleItem.productId === productId)
      return err(new Error(`Stock insuficiente para "${item?.productoNombre ?? 'producto'}" (disponible: ${stockRes.value})`))
    }
  }

  return deps.saleRepository.create({
    tiendaId:       input.tiendaId,
    cashSessionId:  input.cashSessionId,
    saleNumber:     createSaleNumber((deps.now ?? (() => new Date()))()),
    cashierId:      input.cashierId,
    clienteId:      input.clienteId,
    items:          saleItems.map(({ productType: _productType, ...item }) => item),
    payments:       input.payments,
    subtotal:       totals.subtotal,
    discountTotal:  totals.discountTotal,
    taxTotal:       totals.taxTotal,
    total:          totals.total,
    change,
    idempotencyKey: input.idempotencyKey,
  })
}
