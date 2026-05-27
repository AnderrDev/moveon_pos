import { describe, expect, it } from 'vitest'
import { getErrorMessage } from '@/shared/lib/error-message'

describe('getErrorMessage', () => {
  it('devuelve message si es Error', () => {
    expect(getErrorMessage(new Error('boom'), 'fallback')).toBe('boom')
  })

  it('devuelve el string si es string', () => {
    expect(getErrorMessage('algo paso', 'fallback')).toBe('algo paso')
  })

  it('devuelve fallback si es null', () => {
    expect(getErrorMessage(null, 'fallback')).toBe('fallback')
  })

  it('devuelve fallback si es undefined', () => {
    expect(getErrorMessage(undefined, 'fallback')).toBe('fallback')
  })

  it('devuelve fallback si es objeto plano', () => {
    expect(getErrorMessage({ msg: 'no' }, 'fallback')).toBe('fallback')
  })

  it('subclase de Error funciona', () => {
    class MyErr extends Error {}
    expect(getErrorMessage(new MyErr('subclass'), 'fallback')).toBe('subclass')
  })
})
