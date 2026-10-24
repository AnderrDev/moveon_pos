import { Pipe, type PipeTransform } from '@angular/core'
import { getPaymentMethodLabel } from '@/shared/lib/payment-methods'

/** `{{ payment.metodo | paymentLabel }}` → "Transferencia". */
@Pipe({ name: 'paymentLabel', standalone: true })
export class PaymentLabelPipe implements PipeTransform {
  transform(method: string): string {
    return getPaymentMethodLabel(method)
  }
}
