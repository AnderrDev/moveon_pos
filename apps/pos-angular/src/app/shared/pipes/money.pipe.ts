import { Pipe, type PipeTransform } from '@angular/core'
import { formatCurrency } from '@/shared/lib/format'

/** `{{ total | money }}` → "$ 205.000" (COP, sin centavos). Reemplaza los `money()` copiados por componente. */
@Pipe({ name: 'money', standalone: true })
export class MoneyPipe implements PipeTransform {
  transform(amount: number | null | undefined): string {
    return formatCurrency(amount ?? 0)
  }
}
