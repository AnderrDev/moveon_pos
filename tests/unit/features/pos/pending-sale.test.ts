import { describe, expect, it } from 'vitest'
import {
  clearPendingSale,
  pendingSaleMessage,
  readPendingSale,
  savePendingSale,
  type PendingSale,
} from '@angular-app/features/pos/presentation/services/pending-sale'

class MemoryStorage implements Storage {
  private data = new Map<string, string>()
  get length() { return this.data.size }
  clear() { this.data.clear() }
  getItem(key: string) { return this.data.get(key) ?? null }
  key(index: number) { return [...this.data.keys()][index] ?? null }
  removeItem(key: string) { this.data.delete(key) }
  setItem(key: string, value: string) { this.data.set(key, value) }
}

const sale: PendingSale = {
  idempotencyKey: 'key-1',
  tiendaId: 'tienda-1',
  total: 205000,
  startedAt: '2026-10-24T17:00:00.000Z',
}

const money = (n: number) => `$${n}`

describe('venta en curso (sessionStorage)', () => {
  it('guarda, lee y limpia la venta en curso de la tienda', () => {
    const storage = new MemoryStorage()
    savePendingSale(storage, sale)
    expect(readPendingSale(storage, 'tienda-1')).toEqual(sale)
    clearPendingSale(storage)
    expect(readPendingSale(storage, 'tienda-1')).toBeNull()
  })

  it('ignora la venta en curso de otra tienda y el contenido corrupto', () => {
    const storage = new MemoryStorage()
    savePendingSale(storage, sale)
    expect(readPendingSale(storage, 'tienda-2')).toBeNull()
    storage.setItem('mo.pos.pendingSale', '{no es json')
    expect(readPendingSale(storage, 'tienda-1')).toBeNull()
    storage.setItem('mo.pos.pendingSale', JSON.stringify({ ...sale, idempotencyKey: '' }))
    expect(readPendingSale(storage, 'tienda-1')).toBeNull()
  })

  it('no rompe sin storage o con storage bloqueado', () => {
    const blocked = {
      getItem: () => { throw new Error('SecurityError') },
      setItem: () => { throw new Error('QuotaExceeded') },
      removeItem: () => { throw new Error('SecurityError') },
    } as unknown as Storage
    expect(() => savePendingSale(blocked, sale)).not.toThrow()
    expect(() => clearPendingSale(blocked)).not.toThrow()
    expect(readPendingSale(blocked, 'tienda-1')).toBeNull()
    expect(readPendingSale(null, 'tienda-1')).toBeNull()
  })

  it('avisa si la venta quedó registrada o si hay que volver a cobrarla', () => {
    expect(pendingSaleMessage({ kind: 'registered', saleNumber: 'V-000123', total: 205000 }, money))
      .toBe('La venta de $205000 que se estaba cobrando sí quedó registrada (V-000123). No la cobres de nuevo.')
    expect(pendingSaleMessage({ kind: 'not_registered', total: 205000 }, money)).toContain('vuelve a cobrarla')
  })
})
