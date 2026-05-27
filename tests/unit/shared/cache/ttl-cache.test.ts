import { describe, expect, it, vi } from 'vitest'
import { TtlCache } from '@/shared/cache/ttl-cache'

const ttlMs = 1000

function makeClock(initial = 0) {
  let t = initial
  return {
    now: () => t,
    advance: (ms: number) => {
      t += ms
    },
  }
}

describe('TtlCache', () => {
  it('llama al loader la primera vez y devuelve su valor', async () => {
    const cache = new TtlCache<number>({ ttlMs })
    const loader = vi.fn().mockResolvedValue(42)

    const value = await cache.ensure('A', loader)

    expect(value).toBe(42)
    expect(loader).toHaveBeenCalledTimes(1)
  })

  it('reutiliza el valor cacheado mientras está fresco', async () => {
    const clock = makeClock()
    const cache = new TtlCache<number>({ ttlMs, now: clock.now })
    const loader = vi.fn().mockResolvedValue(1)

    await cache.ensure('A', loader)
    clock.advance(500)
    const second = await cache.ensure('A', loader)

    expect(second).toBe(1)
    expect(loader).toHaveBeenCalledTimes(1)
  })

  it('refetch cuando el TTL ha expirado', async () => {
    const clock = makeClock()
    const cache = new TtlCache<number>({ ttlMs, now: clock.now })
    const loader = vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(2)

    await cache.ensure('A', loader)
    clock.advance(ttlMs + 1)
    const second = await cache.ensure('A', loader)

    expect(second).toBe(2)
    expect(loader).toHaveBeenCalledTimes(2)
  })

  it('refetch cuando se pasa force=true aunque esté fresco', async () => {
    const cache = new TtlCache<number>({ ttlMs })
    const loader = vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(2)

    await cache.ensure('A', loader)
    const second = await cache.ensure('A', loader, { force: true })

    expect(second).toBe(2)
    expect(loader).toHaveBeenCalledTimes(2)
  })

  it('refetch al cambiar de scope', async () => {
    const cache = new TtlCache<number>({ ttlMs })
    const loader = vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(2)

    await cache.ensure('A', loader)
    const second = await cache.ensure('B', loader)

    expect(second).toBe(2)
    expect(loader).toHaveBeenCalledTimes(2)
  })

  it('coalescea llamadas concurrentes en un solo loader inflight', async () => {
    const cache = new TtlCache<number>({ ttlMs })
    let resolve!: (v: number) => void
    const loader = vi.fn(
      () =>
        new Promise<number>((r) => {
          resolve = r
        }),
    )

    const p1 = cache.ensure('A', loader)
    const p2 = cache.ensure('A', loader)
    resolve(7)
    const [v1, v2] = await Promise.all([p1, p2])

    expect(v1).toBe(7)
    expect(v2).toBe(7)
    expect(loader).toHaveBeenCalledTimes(1)
  })

  it('invalidate vacía cache e inflight', async () => {
    const cache = new TtlCache<number>({ ttlMs })
    const loader = vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(2)

    await cache.ensure('A', loader)
    cache.invalidate()
    const second = await cache.ensure('A', loader)

    expect(cache.current).toBe(2)
    expect(second).toBe(2)
    expect(loader).toHaveBeenCalledTimes(2)
  })

  it('respeta ttlMs por llamada cuando se pasa en options', async () => {
    const clock = makeClock()
    const cache = new TtlCache<number>({ ttlMs: 100, now: clock.now })
    const loader = vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(2)

    await cache.ensure('A', loader)
    clock.advance(50)
    const second = await cache.ensure('A', loader, { ttlMs: 10 })

    expect(second).toBe(2)
    expect(loader).toHaveBeenCalledTimes(2)
  })

  it('si el loader falla, no cachea y limpia inflight', async () => {
    const cache = new TtlCache<number>({ ttlMs })
    const loader = vi
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(99)

    await expect(cache.ensure('A', loader)).rejects.toThrow('boom')
    const second = await cache.ensure('A', loader)

    expect(second).toBe(99)
    expect(cache.current).toBe(99)
    expect(loader).toHaveBeenCalledTimes(2)
  })

  it('set() establece valor y scope sin llamar loader', async () => {
    const clock = makeClock()
    const cache = new TtlCache<number>({ ttlMs, now: clock.now })
    const loader = vi.fn().mockResolvedValue(0)

    cache.set('A', 123)
    const value = await cache.ensure('A', loader)

    expect(value).toBe(123)
    expect(loader).not.toHaveBeenCalled()
  })
})
