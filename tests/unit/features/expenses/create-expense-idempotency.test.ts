import '@angular/compiler'
import { Injector, runInInjectionContext } from '@angular/core'
import { describe, expect, it } from 'vitest'
import { SupabaseClientService } from '@angular-app/core/supabase/supabase-client.service'
import { ExpensesRepository } from '@angular-app/features/expenses/data/repositories/expenses.repository'
import { createExpenseSchema } from '@angular-app/features/expenses/domain/dtos/expense.dto'

const tiendaId = '11111111-1111-4111-8111-111111111111'
const categoryId = '22222222-2222-4222-8222-222222222222'

describe('gastos idempotentes', () => {
  it('el DTO acepta la clave de idempotencia (opcional)', () => {
    const base = {
      tiendaId, categoryId, concepto: 'Hielo para batidos', monto: 5000,
      fechaGasto: '2026-10-24', metodoPago: 'efectivo_caja',
    }
    expect(createExpenseSchema.safeParse(base).success).toBe(true)
    const parsed = createExpenseSchema.safeParse({ ...base, idempotencyKey: 'flow-1' })
    expect(parsed.success && parsed.data.idempotencyKey).toBe('flow-1')
  })

  it('el repositorio envía p_idempotency_key a register_expense_atomic', async () => {
    const calls: Record<string, unknown>[] = []
    const injector = Injector.create({
      providers: [
        {
          provide: SupabaseClientService,
          useValue: {
            supabase: {
              rpc: async (_fn: string, args: Record<string, unknown>) => {
                calls.push(args)
                return {
                  data: {
                    id: 'gasto-1', tienda_id: tiendaId, category_id: categoryId, empleado_id: null,
                    concepto: 'Hielo para batidos', notas: null, monto: 5000, fecha_gasto: '2026-10-24',
                    metodo_pago: 'efectivo_caja', cash_movement_id: 'mov-1', periodo: null,
                    status: 'active', created_by: 'admin-1', created_at: '2026-10-24T17:00:00.000Z',
                    voided_by: null, voided_at: null, voided_reason: null, idempotency_key: 'flow-1',
                  },
                  error: null,
                }
              },
            },
          },
        },
      ],
    })
    const repo = runInInjectionContext(injector, () => new ExpensesRepository())
    await repo.createExpense(
      {
        tiendaId, categoryId, concepto: 'Hielo para batidos', monto: 5000,
        fechaGasto: '2026-10-24', metodoPago: 'efectivo_caja', idempotencyKey: 'flow-1',
      },
      'admin-1',
    )
    expect(calls[0]?.['p_idempotency_key']).toBe('flow-1')
  })
})
