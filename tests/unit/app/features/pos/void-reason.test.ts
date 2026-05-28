import { describe, it, expect } from 'vitest'
// Predicado puro extraído a void-reason.ts para correr en node sin TestBed.
import {
  isValidVoidReason,
  VOID_REASON_MIN_LENGTH,
} from '../../../../../apps/pos-angular/src/app/features/pos/void-reason'

describe('isValidVoidReason', () => {
  it('rechaza cadena vacía', () => {
    expect(isValidVoidReason('')).toBe(false)
  })

  it('rechaza solo espacios (trim)', () => {
    expect(isValidVoidReason('   ')).toBe(false)
  })

  it('rechaza un motivo corto', () => {
    expect(isValidVoidReason('corto')).toBe(false)
  })

  it('rechaza 9 caracteres (justo bajo el límite)', () => {
    expect(isValidVoidReason('motivo123')).toBe(false)
  })

  it('acepta exactamente 10 caracteres (límite inclusivo)', () => {
    expect(isValidVoidReason('1234567890')).toBe(true)
  })

  it('cuenta la longitud tras recortar espacios', () => {
    expect(isValidVoidReason('  motivo de prueba largo  ')).toBe(true)
  })

  it('expone el mínimo en 10', () => {
    expect(VOID_REASON_MIN_LENGTH).toBe(10)
  })
})
