import { describe, expect, it } from 'vitest'
import { auditDiff } from '@/shared/lib/audit-diff'

describe('auditDiff', () => {
  const before = { nombre: 'Whey', precio: 100000, sku: null as string | null, activo: true }

  it('devuelve solo lo que cambió, con antes y después', () => {
    const after = { ...before, precio: 105000, sku: 'WHY-1' }
    expect(auditDiff(before, after, ['nombre', 'precio', 'sku', 'activo'])).toEqual({
      precio: { from: 100000, to: 105000 },
      sku: { from: null, to: 'WHY-1' },
    })
  })

  it('vacío e indefinido cuentan como nulo: guardar sin cambios no deja diferencias', () => {
    expect(auditDiff({ ...before, sku: '' }, { ...before, sku: null }, ['sku'])).toEqual({})
    expect(auditDiff(before, { ...before }, ['nombre', 'precio', 'sku', 'activo'])).toEqual({})
  })

  it('solo mira los campos pedidos', () => {
    expect(auditDiff(before, { ...before, nombre: 'Otro' }, ['precio'])).toEqual({})
  })
})
