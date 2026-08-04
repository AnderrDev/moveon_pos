import { describe, expect, it } from 'vitest'
import {
  groupSalesByProduct,
  type ProductSalesSummary,
} from '@angular-app/features/reports/domain/services/top-products'
import type { Sale, SaleItem } from '@angular-app/features/sales/domain/entities/sale.entity'
import type { SaleStatus } from '@/shared/types'

/**
 * Construye un `SaleItem` mínimo con solo los campos que consume
 * `groupSalesByProduct` (`productId`, `productoNombre`, `productoSku`,
 * `quantity`, `unitPrice`, `total`). El resto se completa con valores
 * neutros para satisfacer el tipo.
 */
function makeItem(overrides: {
  productId: string
  productoNombre?: string
  productoSku?: string | null
  quantity: number
  unitPrice: number
  total: number
  unitCost?: number | null
}): SaleItem {
  return {
    id: `item-${overrides.productId}-${Math.random()}`,
    saleId: 'unused',
    productId: overrides.productId,
    productoNombre: overrides.productoNombre ?? `Producto ${overrides.productId}`,
    productoSku: overrides.productoSku ?? null,
    quantity: overrides.quantity,
    unitPrice: overrides.unitPrice,
    unitCost: overrides.unitCost ?? null,
    optionNombre: null,
    optionExtra: 0,
    discountAmount: 0,
    globalDiscountAmount: 0,
    taxRate: 0,
    taxAmount: 0,
    total: overrides.total,
  }
}

/**
 * Construye un `Sale` mínimo con solo los campos que consume
 * `groupSalesByProduct` (`id`, `status`, `items`). El resto se completa con
 * valores neutros para satisfacer el tipo.
 */
function makeSale(overrides: { id: string; status: SaleStatus; items: SaleItem[] }): Sale {
  const now = new Date('2026-06-23T15:00:00.000Z')
  const total = overrides.items.reduce((s, i) => s + i.total, 0)
  return {
    id: overrides.id,
    tiendaId: 'tienda-1',
    cashSessionId: 'session-1',
    saleNumber: `V-${overrides.id}`,
    clienteId: null,
    clienteNombre: null,
    cashierId: 'cashier-1',
    cashierEmail: 'cajero@example.com',
    status: overrides.status,
    billingStatus: 'pending',
    billingDocumentId: null,
    items: overrides.items,
    payments: [],
    subtotal: total,
    itemDiscountTotal: 0,
    globalDiscountTotal: 0,
    discountTotal: 0,
    discountReason: null,
    discountApprovedBy: null,
    taxTotal: 0,
    total,
    change: 0,
    idempotencyKey: `key-${overrides.id}`,
    voidedBy: null,
    voidedAt: null,
    voidedReason: null,
    createdAt: now,
    updatedAt: now,
  }
}

describe('groupSalesByProduct', () => {
  it('un producto vendido en 2 ventas distintas con cantidades distintas agrega numVentas, qty, total y avgPrice (ponderado por cantidad)', () => {
    const result = groupSalesByProduct([
      makeSale({
        id: 'sale-1',
        status: 'completed',
        items: [
          makeItem({ productId: 'prod-a', quantity: 2, unitPrice: 1000, total: 2000 }),
        ],
      }),
      makeSale({
        id: 'sale-2',
        status: 'completed',
        items: [
          makeItem({ productId: 'prod-a', quantity: 5, unitPrice: 1200, total: 6000 }),
        ],
      }),
    ])

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject<Partial<ProductSalesSummary>>({
      productId: 'prod-a',
      numVentas: 2,
      qty: 7,
      total: 8000,
      // total/qty ponderado: 8000/7 ≈ 1142.86 — NO avg(unitPrice) simple ((1000+1200)/2 = 1100)
      avgPrice: 1142.86,
    })
  })

  it('2 líneas del mismo producto dentro de la MISMA venta: numVentas cuenta 1 (ventas distintas, no líneas), pero qty suma ambas', () => {
    const result = groupSalesByProduct([
      makeSale({
        id: 'sale-1',
        status: 'completed',
        items: [
          makeItem({ productId: 'prod-a', quantity: 1, unitPrice: 1000, total: 1000 }),
          makeItem({ productId: 'prod-a', quantity: 3, unitPrice: 1000, total: 3000 }),
        ],
      }),
    ])

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject<Partial<ProductSalesSummary>>({
      productId: 'prod-a',
      numVentas: 1,
      qty: 4,
      total: 4000,
    })
  })

  it('ventas voided se excluyen completamente: producto solo presente en una voided no aparece en el resultado', () => {
    const result = groupSalesByProduct([
      makeSale({
        id: 'sale-1',
        status: 'completed',
        items: [makeItem({ productId: 'prod-a', quantity: 1, unitPrice: 1000, total: 1000 })],
      }),
      makeSale({
        id: 'sale-2',
        status: 'voided',
        items: [makeItem({ productId: 'prod-b', quantity: 9, unitPrice: 500, total: 4500 })],
      }),
    ])

    expect(result).toHaveLength(1)
    expect(result.map((r) => r.productId)).toEqual(['prod-a'])
  })

  it('lista de ventas vacía retorna []', () => {
    expect(groupSalesByProduct([])).toEqual([])
  })

  it('orden de salida determinista: total desc, desempate por productId asc', () => {
    const result = groupSalesByProduct([
      makeSale({
        id: 'sale-1',
        status: 'completed',
        items: [
          // mismo total → desempate por productId asc
          makeItem({ productId: 'prod-z', quantity: 1, unitPrice: 5000, total: 5000 }),
          makeItem({ productId: 'prod-a', quantity: 1, unitPrice: 5000, total: 5000 }),
          // total mayor → primero
          makeItem({ productId: 'prod-m', quantity: 1, unitPrice: 9000, total: 9000 }),
        ],
      }),
    ])

    expect(result.map((r) => r.productId)).toEqual(['prod-m', 'prod-a', 'prod-z'])
  })
})

// ─── costoTotal: costo congelado en la venta (ADR 0019) ──────────────────────

describe('groupSalesByProduct — costo de lo vendido', () => {
  it('suma el costo unitario por la cantidad de cada línea', () => {
    const [producto] = groupSalesByProduct([
      makeSale({
        id: 'sale-1',
        status: 'completed',
        items: [
          makeItem({ productId: 'p1', quantity: 2, unitPrice: 95000, total: 190000, unitCost: 60000 }),
        ],
      }),
    ])

    expect(producto.costoTotal).toBe(120000)
  })

  it('acumula el costo entre varias ventas del período', () => {
    const [producto] = groupSalesByProduct([
      makeSale({
        id: 'sale-1',
        status: 'completed',
        items: [makeItem({ productId: 'p1', quantity: 1, unitPrice: 95000, total: 95000, unitCost: 60000 })],
      }),
      makeSale({
        id: 'sale-2',
        status: 'completed',
        items: [makeItem({ productId: 'p1', quantity: 3, unitPrice: 95000, total: 285000, unitCost: 60000 })],
      }),
    ])

    expect(producto.costoTotal).toBe(240000)
  })

  it('respeta costos distintos del mismo producto entre ventas (el costo cambió)', () => {
    const [producto] = groupSalesByProduct([
      makeSale({
        id: 'sale-1',
        status: 'completed',
        items: [makeItem({ productId: 'p1', quantity: 1, unitPrice: 95000, total: 95000, unitCost: 60000 })],
      }),
      makeSale({
        id: 'sale-2',
        status: 'completed',
        items: [makeItem({ productId: 'p1', quantity: 1, unitPrice: 95000, total: 95000, unitCost: 70000 })],
      }),
    ])

    // Con el costo actual del catálogo ambas habrían costado lo mismo; con el
    // costo congelado cada venta conserva el suyo.
    expect(producto.costoTotal).toBe(130000)
  })

  it('devuelve null si a alguna línea le falta el costo, en vez de subestimarlo', () => {
    const [producto] = groupSalesByProduct([
      makeSale({
        id: 'sale-1',
        status: 'completed',
        items: [makeItem({ productId: 'p1', quantity: 1, unitPrice: 95000, total: 95000, unitCost: 60000 })],
      }),
      makeSale({
        id: 'sale-2',
        status: 'completed',
        items: [makeItem({ productId: 'p1', quantity: 1, unitPrice: 95000, total: 95000, unitCost: null })],
      }),
    ])

    expect(producto.costoTotal).toBeNull()
  })

  it('devuelve null cuando ninguna línea tiene costo', () => {
    const [producto] = groupSalesByProduct([
      makeSale({
        id: 'sale-1',
        status: 'completed',
        items: [makeItem({ productId: 'p1', quantity: 1, unitPrice: 11000, total: 11000 })],
      }),
    ])

    expect(producto.costoTotal).toBeNull()
  })

  it('las ventas anuladas no aportan costo', () => {
    const result = groupSalesByProduct([
      makeSale({
        id: 'sale-1',
        status: 'voided',
        items: [makeItem({ productId: 'p1', quantity: 5, unitPrice: 95000, total: 475000, unitCost: 60000 })],
      }),
    ])

    expect(result).toEqual([])
  })

  it('un costo de 0 es un costo conocido, no un costo ausente', () => {
    const [producto] = groupSalesByProduct([
      makeSale({
        id: 'sale-1',
        status: 'completed',
        items: [makeItem({ productId: 'p1', quantity: 2, unitPrice: 5000, total: 10000, unitCost: 0 })],
      }),
    ])

    expect(producto.costoTotal).toBe(0)
  })
})
