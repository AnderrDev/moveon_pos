import { describe, expect, it } from 'vitest'
import { buildTurnSalesWorkbook } from '@angular-app/shared/services/export/turn-sales-export'
import type { CashSession } from '@angular-app/features/cash-register/domain/entities/cash-session.entity'

function makeClosedSession(): CashSession {
  return {
    id: 'session-1',
    tiendaId: 'store-1',
    openedBy: 'user-1',
    closedBy: 'user-2',
    status: 'closed',
    openingAmount: 150_000,
    expectedCashAmount: 480_000,
    actualCashAmount: 475_000,
    closingWithdrawalAmount: 325_000,
    cashLeftAmount: 150_000,
    difference: 5_000,
    expectedSalesAmount: 700_000,
    actualSalesAmount: 700_000,
    salesDifference: 0,
    paymentClosure: null,
    notasCierre: 'Faltante revisado',
    openedAt: new Date('2026-09-13T13:00:00Z'),
    closedAt: new Date('2026-09-13T21:00:00Z'),
  }
}

describe('buildTurnSalesWorkbook', () => {
  it('incluye el cuadre, retiro y efectivo dejado del cierre', () => {
    const workbook = buildTurnSalesWorkbook(makeClosedSession(), [], [])
    const resumen = workbook.sheets.find((sheet) => sheet.name === 'Resumen')

    expect(resumen?.rows).toEqual(
      expect.arrayContaining([
        ['Caja', 'Base de apertura', null, 150_000],
        ['Caja', 'Efectivo esperado antes del retiro', null, 480_000],
        ['Caja', 'Efectivo contado', null, 475_000],
        ['Caja', 'Diferencia de caja', null, 5_000],
        ['Caja', 'Retiro al cierre', null, 325_000],
        ['Caja', 'Efectivo dejado en caja', null, 150_000],
      ])
    )
  })

  it('permite exportar ventas sin una sesión de caja asociada', () => {
    expect(() => buildTurnSalesWorkbook(null, [], [])).not.toThrow()
  })
})
