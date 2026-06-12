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
      <div aria-live="polite">
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
          <div class="space-y-4">
            <div class="flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5">
              <span
                class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700"
                aria-hidden="true"
              >
                <svg viewBox="0 0 24 24" class="h-4 w-4">
                  <path d="m5 12.5 4 4L19 7" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.25" />
                </svg>
              </span>
              <div>
                <p class="text-sm font-bold text-emerald-950">La venta está segura</p>
                <p class="mt-0.5 text-xs leading-relaxed text-emerald-800">
                  Quedó registrada correctamente. Reintentar no creará otra venta ni cobrará de nuevo.
                </p>
              </div>
            </div>

            <div class="overflow-hidden rounded-xl border border-amber-200 bg-amber-50/70">
              <div class="flex gap-3 border-b border-amber-200 px-4 py-3.5">
                <span
                  class="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700"
                  aria-hidden="true"
                >
                  <svg viewBox="0 0 24 24" class="h-5 w-5">
                    <path d="M7 8V4h10v4M7 17H5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M7 14h10v6H7z" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" />
                    <path d="M17.5 11h.01" stroke="currentColor" stroke-linecap="round" stroke-width="2.4" />
                  </svg>
                </span>
                <div class="min-w-0">
                  <p class="text-sm font-bold text-amber-950">{{ deviceErrorTitle() }}</p>
                  <p class="mt-1 text-sm leading-relaxed text-amber-900">{{ errorMessage() }}</p>
                </div>
              </div>

              <div class="bg-card/70 px-4 py-3.5">
                <p class="text-foreground text-xs font-bold tracking-wide uppercase">Antes de reintentar</p>
                <ol class="mt-3 space-y-2.5">
                  @for (step of recoverySteps(); track step; let index = $index) {
                    <li class="text-muted-foreground flex gap-2.5 text-sm leading-5">
                      <span
                        class="bg-foreground text-background flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                      >
                        {{ index + 1 }}
                      </span>
                      <span>{{ step }}</span>
                    </li>
                  }
                </ol>
              </div>
            </div>

            <div class="grid grid-cols-1 gap-2 pt-1 sm:grid-cols-[1fr_1.35fr]">
              <mo-button variant="outline" [fullWidth]="true" (click)="closed.emit()">
                Cerrar por ahora
              </mo-button>
              <mo-button [fullWidth]="true" (click)="retry.emit()">
                Reintentar impresión
              </mo-button>
            </div>
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
        ? 'No pudimos imprimir la tirilla'
        : 'No pudimos abrir la caja'
      : this.kind() === 'receipt'
        ? 'Imprimiendo tirilla'
        : 'Abriendo caja',
  )

  readonly description = computed(() =>
    this.status() === 'error'
      ? 'La venta terminó bien. Solo falta resolver la conexión con el dispositivo.'
      : 'Completando la operación en la impresora configurada.',
  )

  readonly progressLabel = computed(() =>
    this.kind() === 'receipt' ? 'Enviando comprobante...' : 'Enviando pulso al cajón...',
  )

  readonly deviceErrorTitle = computed(() => {
    const error = this.normalizedError()
    if (error.includes('qz tray')) return 'QZ Tray necesita atención'
    if (error.includes('impresora configurada')) return 'Impresora no disponible'
    if (error.includes('autorizar')) return 'No se pudo autorizar la impresión'
    if (error.includes('logo')) return 'No se pudo preparar el comprobante'
    return this.kind() === 'receipt' ? 'La impresora no respondió' : 'El cajón no respondió'
  })

  readonly recoverySteps = computed(() => {
    const error = this.normalizedError()

    if (error.includes('qz tray')) {
      return [
        'Confirma que QZ Tray esté instalado y abierto en este computador.',
        'Si aparece una solicitud de acceso, selecciona Permitir y recuerda la decisión.',
        'Verifica que el icono de QZ Tray aparezca activo junto al reloj de Windows.',
      ]
    }

    if (error.includes('impresora configurada')) {
      return [
        'Conecta y enciende la impresora térmica en este computador.',
        'Comprueba en Windows que la impresora instalada tenga el mismo nombre configurado en MOVEONAPP.',
        'Si este equipo no imprime, puedes cerrar este mensaje y continuar trabajando.',
      ]
    }

    if (error.includes('autorizar')) {
      return [
        'Comprueba que este computador tenga conexión a internet.',
        'Mantén QZ Tray abierto y autoriza el sitio si muestra una solicitud.',
        'Espera unos segundos antes de volver a intentar.',
      ]
    }

    return [
      'Confirma que QZ Tray y la impresora estén encendidos y disponibles.',
      'Revisa el cable USB, el papel y que Windows no muestre la impresora sin conexión.',
      'Cuando el dispositivo esté listo, vuelve a intentarlo.',
    ]
  })

  private normalizedError(): string {
    return (this.errorMessage() ?? '').toLowerCase()
  }
}
