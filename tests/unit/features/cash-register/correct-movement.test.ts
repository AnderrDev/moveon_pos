import { describe, expect, it, vi } from 'vitest'
import { correctCashMovement } from '@angular-app/features/cash-register/domain/usecases/correct-movement.use-case'

const MOVEMENT_ID = '22222222-2222-4222-8222-222222222222'

function deps() {
  return {
    repo: { correctMovement: vi.fn().mockResolvedValue(undefined) },
    tiendaId: 'tienda-1',
    correctedBy: 'user-1',
  }
}

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    movementId: MOVEMENT_ID,
    newAmount: 50_000,
    newMotivo: 'Pago proveedor de vasos',
    reason: 'Se registró un cero de más al digitar el monto',
    ...overrides,
  }
}

describe('correctCashMovement', () => {
  it('corrige monto y concepto', async () => {
    const d = deps()
    const result = await correctCashMovement(d, validInput())

    expect(result.ok).toBe(true)
    expect(d.repo.correctMovement).toHaveBeenCalledWith({
      movementId: MOVEMENT_ID,
      tiendaId: 'tienda-1',
      newAmount: 50_000,
      newMotivo: 'Pago proveedor de vasos',
      correctedBy: 'user-1',
      reason: 'Se registró un cero de más al digitar el monto',
    })
  })

  it('rechaza un monto en cero', async () => {
    const d = deps()
    const result = await correctCashMovement(d, validInput({ newAmount: 0 }))

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.message).toBe('El monto debe ser mayor a 0')
    expect(d.repo.correctMovement).not.toHaveBeenCalled()
  })

  it('rechaza un monto negativo', async () => {
    const d = deps()
    const result = await correctCashMovement(d, validInput({ newAmount: -1000 }))

    expect(result.ok).toBe(false)
    expect(d.repo.correctMovement).not.toHaveBeenCalled()
  })

  it('exige un concepto', async () => {
    const d = deps()
    const result = await correctCashMovement(d, validInput({ newMotivo: 'ab' }))

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.message).toBe('Describe el motivo')
  })

  it('exige un motivo de corrección de al menos 10 caracteres', async () => {
    const d = deps()
    const result = await correctCashMovement(d, validInput({ reason: 'error' }))

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.message).toBe(
        'El motivo de la corrección debe tener al menos 10 caracteres',
      )
    }
    expect(d.repo.correctMovement).not.toHaveBeenCalled()
  })

  it('recorta los espacios del concepto y del motivo', async () => {
    const d = deps()
    await correctCashMovement(
      d,
      validInput({ newMotivo: '  Pago vasos  ', reason: '  Monto mal digitado al registrar  ' }),
    )

    expect(d.repo.correctMovement).toHaveBeenCalledWith(
      expect.objectContaining({
        newMotivo: 'Pago vasos',
        reason: 'Monto mal digitado al registrar',
      }),
    )
  })
})
