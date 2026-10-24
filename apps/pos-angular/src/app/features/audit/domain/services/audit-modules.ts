/**
 * Módulos de la auditoría. Conviven dos convenciones de registro: las de la
 * app (`entity_type` en español: `venta`, `producto`...) y las de las
 * funciones de la base (`sale`, `product`... y acciones con punto como
 * `sale.voided`). Un módulo agrupa ambas para que el filtro las encuentre.
 * TS puro: lo usan el repositorio (filtro en el servidor) y la página.
 */
export type AuditModule = 'ventas' | 'caja' | 'inventario' | 'productos' | 'clientes' | 'finanzas'

export interface AuditModuleDefinition {
  key: AuditModule
  label: string
  /** `entity_type` que pertenecen al módulo. */
  entityTypes: readonly string[]
  /** Prefijos de acción (`inventory.` → `inventory.adjusted`, ...). */
  actionPrefixes: readonly string[]
}

export const AUDIT_MODULES: readonly AuditModuleDefinition[] = [
  { key: 'ventas', label: 'Ventas', entityTypes: ['venta', 'sale', 'payment'], actionPrefixes: ['sale.'] },
  {
    key: 'caja',
    label: 'Caja',
    entityTypes: ['sesion_caja', 'movimiento_caja', 'cash_session', 'cash_movement'],
    actionPrefixes: ['cash_session.', 'cash_movement.'],
  },
  {
    key: 'inventario',
    label: 'Inventario',
    entityTypes: ['movimiento_inventario', 'inventory_movement'],
    actionPrefixes: ['inventory.'],
  },
  { key: 'productos', label: 'Productos', entityTypes: ['producto'], actionPrefixes: ['product.'] },
  {
    key: 'clientes',
    label: 'Clientes y fidelización',
    entityTypes: ['cliente', 'customer', 'loyalty_account'],
    actionPrefixes: ['customer.', 'loyalty.'],
  },
  { key: 'finanzas', label: 'Finanzas', entityTypes: ['expense'], actionPrefixes: ['expense.'] },
]

/**
 * Módulo de un registro. La acción manda sobre el tipo: `inventory.adjusted`
 * se guarda con `entity_type = 'product'` pero es un movimiento de inventario.
 */
export function auditModuleOf(entityType: string | null, action: string): AuditModule | null {
  const byAction = AUDIT_MODULES.find((m) => m.actionPrefixes.some((p) => action.startsWith(p)))
  if (byAction) return byAction.key
  if (entityType === 'product') return 'productos'
  return AUDIT_MODULES.find((m) => entityType !== null && m.entityTypes.includes(entityType))?.key ?? null
}
