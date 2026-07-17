import type { Provider } from '@angular/core'
import { CashRegisterRepository } from '@angular-app/features/cash-register/domain/repositories/cash-register.repository'
import { CashRegisterRepository as SupabaseCashRegisterRepository } from '@angular-app/features/cash-register/data/repositories/cash-register.repository'

/**
 * Composition root de la feature (ADR 0015 §6.2): el único punto que conoce
 * el contrato de dominio Y su implementación Supabase a la vez. Se registra
 * en las rutas de la feature (`app.routes.ts`).
 */
export const cashRegisterProviders: Provider[] = [
  { provide: CashRegisterRepository, useClass: SupabaseCashRegisterRepository },
]
