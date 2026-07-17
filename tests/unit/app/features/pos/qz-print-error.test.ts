import { describe, expect, it } from 'vitest'
import { getQzPrintErrorMessage } from '@angular-app/features/pos/data/datasources/qz-print-error'

describe('getQzPrintErrorMessage', () => {
  it('explica fallos de firma sin exponer el error técnico', () => {
    expect(getQzPrintErrorMessage(new Error('Failed to sign request'), 'POS-58')).toContain(
      'autorizar la impresión',
    )
  })

  it('explica cuando QZ Tray no está conectado', () => {
    expect(
      getQzPrintErrorMessage(new Error('Unable to create a websocket connection'), 'POS-58'),
    ).toContain('QZ Tray no está instalado o abierto')
  })

  it('incluye el nombre configurado cuando no encuentra la impresora', () => {
    expect(getQzPrintErrorMessage(new Error('Printer not found'), 'Caja Principal')).toContain(
      'Caja Principal',
    )
  })

  it('explica cuando el sitio fue bloqueado', () => {
    expect(getQzPrintErrorMessage(new Error('Request blocked by user'), 'POS-58')).toContain(
      'autoriza este sitio',
    )
  })
})
