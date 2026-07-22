import { describe, expect, it } from 'vitest'
import type { Sale } from '@angular-app/features/sales/domain/entities/sale.entity'
import {
  buildEscPosReceipt,
  ESC_POS_RECEIPT_COLUMNS,
} from '@angular-app/core/printing/esc-pos-receipt.builder'

const sale: Sale = {
  id: 'sale-1',
  tiendaId: 'store-1',
  cashSessionId: 'session-1',
  saleNumber: 'V-000001',
  clienteId: null,
  clienteNombre: null,
  cashierId: 'user-1',
  cashierEmail: 'admin@moveonpos.co',
  status: 'completed',
  billingStatus: 'not_required',
  billingDocumentId: null,
  items: [
    {
      id: 'item-1',
      saleId: 'sale-1',
      productId: 'product-1',
      productoNombre: 'Batido hipercalorico de chocolate con nombre largo',
      productoSku: null,
      quantity: 1,
      unitPrice: 22_000,
      discountAmount: 0,
      globalDiscountAmount: 0,
      taxRate: 0,
      taxAmount: 0,
      total: 22_000,
    },
  ],
  payments: [
    {
      id: 'payment-1',
      saleId: 'sale-1',
      metodo: 'cash',
      amount: 22_000,
      referencia: null,
      createdAt: new Date('2026-06-12T12:00:00-05:00'),
    },
  ],
  subtotal: 22_000,
  itemDiscountTotal: 0,
  globalDiscountTotal: 0,
  discountTotal: 0,
  discountReason: null,
  discountApprovedBy: null,
  taxTotal: 0,
  total: 22_000,
  change: 0,
  idempotencyKey: 'key-1',
  voidedBy: null,
  voidedAt: null,
  voidedReason: null,
  createdAt: new Date('2026-06-12T12:00:00-05:00'),
  updatedAt: new Date('2026-06-12T12:00:00-05:00'),
}

describe('buildEscPosReceipt', () => {
  it('genera un trabajo RAW y termina con avance corto y corte', () => {
    const result = buildEscPosReceipt({
      sale,
      store: {
        titulo: 'COMPROBANTE DE VENTA',
        nit: '900123456-1',
        direccion: 'Calle 10 #20-30',
        ciudad: 'Medellin',
        telefono: '3001234567',
        mensajePie: 'Gracias por tu compra. Vuelve pronto!',
        mostrarNit: true,
        mostrarDireccion: true,
        mostrarTelefono: true,
        mostrarIva: false,
      },
      customer: null,
      cashierEmail: 'admin@moveonpos.co',
      change: 0,
    })

    expect(result.startsWith('\x1b@')).toBe(true)
    expect(result).toContain('COMPROBANTE DE VENTA')
    expect(result).not.toContain('TICKET INTERNO')
    expect(result).not.toContain('NO FISCAL')
    expect(result).not.toContain('FACTURA')
    expect(result).toContain('Batido hipercalorico de')
    expect(result).toContain('TOTAL')
    expect(result.endsWith('\x1bd\x03\x1dV\x00')).toBe(true)
    expect(result).not.toContain('\f')
  })

  it('mantiene las lineas de texto dentro de las 32 columnas', () => {
    const result = buildEscPosReceipt({
      sale,
      store: {
        titulo: 'COMPROBANTE DE VENTA',
        nit: null,
        direccion: null,
        ciudad: null,
        telefono: null,
        mensajePie: null,
        mostrarNit: false,
        mostrarDireccion: false,
        mostrarTelefono: false,
        mostrarIva: false,
      },
      customer: {
        nombre: 'Cliente con un nombre bastante extenso',
        tipoDocumento: 'CC',
        numeroDocumento: '1234567890',
      },
      cashierEmail: 'correo-muy-largo-para-probar@moveonpos.co',
      change: 0,
    })

    const printable = result
      .replace(/\x1b[@]/g, '')
      .replace(/\x1b[aE!d]./g, '')
      .replace(/\x1dV./g, '')
    const textLines = printable.split('\n').filter(Boolean)

    expect(textLines.every((line) => line.length <= ESC_POS_RECEIPT_COLUMNS)).toBe(true)
  })

  it('normaliza caracteres que una impresora generica puede imprimir mal', () => {
    const result = buildEscPosReceipt({
      sale: { ...sale, items: [{ ...sale.items[0]!, productoNombre: 'Proteina 100% - pina' }] },
      store: {
        titulo: 'COMPROBANTE DE VENTA',
        nit: null,
        direccion: null,
        ciudad: null,
        telefono: null,
        mensajePie: 'Gracias, vuelve pronto',
        mostrarNit: false,
        mostrarDireccion: false,
        mostrarTelefono: false,
        mostrarIva: false,
      },
      customer: null,
      cashierEmail: null,
      change: 0,
    })

    expect(result).toMatch(/^[\x00-\x7f]*$/)
  })
})
