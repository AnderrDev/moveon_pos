import type { Provider } from '@angular/core'
import { SaleRepository } from '@angular-app/features/sales/domain/repositories/sale.repository'
import { SalesRepository } from '@angular-app/features/sales/data/repositories/sales.repository'

/** Composition root de la feature (ADR 0015 §6.2). */
export const salesProviders: Provider[] = [
  { provide: SaleRepository, useClass: SalesRepository },
]
