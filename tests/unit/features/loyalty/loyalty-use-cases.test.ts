import { describe, expect, it } from 'vitest'
import { expireRewards } from '@angular-app/features/loyalty/domain/usecases/expire-rewards.use-case'
import { adjustStamps } from '@angular-app/features/loyalty/domain/usecases/adjust-stamps.use-case'

const tiendaId = 'tienda-1'

describe('expireRewards', () => {
  const tid = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'

  it('delega en el repositorio con el tiendaId correcto y devuelve el conteo', async () => {
    let received: string | null = null
    const repo = {
      expireRewards: async (t: string) => {
        received = t
        return 3
      },
    }
    const result = await expireRewards({ repo }, tid)
    expect(received).toBe(tid)
    expect(result).toEqual({ ok: true, value: 3 })
  })

  it('rechaza un tiendaId inválido sin llamar al repositorio', async () => {
    let called = false
    const repo = { expireRewards: async () => { called = true; return 0 } }
    const result = await expireRewards({ repo }, tiendaId)
    expect(result.ok).toBe(false)
    expect(called).toBe(false)
  })
})

describe('adjustStamps', () => {
  const valid = {
    tiendaId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
    clienteId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    createdBy: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
    delta: 2,
    reason: 'ajuste manual',
  }

  it('delega en el repositorio y devuelve el nuevo saldo', async () => {
    let received: unknown = null
    const repo = {
      adjustStamps: async (input: unknown) => {
        received = input
        return 7
      },
    }
    const result = await adjustStamps({ repo }, valid)
    expect(received).toEqual(valid)
    expect(result).toEqual({ ok: true, value: 7 })
  })

  it('rechaza delta cero o motivo corto sin llamar al repositorio', async () => {
    let called = false
    const repo = { adjustStamps: async () => { called = true; return 0 } }
    expect((await adjustStamps({ repo }, { ...valid, delta: 0 })).ok).toBe(false)
    expect((await adjustStamps({ repo }, { ...valid, reason: 'x' })).ok).toBe(false)
    expect(called).toBe(false)
  })
})
