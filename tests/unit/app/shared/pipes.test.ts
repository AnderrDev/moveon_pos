import { describe, expect, it } from 'vitest'
import { MoneyPipe } from '@angular-app/shared/pipes/money.pipe'
import { PaymentLabelPipe } from '@angular-app/shared/pipes/payment-label.pipe'
import { formatCurrency } from '@/shared/lib/format'
import { getPaymentMethodLabel } from '@/shared/lib/payment-methods'

describe('pipes de presentación (ADR 0023)', () => {
  it('money formatea igual que formatCurrency y trata null/undefined como 0', () => {
    const pipe = new MoneyPipe()
    expect(pipe.transform(205000)).toBe(formatCurrency(205000))
    expect(pipe.transform(-20000)).toBe(formatCurrency(-20000))
    expect(pipe.transform(null)).toBe(formatCurrency(0))
  })

  it('paymentLabel usa la etiqueta del método de pago', () => {
    const pipe = new PaymentLabelPipe()
    expect(pipe.transform('transfer')).toBe(getPaymentMethodLabel('transfer'))
    expect(pipe.transform('desconocido')).toBe('desconocido')
  })
})
