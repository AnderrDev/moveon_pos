import { describe, expect, it } from 'vitest'
import {
  formatPhoneCO,
  isValidPhoneCO,
  normalizePhoneCO,
} from '@angular-app/features/customers/domain/value-objects/phone-co'

describe('normalizePhoneCO', () => {
  it('acepta un celular limpio de 10 dígitos', () => {
    expect(normalizePhoneCO('3012244006')).toBe('3012244006')
  })

  it.each([
    ['+57 301 224 4006', '3012244006'],
    ['57 301 224 4006', '3012244006'],
    ['+573012244006', '3012244006'],
    ['573012244006', '3012244006'],
    ['301-224-4006', '3012244006'],
    ['(301) 224 4006', '3012244006'],
    ['301.224.4006', '3012244006'],
  ])('normaliza %s a %s', (input, expected) => {
    expect(normalizePhoneCO(input)).toBe(expected)
  })

  it.each([
    '',
    '301224400', // 9 dígitos
    '30122440067', // 11 dígitos sin prefijo válido
    '6012244006', // fijo de Bogotá, no celular
    '583012244006', // prefijo que no es 57
    '571012244006', // 57 + número que no empieza por 3
    'abc',
    '+57',
  ])('rechaza %s', (input) => {
    expect(normalizePhoneCO(input)).toBeNull()
    expect(isValidPhoneCO(input)).toBe(false)
  })
})

describe('formatPhoneCO', () => {
  it('formatea en bloques 3-3-4', () => {
    expect(formatPhoneCO('+573012244006')).toBe('301 224 4006')
  })

  it('devuelve la entrada intacta si no es normalizable', () => {
    expect(formatPhoneCO('no-es-celular')).toBe('no-es-celular')
  })
})
