import { describe, expect, it } from 'vitest'
import { auditModuleOf } from '@angular-app/features/audit/domain/services/audit-modules'
import {
  auditActionInfo,
  formatAuditDetails,
  summarizeAuditDetails,
} from '@angular-app/features/audit/presentation/services/audit-log-format'
import { rowToAuditLog } from '@angular-app/features/audit/data/models/audit-log.mapper'

const money = (n: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)

describe('acciones legibles', () => {
  it('traduce acciones de la base y de la app', () => {
    expect(auditActionInfo('sale.voided', 'sale')).toEqual({ label: 'Anuló venta', variant: 'destructive' })
    expect(auditActionInfo('void', 'venta')).toEqual({ label: 'Anuló venta', variant: 'destructive' })
    expect(auditActionInfo('update', 'producto').label).toBe('Editó producto')
    expect(auditActionInfo('algo.nuevo', null).label).toBe('algo.nuevo')
    expect(auditActionInfo('sale.item_cost_corrected', 'sale')).toEqual({ label: 'Corrigió costo de venta', variant: 'warning' })
    expect(auditModuleOf('sale', 'sale.item_cost_corrected')).toBe('ventas')
  })

  it('ubica cada registro en su módulo, con la acción por encima del tipo', () => {
    expect(auditModuleOf('product', 'inventory.adjusted')).toBe('inventario')
    expect(auditModuleOf('product', 'product.price_changed')).toBe('productos')
    expect(auditModuleOf('sesion_caja', 'open')).toBe('caja')
    expect(auditModuleOf('payment', 'sale.payment_corrected')).toBe('ventas')
    expect(auditModuleOf('expense', 'expense.created')).toBe('finanzas')
    expect(auditModuleOf('loyalty_account', 'loyalty.stamps_adjusted')).toBe('clientes')
  })
})

describe('detalle legible', () => {
  it('junta antes/después y da formato de moneda', () => {
    const items = formatAuditDetails({
      tipo: 'cash_in',
      reason: 'Error de digitación',
      old_amount: 22550,
      new_amount: 1,
      old_motivo: 'Hielo',
      new_motivo: 'hielo y arándanos',
    })
    expect(items).toEqual([
      { label: 'Tipo', value: 'Entrada de efectivo' },
      { label: 'Motivo', value: 'Error de digitación' },
      { label: 'Monto', value: `${money(22550)} → ${money(1)}` },
      { label: 'Descripción', value: 'Hielo → hielo y arándanos' },
    ])
  })

  it('muestra cambios {from,to}, oculta los que no cambiaron y los ids', () => {
    const items = formatAuditDetails({
      precio_venta: { from: 100000, to: 105000 },
      costo: { from: 74000, to: 74000 },
      categoriaId: { from: '7398ab76-8109-4de6-98c0-4b70f914b0da', to: '11111111-1111-4111-8111-111111111111' },
      sale_id: '82737b4e-580b-499b-8562-d15022f865a3',
    })
    expect(items).toEqual([
      { label: 'Precio', value: `${money(100000)} → ${money(105000)}` },
      { label: 'Categoría', value: 'cambió' },
    ])
  })

  it('traduce métodos, ubicaciones y booleanos', () => {
    expect(
      formatAuditDetails({ payments: ['cash', 'transfer'], ubicacion: 'punto_venta', metodo_pago: 'efectivo_caja', product_cost_updated: true, has_notes: false }),
    ).toEqual([
      { label: 'Pagos', value: 'Efectivo, Transferencia' },
      { label: 'Ubicación', value: 'Punto de venta' },
      { label: 'Método de pago', value: 'Efectivo de la caja' },
      { label: 'Actualizó costo del producto', value: 'Sí' },
    ])
  })

  it('omite los campos vacíos', () => {
    expect(formatAuditDetails({ motivo: null, notas_cierre: '', cantidad: 3, payments: [] })).toEqual([
      { label: 'Cantidad', value: '3' },
    ])
  })

  it('resume en una línea corta para la tabla', () => {
    const items = formatAuditDetails({ reason: 'x', cantidad: 2, ubicacion: 'bodega', motivo: 'Conteo' })
    expect(summarizeAuditDetails(items)).toBe('Motivo: x · Cantidad: 2 · Ubicación: Bodega · +1')
    expect(summarizeAuditDetails([])).toBe('—')
  })
})

describe('lectura del registro', () => {
  it('une metadata (base) y changes (app) en el detalle', () => {
    const log = rowToAuditLog({
      id: 'a', tienda_id: 't', user_id: null, user_email: null, entity_type: 'sale', entity_id: null,
      entity_label: 'V-1', action: 'sale.voided', changes: { extra: 1 }, metadata: { reason: 'r' },
      created_at: '2026-10-24T10:00:00Z',
    })
    expect(log.details).toEqual({ reason: 'r', extra: 1 })
    expect(log.userEmail).toBe('')
  })
})
