import { formatCurrency } from '@/shared/lib/format'
import { getPaymentMethodLabel } from '@/shared/lib/payment-methods'
import {
  AUDIT_MODULES,
  auditModuleOf,
} from '@angular-app/features/audit/domain/services/audit-modules'

/**
 * Presentación legible de un registro de auditoría: nombre de la acción y
 * detalle campo por campo. Une las dos convenciones que conviven (acciones
 * de la app como `void` y de la base como `sale.voided`). TS puro, con tests.
 */

export type AuditBadgeVariant = 'default' | 'success' | 'warning' | 'destructive'

interface ActionInfo {
  label: string
  variant: AuditBadgeVariant
}

/** Acciones de la app; el sustantivo sale del tipo de entidad. */
const APP_ACTIONS: Record<string, ActionInfo> = {
  create: { label: 'Creó', variant: 'success' },
  update: { label: 'Editó', variant: 'default' },
  delete: { label: 'Eliminó', variant: 'destructive' },
  activate: { label: 'Activó', variant: 'success' },
  deactivate: { label: 'Desactivó', variant: 'warning' },
  void: { label: 'Anuló', variant: 'destructive' },
  open: { label: 'Abrió', variant: 'success' },
  close: { label: 'Cerró', variant: 'default' },
  entry: { label: 'Entrada de', variant: 'success' },
  adjust: { label: 'Ajustó stock de', variant: 'warning' },
  transfer: { label: 'Trasladó', variant: 'default' },
  correct_payment: { label: 'Corrigió el pago de', variant: 'warning' },
  correct_opening: { label: 'Corrigió la apertura de', variant: 'warning' },
  correct_movement: { label: 'Corrigió', variant: 'warning' },
}

const ENTITY_NOUNS: Record<string, string> = {
  venta: 'venta',
  sale: 'venta',
  producto: 'producto',
  product: 'producto',
  cliente: 'cliente',
  customer: 'cliente',
  sesion_caja: 'caja',
  cash_session: 'caja',
  movimiento_caja: 'movimiento de caja',
  cash_movement: 'movimiento de caja',
  movimiento_inventario: 'inventario',
  inventory_movement: 'inventario',
  expense: 'gasto',
}

/** Acciones de la base (con punto): texto completo. */
const DB_ACTIONS: Record<string, ActionInfo> = {
  'sale.voided': { label: 'Anuló venta', variant: 'destructive' },
  'sale.discount_applied': { label: 'Descuento en venta', variant: 'warning' },
  'sale.payment_corrected': { label: 'Corrigió método de pago', variant: 'warning' },
  'sale.payment_amount_corrected_legacy': { label: 'Corrigió monto de pago', variant: 'warning' },
  'sale.customer_corrected': { label: 'Corrigió cliente de venta', variant: 'warning' },
  'cash_session.closed': { label: 'Cerró caja', variant: 'default' },
  'cash_session.opening_corrected': { label: 'Corrigió apertura de caja', variant: 'warning' },
  'cash_session.retroactive_correction': { label: 'Corrección retroactiva de caja', variant: 'warning' },
  'cash_movement.voided': { label: 'Anuló movimiento de caja', variant: 'destructive' },
  'cash_movement.corrected': { label: 'Corrigió movimiento de caja', variant: 'warning' },
  'inventory.entry_registered': { label: 'Entrada de inventario', variant: 'success' },
  'inventory.entry_cost_corrected': { label: 'Corrigió costo de entrada', variant: 'warning' },
  'inventory.adjusted': { label: 'Ajustó stock', variant: 'warning' },
  'product.price_changed': { label: 'Cambió precio/costo', variant: 'default' },
  'product.components_saved': { label: 'Guardó receta', variant: 'default' },
  'product.options_saved': { label: 'Guardó opciones', variant: 'default' },
  'customer.deleted': { label: 'Eliminó cliente', variant: 'destructive' },
  'loyalty.stamps_adjusted': { label: 'Ajustó sellos', variant: 'warning' },
  'loyalty.rewards_expired': { label: 'Vencieron premios', variant: 'default' },
  'expense.created': { label: 'Registró gasto', variant: 'default' },
  'expense.voided': { label: 'Anuló gasto', variant: 'destructive' },
}

export function auditActionInfo(action: string, entityType: string | null): ActionInfo {
  const db = DB_ACTIONS[action]
  if (db) return db
  const app = APP_ACTIONS[action]
  if (app) {
    const noun = entityType ? ENTITY_NOUNS[entityType] : undefined
    return { label: noun ? `${app.label} ${noun}` : app.label, variant: app.variant }
  }
  return { label: action, variant: 'default' }
}

export function auditModuleLabel(entityType: string | null, action: string): string {
  const key = auditModuleOf(entityType, action)
  return AUDIT_MODULES.find((m) => m.key === key)?.label ?? 'Otro'
}

// ---------------- Detalle ----------------

export interface AuditDetailItem {
  label: string
  value: string
}

const FIELD_LABELS: Record<string, string> = {
  reason: 'Motivo',
  motivo: 'Motivo',
  notas_cierre: 'Nota de cierre',
  notasCierre: 'Nota de cierre',
  monto: 'Monto',
  amount: 'Monto',
  total: 'Total',
  subtotal: 'Subtotal',
  items: 'Líneas',
  payments: 'Pagos',
  cantidad: 'Cantidad',
  cantidadDelta: 'Cantidad',
  ubicacion: 'Ubicación',
  from: 'Desde',
  to: 'Hacia',
  categoria: 'Categoría',
  empleado: 'Empleado',
  metodo_pago: 'Método de pago',
  metodo: 'Método',
  fecha_gasto: 'Fecha del gasto',
  periodo: 'Periodo',
  tipo: 'Tipo',
  nombre: 'Nombre',
  sku: 'SKU',
  codigoBarras: 'Código de barras',
  unidad: 'Unidad',
  precio_venta: 'Precio',
  precioVenta: 'Precio',
  costo: 'Costo',
  costo_unitario: 'Costo unitario',
  costo_total: 'Costo total',
  ivaTasa: 'IVA',
  stockMinimo: 'Stock mínimo',
  isActive: 'Activo',
  participaFidelizacion: 'Participa en MOVE ON Club',
  paraQueSirve: 'Para qué sirve',
  recomendadoPara: 'Recomendado para',
  imageUrl: 'Imagen',
  categoriaId: 'Categoría',
  proveedorId: 'Proveedor',
  telefono: 'Teléfono',
  email: 'Correo',
  tipoDocumento: 'Tipo de documento',
  numeroDocumento: 'Documento',
  numero_documento: 'Documento',
  autorizaFidelizacion: 'Autoriza fidelización',
  aceptaMensajesPromocionales: 'Acepta mensajes',
  openingAmount: 'Base de apertura',
  opening_amount: 'Base de apertura',
  actual_cash_amount: 'Efectivo contado',
  actualCashAmount: 'Efectivo contado',
  expected_cash_amount: 'Efectivo esperado',
  cash_difference: 'Diferencia de efectivo',
  sales_difference: 'Diferencia de ventas',
  cash_left_amount: 'Efectivo que quedó',
  cashLeftAmount: 'Efectivo que quedó',
  closing_withdrawal_amount: 'Retiro al cierre',
  closingWithdrawalAmount: 'Retiro al cierre',
  product_cost_updated: 'Actualizó costo del producto',
  discount_total: 'Descuento total',
  discount_percentage: 'Descuento (%)',
  item_discount_total: 'Descuento por producto',
  global_discount_total: 'Descuento global',
  approved_by: 'Aprobado por',
  sale_number: 'Venta',
  delta: 'Sellos',
  balance_after: 'Saldo de sellos',
  components: 'Componentes',
  options: 'Opciones',
  unit_cost: 'Costo unitario',
  total_cost: 'Costo total',
  product_cost: 'Costo del producto',
  difference: 'Diferencia',
  payment_amount: 'Monto del pago',
}

/** Campos que no aportan al lector (ids, banderas redundantes). */
const HIDDEN_FIELDS = new Set(['has_notes', 'soft_delete', 'celular_normalizado'])

const LOCATION_LABELS: Record<string, string> = { punto_venta: 'Punto de venta', bodega: 'Bodega' }

const TYPE_LABELS: Record<string, string> = {
  cash_in: 'Entrada de efectivo',
  cash_out: 'Salida de efectivo',
  expense: 'Gasto',
  correction: 'Corrección',
  simple: 'Simple',
  prepared: 'Preparado',
  ingredient: 'Ingrediente',
  combo: 'Combo',
}

const EXPENSE_METHOD_LABELS: Record<string, string> = {
  efectivo_caja: 'Efectivo de la caja',
  efectivo_externo: 'Efectivo (fuera de caja)',
  transferencia: 'Transferencia',
  tarjeta: 'Tarjeta',
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MONEY_KEY = /(monto|amount|total|costo|cost|precio|difference|salario|discount_total)/i

function isIdField(key: string): boolean {
  return key === 'id' || key.endsWith('_id') || (key.endsWith('Id') && key !== 'proveedorId' && key !== 'categoriaId')
}

function methodLabel(value: string): string {
  return EXPENSE_METHOD_LABELS[value] ?? getPaymentMethodLabel(value)
}

function formatValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Sí' : 'No'
  if (typeof value === 'string' && UUID.test(value)) return '(cambió)'
  if (Array.isArray(value)) {
    if (key === 'payments') return value.map((v) => methodLabel(String(v))).join(', ')
    if (value.every((v) => typeof v !== 'object')) return value.join(', ')
    return `${value.length} ${value.length === 1 ? 'elemento' : 'elementos'}`
  }
  if (typeof value === 'object') return JSON.stringify(value)
  const numeric = typeof value === 'number' ? value : Number(value)
  if (key === 'discount_percentage' && Number.isFinite(numeric)) return `${numeric}%`
  if (key === 'ivaTasa' && Number.isFinite(numeric)) return `${numeric}%`
  if (MONEY_KEY.test(key) && Number.isFinite(numeric) && value !== '') return formatCurrency(numeric)
  if (typeof value === 'string') {
    if (key === 'ubicacion' || key === 'from' || key === 'to') return LOCATION_LABELS[value] ?? value
    if (key === 'tipo') return TYPE_LABELS[value] ?? value
    if (key.includes('metodo')) return methodLabel(value)
  }
  if (typeof value === 'number' || Number.isFinite(numeric)) return String(Number(numeric))
  return String(value)
}

function labelFor(key: string): string {
  return FIELD_LABELS[key] ?? key.replace(/_/g, ' ')
}

/**
 * En una corrección, `reason` es el motivo de corregir y el par
 * `old_motivo`/`new_motivo` es la descripción del movimiento: se nombran
 * distinto para no ver "Motivo" dos veces.
 */
function changedFieldLabel(base: string): string {
  return base === 'motivo' ? 'Descripción' : labelFor(base)
}

function isEmpty(value: unknown): boolean {
  return value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0)
}

function isFromTo(value: unknown): value is { from: unknown; to: unknown } {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && 'from' in value && 'to' in value
}

/**
 * Detalle legible de un registro. Une `metadata` y `changes`, junta los pares
 * `old_x`/`new_x` en una sola línea "antes → después", traduce métodos,
 * ubicaciones y tipos, da formato de moneda y oculta ids.
 */
export function formatAuditDetails(details: Record<string, unknown> | null): AuditDetailItem[] {
  if (!details) return []
  const items: AuditDetailItem[] = []
  const consumed = new Set<string>()

  for (const [key, value] of Object.entries(details)) {
    if (consumed.has(key) || HIDDEN_FIELDS.has(key) || isIdField(key)) continue

    // old_x / new_x → "x: antes → después"
    const pair = key.match(/^(old|new)_(.+)$/)
    if (pair) {
      const base = pair[2]
      const oldKey = `old_${base}`
      const newKey = `new_${base}`
      consumed.add(oldKey)
      consumed.add(newKey)
      const hasOld = oldKey in details
      const hasNew = newKey in details
      const oldValue = formatValue(base, details[oldKey])
      const newValue = formatValue(base, details[newKey])
      if (isEmpty(details[oldKey]) && isEmpty(details[newKey])) continue
      items.push({
        label: changedFieldLabel(base),
        value: hasOld && hasNew ? (oldValue === newValue ? newValue : `${oldValue} → ${newValue}`) : hasNew ? newValue : oldValue,
      })
      continue
    }

    // camelCase newX (registros antiguos de la app)
    const camelNew = key.match(/^new([A-Z].*)$/)
    if (camelNew) {
      const base = camelNew[1].charAt(0).toLowerCase() + camelNew[1].slice(1)
      if (isEmpty(value)) continue
      items.push({ label: changedFieldLabel(base === 'amount' ? 'monto' : base), value: formatValue(base, value) })
      continue
    }

    if (isFromTo(value)) {
      if (JSON.stringify(value.from) === JSON.stringify(value.to)) continue
      const from = formatValue(key, value.from)
      const to = formatValue(key, value.to)
      // Referencias (categoría, proveedor) se guardan como id: solo se sabe que cambió.
      items.push({ label: labelFor(key), value: from === to ? 'cambió' : `${from} → ${to}` })
      continue
    }

    // Campos vacíos no aportan ("Motivo: —"): se omiten.
    if (isEmpty(value)) continue
    items.push({ label: labelFor(key), value: formatValue(key, value) })
  }

  return items
}

/** Línea corta para la tabla: los primeros campos del detalle. */
export function summarizeAuditDetails(items: readonly AuditDetailItem[], max = 3): string {
  if (items.length === 0) return '—'
  const shown = items.slice(0, max).map((i) => `${i.label}: ${i.value}`).join(' · ')
  return items.length > max ? `${shown} · +${items.length - max}` : shown
}
