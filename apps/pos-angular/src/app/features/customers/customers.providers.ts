import type { Provider } from '@angular/core'
import { CustomerRepository } from '@angular-app/features/customers/domain/repositories/customer.repository'
import { CustomersRepository } from '@angular-app/features/customers/data/repositories/customers.repository'

/** Composition root de la feature (ADR 0015 §6.2). */
export const customersProviders: Provider[] = [
  { provide: CustomerRepository, useClass: CustomersRepository },
]
