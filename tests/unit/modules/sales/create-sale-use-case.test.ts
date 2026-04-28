import { describe, expect, it } from 'vitest'
import { createSaleUseCase, type CreateSaleUseCaseDeps, type CreateSaleUseCaseInput } from '@/modules/sales/application/use-cases/create-sale.use-case'
import type { CashSession } from '@/modules/cash-register/domain/entities/cash-session.entity'
import type { Product } from '@/modules/products/domain/entities/product.entity'
import type { Sale } from '@/modules/sales/domain/entities/sale.entity'
import type { CreateSaleInput } from '@/modules/sales/domain/repositories/sale.repository'
import { err, ok } from '@/shared/result'

const tiendaId = 'tienda-1'
const cashierId = 'cashier-1'
const cashSessionId = '11111111-1111-4111-8111-111111111111'
const now = new Date('2026-04-27T15:30:00.000Z')

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id:            'product-1',
    tiendaId,
    nombre:        'Proteina',
    sku:           'PRO-1',
    codigoBarras:  null,
    categoriaId:   null,
    tipo:          'simple',
    unidad:        'unidad',
    precioVenta:   100_000,
    costo:         50_000,
    ivaTasa:       19,
    stockMinimo:   1,
    isActive:      true,
    createdAt:     now,
    updatedAt:     now,
    ...overrides,
  }
}

function makeOpenSession(overrides: Partial<CashSession> = {}): CashSession {
  return {
    id:                 cashSessionId,
    tiendaId,
    openedBy:           cashierId,
    closedBy:           null,
    status:             'open',
    openingAmount:      20_000,
    expectedCashAmount: null,
    actualCashAmount:   null,
    difference:         null,
    expectedSalesAmount: null,
    actualSalesAmount:   null,
    salesDifference:     null,
    paymentClosure:      null,
    notasCierre:        null,
    openedAt:           now,
    closedAt:           null,
    ...overrides,
  }
}

function makeInput(overrides: Partial<CreateSaleUseCaseInput> = {}): CreateSaleUseCaseInput {
  return {
    tiendaId,
    cashierId,
    cashierRole:    'cajero',
    cashSessionId,
    items:          [{
      productId:      'product-1',
      productoNombre: 'Nombre desde cliente',
      productoSku:    null,
      quantity:       2,
      unitPrice:      1,
      discountAmount: 5_000,
      taxRate:        0,
      taxAmount:      0,
      total:          2,
    }],
    payments:       [{ metodo: 'cash', amount: 226_100 }],
    subtotal:       2,
    discountTotal:  0,
    taxTotal:       0,
    total:          2,
    change:         0,
    idempotencyKey: 'idem-1',
    ...overrides,
  }
}

function makeSale(input: CreateSaleInput): Sale {
  return {
    id:                'sale-1',
    tiendaId:          input.tiendaId,
    cashSessionId:     input.cashSessionId,
    saleNumber:        input.saleNumber,
    clienteId:         input.clienteId ?? null,
    cashierId:         input.cashierId,
    status:            'completed',
    billingStatus:     'not_required',
    billingDocumentId: null,
    items:             input.items.map((item, index) => ({
      id:     `sale-item-${index + 1}`,
      saleId: 'sale-1',
      ...item,
    })),
    payments:          input.payments.map((payment, index) => ({
      id:         `payment-${index + 1}`,
      saleId:     'sale-1',
      metodo:     payment.metodo,
      amount:     payment.amount,
      referencia: payment.referencia ?? null,
      createdAt:  now,
    })),
    subtotal:          input.subtotal,
    discountTotal:     input.discountTotal,
    taxTotal:          input.taxTotal,
    total:             input.total,
    change:            input.change,
    idempotencyKey:    input.idempotencyKey,
    voidedBy:          null,
    voidedAt:          null,
    voidedReason:      null,
    createdAt:         now,
    updatedAt:         now,
  }
}

function makeDeps(options: {
  product?: Product | null
  session?: CashSession | null
  stock?: number
  createdInputs?: CreateSaleInput[]
} = {}): CreateSaleUseCaseDeps {
  const createdInputs = options.createdInputs ?? []
  const product = options.product === undefined ? makeProduct() : options.product
  const session = options.session === undefined ? makeOpenSession() : options.session
  const stock = options.stock ?? 10

  return {
    now: () => now,
    cashRepository: {
      getOpenSession:        async () => ok(session),
      getSessionById:        async () => ok(null),
      listSessions:          async () => ok([]),
      openSession:           async () => err(new Error('not implemented')),
      addMovement:           async () => err(new Error('not implemented')),
      listMovements:         async () => ok([]),
      getCashPaymentsTotal:  async () => ok(0),
      getPaymentBreakdown:   async () => ok([]),
      closeSession:          async () => err(new Error('not implemented')),
    },
    inventoryRepository: {
      getStock:        async () => ok(stock),
      getStockLevels:  async () => ok([]),
      getKardex:       async () => ok([]),
      registerEntry:   async () => err(new Error('not implemented')),
      adjustStock:     async () => err(new Error('not implemented')),
    },
    productRepository: {
      findById:      async () => ok(product),
      findByBarcode: async () => ok(null),
      search:        async () => ok([]),
      create:        async () => err(new Error('not implemented')),
      update:        async () => err(new Error('not implemented')),
      deactivate:    async () => err(new Error('not implemented')),
    },
    saleRepository: {
      create: async (input) => {
        createdInputs.push(input)
        return ok(makeSale(input))
      },
      findById:      async () => ok(null),
      listBySession: async () => ok([]),
      listByDate:    async () => ok([]),
      void:          async () => err(new Error('not implemented')),
    },
  }
}

describe('createSaleUseCase', () => {
  it('recalcula precios, impuestos y totales con datos del servidor', async () => {
    const createdInputs: CreateSaleInput[] = []
    const result = await createSaleUseCase(makeInput(), makeDeps({ createdInputs }))

    expect(result.ok).toBe(true)
    expect(createdInputs).toHaveLength(1)
    expect(createdInputs[0]).toMatchObject({
      saleNumber:    `260427-${now.getTime()}`,
      subtotal:      200_000,
      discountTotal: 10_000,
      taxTotal:      36_100,
      total:         226_100,
      change:        0,
    })
    expect(createdInputs[0].items[0]).toMatchObject({
      productoNombre: 'Proteina',
      productoSku:    'PRO-1',
      unitPrice:      100_000,
      taxRate:        19,
      taxAmount:      36_100,
      total:          226_100,
    })
  })

  it('rechaza pagos que no cubren el total recalculado', async () => {
    const result = await createSaleUseCase(
      makeInput({ payments: [{ metodo: 'transfer', amount: 10_000 }] }),
      makeDeps(),
    )

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.message).toBe('La suma de pagos no cubre el total de la venta')
    }
  })

  it('rechaza una sesión distinta a la caja activa', async () => {
    const result = await createSaleUseCase(
      makeInput(),
      makeDeps({ session: makeOpenSession({ id: '22222222-2222-4222-8222-222222222222' }) }),
    )

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.message).toBe('La sesión de caja no coincide con la caja activa.')
    }
  })

  it('rechaza productos inactivos o inexistentes', async () => {
    const result = await createSaleUseCase(
      makeInput(),
      makeDeps({ product: makeProduct({ isActive: false }) }),
    )

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.message).toBe('Producto no disponible: "Nombre desde cliente"')
    }
  })

  it('rechaza descuentos mayores al precio unitario del producto', async () => {
    const result = await createSaleUseCase(
      makeInput({ items: [{ ...makeInput().items[0], discountAmount: 100_001 }] }),
      makeDeps(),
    )

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.message).toBe('El descuento de "Proteina" no puede superar el precio unitario')
    }
  })

  it('valida stock agregado para productos simples', async () => {
    const result = await createSaleUseCase(makeInput(), makeDeps({ stock: 1 }))

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.message).toBe('Stock insuficiente para "Proteina" (disponible: 1)')
    }
  })

  it('no exige stock para productos preparados', async () => {
    const createdInputs: CreateSaleInput[] = []
    const result = await createSaleUseCase(
      makeInput({ payments: [{ metodo: 'cash', amount: 210_000 }] }),
      makeDeps({
        createdInputs,
        product: makeProduct({ tipo: 'prepared', ivaTasa: 5 }),
        stock:   0,
      }),
    )

    expect(result.ok).toBe(true)
    expect(createdInputs[0]).toMatchObject({
      taxTotal: 9_500,
      total:    199_500,
      change:   10_500,
    })
  })
})
