import type { Provider } from '@angular/core'
import { ReceiptSettingsRepository } from '@angular-app/features/settings/domain/repositories/receipt-settings.repository'
import { ReceiptSettingsRepositoryImpl } from '@angular-app/features/settings/data/repositories/receipt-settings.repository'
import { LoyaltySettingsRepository } from '@angular-app/features/settings/domain/repositories/loyalty-settings.repository'
import { LoyaltySettingsRepositoryImpl } from '@angular-app/features/settings/data/repositories/loyalty-settings.repository'

/** Composition root de la feature (ADR 0015 §6.2). */
export const settingsProviders: Provider[] = [
  { provide: ReceiptSettingsRepository, useClass: ReceiptSettingsRepositoryImpl },
  { provide: LoyaltySettingsRepository, useClass: LoyaltySettingsRepositoryImpl },
]
