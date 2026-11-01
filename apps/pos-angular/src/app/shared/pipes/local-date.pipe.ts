import { Pipe, type PipeTransform } from '@angular/core'
import { formatLocalDate } from '@/shared/lib/format'

/** `{{ '2026-10-05' | localDate }}` → "5 oct". Para fechas locales `YYYY-MM-DD` (gastos, retiros). */
@Pipe({ name: 'localDate', standalone: true })
export class LocalDatePipe implements PipeTransform {
  transform(iso: string | null | undefined, options: Intl.DateTimeFormatOptions = {}): string {
    return iso ? formatLocalDate(iso, options) : ''
  }
}
