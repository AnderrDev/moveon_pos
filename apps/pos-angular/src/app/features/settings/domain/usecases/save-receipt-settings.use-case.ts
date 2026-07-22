import type { ReceiptSettings } from '@angular-app/features/settings/domain/entities/receipt-settings.entity'
import type { ReceiptSettingsRepository } from '@angular-app/features/settings/domain/repositories/receipt-settings.repository'

export interface SaveReceiptSettingsDeps {
  repo: Pick<ReceiptSettingsRepository, 'save'>
}

/**
 * Guarda la configuración del comprobante. Sin validación de forma propia —
 * `receiptSettingsFormSchema` (presentation/forms) ya es la fuente única de
 * validación del formulario. Seam delgado que delega en el repositorio; los
 * fallos (incluyendo el chequeo de rol admin) se propagan como `throw`.
 */
export function saveReceiptSettings(deps: SaveReceiptSettingsDeps, value: ReceiptSettings): Promise<void> {
  return deps.repo.save(value)
}
