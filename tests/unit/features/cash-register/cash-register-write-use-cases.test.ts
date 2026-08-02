import { describe, expect, it } from 'vitest'
import { openCashSession } from '@angular-app/features/cash-register/domain/usecases/open-session.use-case'
import { addCashMovement } from '@angular-app/features/cash-register/domain/usecases/add-movement.use-case'
import { voidCashMovement } from '@angular-app/features/cash-register/domain/usecases/void-movement.use-case'
import { closeCashSession } from '@angular-app/features/cash-register/domain/usecases/close-session.use-case'
import { correctCashSessionOpening } from '@angular-app/features/cash-register/domain/usecases/correct-opening.use-case'
import type { CashMovement, CashSession } from '@angular-app/features/cash-register/domain/entities/cash-session.entity'

const tiendaId = '11111111-1111-4111-8111-111111111111'
const sessionId = '22222222-2222-4222-8222-222222222222'
const movementId = '33333333-3333-4333-8333-333333333333'
const now = new Date('2026-07-17T00:00:00.000Z')

const session: CashSession = {
  id: sessionId,
  tiendaId,
  openedBy: 'user-1',
  closedBy: null,
  status: 'open',
  openingAmount: 50_000,
  expectedCashAmount: null,
  actualCashAmount: null,
  difference: null,
  expectedSalesAmount: null,
  actualSalesAmount: null,
  salesDifference: null,
  paymentClosure: null,
  notasCierre: null,
  openedAt: now,
  closedAt: null,
}

const movement: CashMovement = {
  id: movementId,
  cashSessionId: sessionId,
  tipo: 'cash_in',
  amount: 20_000,
  motivo: 'Cambio inicial',
  createdBy: 'user-1',
  createdAt: now,
  status: 'active',
  voidedBy: null,
  voidedAt: null,
  voidedReason: null,
}

describe('openCashSession', () => {
  it('abre la sesión cuando el monto es válido', async () => {
    const repo = { openSession: async () => session }
    const result = await openCashSession(
      { repo, tiendaId, openedBy: 'user-1' },
      { openingAmount: 50_000 },
    )
    expect(result).toEqual({ ok: true, value: session })
  })

  it('rechaza monto negativo sin llamar al repositorio', async () => {
    let called = false
    const repo = { openSession: async () => { called = true; return session } }
    const result = await openCashSession(
      { repo, tiendaId, openedBy: 'user-1' },
      { openingAmount: -1 },
    )
    expect(result.ok).toBe(false)
    expect(called).toBe(false)
  })
})

describe('addCashMovement', () => {
  it('registra el movimiento cuando los datos son válidos', async () => {
    const repo = { addMovement: async () => movement }
    const result = await addCashMovement(
      { repo, cashSessionId: sessionId, createdBy: 'user-1' },
      { tipo: 'cash_in', amount: 20_000, motivo: 'Cambio inicial' },
    )
    expect(result).toEqual({ ok: true, value: movement })
  })

  it('rechaza motivo demasiado corto sin llamar al repositorio', async () => {
    let called = false
    const repo = { addMovement: async () => { called = true; return movement } }
    const result = await addCashMovement(
      { repo, cashSessionId: sessionId, createdBy: 'user-1' },
      { tipo: 'cash_in', amount: 20_000, motivo: 'x' },
    )
    expect(result.ok).toBe(false)
    expect(called).toBe(false)
  })
})

describe('voidCashMovement', () => {
  it('anula el movimiento cuando el motivo es válido', async () => {
    let received: unknown = null
    const repo = {
      voidMovement: async (input: unknown) => {
        received = input
      },
    }
    const result = await voidCashMovement(
      { repo, tiendaId, voidedBy: 'user-1' },
      { movementId, reason: 'Registrado por error en el turno' },
    )
    expect(result.ok).toBe(true)
    expect(received).toEqual({
      movementId,
      tiendaId,
      voidedBy: 'user-1',
      voidedReason: 'Registrado por error en el turno',
    })
  })

  it('rechaza motivo demasiado corto sin llamar al repositorio', async () => {
    let called = false
    const repo = { voidMovement: async () => { called = true } }
    const result = await voidCashMovement(
      { repo, tiendaId, voidedBy: 'user-1' },
      { movementId, reason: 'corto' },
    )
    expect(result.ok).toBe(false)
    expect(called).toBe(false)
  })
})

describe('closeCashSession', () => {
  it('cierra la sesión y reempaqueta los montos por método en actualPayments', async () => {
    let received: unknown = null
    const repo = {
      closeSession: async (input: unknown) => {
        received = input
        return session
      },
    }
    const result = await closeCashSession(
      { repo, sessionId, tiendaId, closedBy: 'user-1' },
      { actualCashAmount: 50_000, actualTransferAmount: 15_000, notasCierre: 'Todo cuadrado' },
    )
    expect(result).toEqual({ ok: true, value: session })
    expect(received).toEqual({
      sessionId,
      tiendaId,
      closedBy: 'user-1',
      actualCashAmount: 50_000,
      actualPayments: [
        { metodo: 'card', total: 0 },
        { metodo: 'transfer', total: 15_000 },
        { metodo: 'other', total: 0 },
      ],
      notasCierre: 'Todo cuadrado',
    })
  })

  it('rechaza conteo de efectivo negativo sin llamar al repositorio', async () => {
    let called = false
    const repo = { closeSession: async () => { called = true; return session } }
    const result = await closeCashSession(
      { repo, sessionId, tiendaId, closedBy: 'user-1' },
      { actualCashAmount: -1 },
    )
    expect(result.ok).toBe(false)
    expect(called).toBe(false)
  })
})

describe('correctCashSessionOpening', () => {
  it('corrige la apertura cuando el motivo es válido', async () => {
    let received: unknown = null
    const repo = {
      correctOpening: async (input: unknown) => {
        received = input
        return session
      },
    }
    const result = await correctCashSessionOpening(
      { repo, tiendaId, correctedBy: 'user-1' },
      { sessionId, newAmount: 60_000, reason: 'Se contó mal el efectivo inicial' },
    )
    expect(result).toEqual({ ok: true, value: session })
    expect(received).toEqual({
      sessionId,
      tiendaId,
      newAmount: 60_000,
      correctedBy: 'user-1',
      reason: 'Se contó mal el efectivo inicial',
    })
  })

  it('rechaza motivo demasiado corto sin llamar al repositorio', async () => {
    let called = false
    const repo = { correctOpening: async () => { called = true; return session } }
    const result = await correctCashSessionOpening(
      { repo, tiendaId, correctedBy: 'user-1' },
      { sessionId, newAmount: 60_000, reason: 'corto' },
    )
    expect(result.ok).toBe(false)
    expect(called).toBe(false)
  })
})
