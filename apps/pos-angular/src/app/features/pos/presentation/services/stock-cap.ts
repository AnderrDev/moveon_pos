// Pure stock-cap helper extracted from the POS cart so it can be unit-tested in
// a node environment without Angular TestBed/jsdom (mismo patrón que role-policy.ts).

export interface CapQuantityResult {
  /** Cantidad final aplicada, nunca mayor a `max` cuando éste no es null. */
  quantity: number
  /** `true` cuando la cantidad solicitada se redujo por el tope de stock. */
  capped: boolean
}

/**
 * Acota una cantidad solicitada al stock disponible.
 *
 * - `max === null` => el producto no rastrea stock (ej. `prepared`): nunca se topa.
 * - `requested <= max` => se respeta lo solicitado (`capped: false`).
 * - `requested > max` => se devuelve `max` y `capped: true`.
 * - `max === 0` => no se puede agregar la unidad; devuelve `0` y `capped: true`
 *   (la página NO debe agregar el ítem en ese caso).
 */
export function capQuantity(requested: number, max: number | null): CapQuantityResult {
  if (max === null) return { quantity: requested, capped: false }
  if (requested > max) return { quantity: max, capped: true }
  return { quantity: requested, capped: false }
}
