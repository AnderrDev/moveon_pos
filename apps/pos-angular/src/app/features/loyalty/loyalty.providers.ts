import type { Provider } from '@angular/core'
import { LoyaltyRepository } from '@angular-app/features/loyalty/domain/repositories/loyalty.repository'
import { LoyaltyRepository as SupabaseLoyaltyRepository } from '@angular-app/features/loyalty/data/repositories/loyalty.repository'

/** Composition root de la feature (ADR 0015 §6.2). */
export const loyaltyProviders: Provider[] = [
  { provide: LoyaltyRepository, useClass: SupabaseLoyaltyRepository },
]
