import type { Provider } from '@angular/core'
import { ExpenseRepository } from '@angular-app/features/expenses/domain/repositories/expense.repository'
import { ExpensesRepository } from '@angular-app/features/expenses/data/repositories/expenses.repository'

/** Composition root de la feature (ADR 0015 §6.2). */
export const expensesProviders: Provider[] = [
  { provide: ExpenseRepository, useClass: ExpensesRepository },
]
