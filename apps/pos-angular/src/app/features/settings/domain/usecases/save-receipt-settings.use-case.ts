import { err, ok, type Result } from '@/shared/result'
import type { ReceiptSettings } from '@angular-app/features/settings/domain/entities/receipt-settings.entity'
import type { ReceiptSettingsRepository } from '@angular-app/features/settings/domain/repositories/receipt-settings.repository'
import { receiptSettingsSchema } from '@angular-app/features/settings/domain/dtos/receipt-settings.dto'

export interface SaveReceiptSettingsDeps {
  repo: Pick<ReceiptSettingsRepository, 'save'>
}

export interface SettingsValidationError {
  code: 'validation'
  message: string
}

/**
 * Guarda la configuración del comprobante. Valida con `receiptSettingsSchema`
 * y devuelve `Result`; los fallos técnicos (incluido el chequeo de rol admin
 * del repositorio) se propagan como `throw`.
 */
export async function saveReceiptSettings(
  deps: SaveReceiptSettingsDeps,
  value: ReceiptSettings,
): Promise<Result<void, SettingsValidationError>> {
  const parsed = receiptSettingsSchema.safeParse(value)
  if (!parsed.success) {
    return err({ code: 'validation', message: parsed.error.issues[0]?.message ?? 'Configuración inválida' })
  }
  await deps.repo.save(parsed.data)
  return ok(undefined)
}
