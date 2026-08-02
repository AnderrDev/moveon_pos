import type { LoyaltyConfig } from '@angular-app/features/loyalty/domain/loyalty-config'

/**
 * Contrato de persistencia de la configuración del programa MOVE ON Club.
 * Abstract class (ADR 0015 §6.1). No existía interfaz previa — creado desde
 * el uso real de `LoyaltySettingsService` (PLAN-66). Admin-only: la
 * implementación resuelve la tienda y el rol vía sesión, no recibe
 * `tiendaId` explícito (mismo contrato que el servicio original).
 */
export abstract class LoyaltySettingsRepository {
  abstract load(): Promise<LoyaltyConfig>
  abstract save(value: LoyaltyConfig): Promise<void>
}
