import { describe, expect, it } from 'vitest'
import { SOCIAL_LINKS } from './links-content'

describe('SOCIAL_LINKS', () => {
  it('mantiene identificadores y destinos únicos', () => {
    expect(new Set(SOCIAL_LINKS.map((link) => link.id)).size).toBe(SOCIAL_LINKS.length)
    expect(new Set(SOCIAL_LINKS.map((link) => link.href)).size).toBe(SOCIAL_LINKS.length)
  })

  it('publica solo enlaces HTTPS', () => {
    expect(SOCIAL_LINKS.every((link) => link.href.startsWith('https://'))).toBe(true)
  })

  it('mantiene WhatsApp como única acción destacada', () => {
    expect(SOCIAL_LINKS.filter((link) => link.featured).map((link) => link.id)).toEqual([
      'whatsapp',
    ])
  })
})
