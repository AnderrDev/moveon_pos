import type { Provider } from '@angular/core'
import { InventoryRepository } from '@angular-app/features/inventory/domain/repositories/inventory.repository'
import { InventoryRepository as SupabaseInventoryRepository } from '@angular-app/features/inventory/data/repositories/inventory.repository'

/** Composition root de la feature (ADR 0015 §6.2). */
export const inventoryProviders: Provider[] = [
  { provide: InventoryRepository, useClass: SupabaseInventoryRepository },
]
