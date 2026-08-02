import { describe, expect, it } from 'vitest'
import { expireRewards } from '@angular-app/features/loyalty/domain/usecases/expire-rewards.use-case'
import { adjustStamps } from '@angular-app/features/loyalty/domain/usecases/adjust-stamps.use-case'

const tiendaId = 'tienda-1'

describe('expireRewards', () => {
  it('delega en el repositorio con el tiendaId correcto y devuelve el conteo', async () => {
    let received: string | null = null
    const repo = {
      expireRewards: async (tid: string) => {
        received = tid
        return 3
      },
    }
    const result = await expireRewards({ repo }, tiendaId)
    expect(received).toBe(tiendaId)
    expect(result).toBe(3)
  })
})

describe('adjustStamps', () => {
  it('delega en el repositorio y devuelve el nuevo saldo', async () => {
    let received: unknown = null
    const repo = {
      adjustStamps: async (input: unknown) => {
        received = input
        return 7
      },
    }
    const input = { tiendaId, clienteId: 'cliente-1', delta: 2, reason: 'ajuste manual', createdBy: 'user-1' }
    const result = await adjustStamps({ repo }, input)
    expect(received).toEqual(input)
    expect(result).toBe(7)
  })
})
