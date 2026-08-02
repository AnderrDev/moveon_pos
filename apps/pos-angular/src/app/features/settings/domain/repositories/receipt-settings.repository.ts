import type { ReceiptSettings } from '@angular-app/features/settings/domain/entities/receipt-settings.entity'

/**
 * Contrato de persistencia de la configuración del comprobante. Abstract
 * class (ADR 0015 §6.1). No existía interfaz previa — creado desde el uso
 * real de `ReceiptSettingsService` (PLAN-66). Admin-only: la implementación
 * resuelve la tienda y el rol vía sesión, no recibe `tiendaId` explícito
 * (mismo contrato que el servicio original).
 */
export abstract class ReceiptSettingsRepository {
  abstract load(): Promise<ReceiptSettings>
  abstract save(value: ReceiptSettings): Promise<void>
}
