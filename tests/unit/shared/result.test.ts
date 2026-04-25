import { describe, it, expect } from 'vitest'
import { ok, err, isOk, isErr } from '@/shared/result'

describe('Result type', () => {
  it('ok() crea un resultado exitoso', () => {
    const result = ok(42)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toBe(42)
    }
  })

  it('err() crea un resultado de error', () => {
    const result = err(new Error('algo salió mal'))
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.message).toBe('algo salió mal')
    }
  })

  it('isOk() identifica resultados exitosos', () => {
    expect(isOk(ok('valor'))).toBe(true)
    expect(isOk(err('error'))).toBe(false)
  })

  it('isErr() identifica resultados de error', () => {
    expect(isErr(err('error'))).toBe(true)
    expect(isErr(ok('valor'))).toBe(false)
  })
})
