import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core'
import { ButtonComponent } from '../../shared/ui/button.component'
import { DialogComponent } from '../../shared/ui/dialog.component'

export type ReceiptOutputKind = 'receipt' | 'drawer'
export type ReceiptOutputStatus = 'printing' | 'error'

@Component({
  selector: 'mo-receipt-output-status-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, DialogComponent],
  template: `
    <mo-dialog
      [open]="open()"
      [title]="title()"
      [description]="description()"
      [busy]="status() === 'printing'"
      width="sm"
      (closed)="closed.emit()"
    >
      <div class="space-y-5" aria-live="polite">
        @if (status() === 'printing') {
          <div class="flex flex-col items-center px-3 py-5 text-center">
            <div
              class="border-primary/20 bg-primary/10 relative flex h-20 w-20 items-center justify-center rounded-2xl border"
            >
              <span
                class="border-primary/25 border-t-primary h-10 w-10 animate-spin rounded-full border-4"
                aria-hidden="true"
              ></span>
              <span
                class="bg-card absolute -right-2 -bottom-2 rounded-full border px-2 py-1 text-[10px] font-bold"
              >
                QZ
              </span>
            </div>
            <p class="mt-5 text-base font-bold">{{ progressLabel() }}</p>
            <p class="text-muted-foreground mt-1 max-w-xs text-sm leading-relaxed">
              La venta ya quedó guardada. Espera mientras terminamos la salida en la impresora.
            </p>
          </div>
        } @else {
          <div class="border-destructive/25 bg-destructive/10 rounded-xl border p-4">
            <p class="text-destructive text-sm font-bold">No se completó la salida</p>
            <p class="text-foreground mt-2 text-sm leading-relaxed">{{ errorMessage() }}</p>
            <p class="text-muted-foreground mt-3 text-xs leading-relaxed">
              La venta permanece registrada. Puedes corregir el problema y volver a intentarlo sin
              crear otra venta.
            </p>
          </div>

          <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <mo-button variant="outline" [fullWidth]="true" (click)="closed.emit()">
              Cerrar
            </mo-button>
            <mo-button [fullWidth]="true" (click)="retry.emit()">Reintentar</mo-button>
          </div>
        }
      </div>
    </mo-dialog>
  `,
})
export class ReceiptOutputStatusDialog {
  readonly open = input(false)
  readonly kind = input<ReceiptOutputKind>('receipt')
  readonly status = input<ReceiptOutputStatus>('printing')
  readonly errorMessage = input<string | null>(null)

  readonly retry = output<void>()
  readonly closed = output<void>()

  readonly title = computed(() =>
    this.status() === 'error'
      ? this.kind() === 'receipt'
        ? 'La tirilla no se imprimió'
        : 'La caja no se abrió'
      : this.kind() === 'receipt'
        ? 'Imprimiendo tirilla'
        : 'Abriendo caja',
  )

  readonly description = computed(() =>
    this.status() === 'error'
      ? 'La venta se completó correctamente, pero el dispositivo necesita atención.'
      : 'Completando la operación en la impresora configurada.',
  )

  readonly progressLabel = computed(() =>
    this.kind() === 'receipt' ? 'Enviando comprobante...' : 'Enviando pulso al cajón...',
  )
}
