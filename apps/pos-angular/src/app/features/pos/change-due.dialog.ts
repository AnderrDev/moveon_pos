import { ChangeDetectionStrategy, Component, input, output } from '@angular/core'
import { ButtonComponent } from '../../shared/ui/button.component'
import { DialogComponent } from '../../shared/ui/dialog.component'
import { formatCurrency } from '@/shared/lib/format'

/**
 * Diálogo bloqueante que obliga al cajero a confirmar la entrega del vuelto
 * antes de continuar. Evita que el monto desaparezca con el toast o quede
 * tapado por el diálogo de impresión/apertura de caja.
 */
@Component({
  selector: 'mo-change-due-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, DialogComponent],
  template: `
    <mo-dialog [open]="open()" title="Entrega el vuelto" [busy]="true" width="sm">
      <div class="flex flex-col items-center px-2 py-4 text-center">
        <p class="text-muted-foreground text-sm">Vuelto a entregar</p>
        <p class="text-primary mt-2 text-4xl font-bold tabular-nums">{{ money(amount()) }}</p>
        <p class="text-muted-foreground mt-4 max-w-xs text-sm leading-relaxed">
          Cuenta el efectivo antes de continuar con la siguiente venta.
        </p>
        <mo-button class="mt-6 w-full" [fullWidth]="true" (click)="confirmed.emit()">
          Vuelto entregado, continuar
        </mo-button>
      </div>
    </mo-dialog>
  `,
})
export class ChangeDueDialog {
  readonly open = input(false)
  readonly amount = input(0)

  readonly confirmed = output<void>()

  money(value: number): string {
    return formatCurrency(value)
  }
}
