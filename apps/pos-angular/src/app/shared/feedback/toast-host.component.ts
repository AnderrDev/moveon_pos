import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core'
import { ToastService, type ToastVariant } from './toast.service'

const VARIANT_CLASSES: Record<ToastVariant, string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-950',
  error: 'border-destructive/30 bg-destructive/10 text-destructive',
  warning: 'border-amber-200 bg-amber-50 text-amber-950',
  info: 'border-blue-200 bg-blue-50 text-blue-950',
}

@Component({
  selector: 'mo-toast-host',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="pointer-events-none fixed top-4 right-4 z-[70] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2"
      aria-live="polite"
      aria-atomic="true"
    >
      @for (item of items(); track item.id) {
        <div
          class="pointer-events-auto flex items-start gap-3 rounded-lg border px-4 py-3 shadow-lg ring-1 ring-black/5"
          [class]="variantClass(item.variant)"
        >
          <div class="min-w-0 flex-1">
            @if (item.title) {
              <p class="text-sm leading-5 font-semibold">{{ item.title }}</p>
            }
            <p class="text-sm leading-5">{{ item.message }}</p>
          </div>
          <button
            type="button"
            (click)="dismiss(item.id)"
            class="flex h-7 w-7 items-center justify-center rounded-lg opacity-70 transition hover:bg-black/5 hover:opacity-100"
            aria-label="Cerrar notificación"
          >
            ×
          </button>
        </div>
      }
    </div>
  `,
})
export class ToastHostComponent {
  private readonly service = inject(ToastService)
  readonly items = computed(() => this.service.items())

  variantClass(variant: ToastVariant): string {
    return VARIANT_CLASSES[variant]
  }

  dismiss(id: string): void {
    this.service.dismiss(id)
  }
}
