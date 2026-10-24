import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core'
import { ToastService, type ToastVariant } from './toast.service'
import { Check, Info, TriangleAlert, X, LucideAngularModule } from 'lucide-angular'

interface ToastAppearance {
  accent: string
  icon: string
  iconBackground: string
  label: string
}

const APPEARANCE: Record<ToastVariant, ToastAppearance> = {
  success: {
    accent: 'bg-emerald-500',
    icon: 'text-emerald-700',
    iconBackground: 'bg-emerald-100',
    label: 'Correcto',
  },
  error: {
    accent: 'bg-destructive',
    icon: 'text-destructive',
    iconBackground: 'bg-destructive/10',
    label: 'Error',
  },
  warning: {
    accent: 'bg-amber-500',
    icon: 'text-amber-700',
    iconBackground: 'bg-amber-100',
    label: 'Atención',
  },
  info: {
    accent: 'bg-blue-500',
    icon: 'text-blue-700',
    iconBackground: 'bg-blue-100',
    label: 'Información',
  },
}

@Component({
  selector: 'mo-toast-host',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  template: `
    <div
      class="pointer-events-none fixed top-3 right-3 left-3 z-[70] flex flex-col items-end gap-2 sm:top-5 sm:right-5 sm:left-auto"
      aria-live="polite"
    >
      @for (item of items(); track item.id) {
        <div
          class="bg-card text-card-foreground pointer-events-auto relative flex w-fit min-w-0 max-w-full items-center gap-3 overflow-hidden rounded-xl border py-2.5 pr-2.5 pl-3 shadow-[0_12px_32px_-12px_rgba(15,23,42,0.32)] sm:min-w-72 sm:max-w-sm"
          [attr.role]="item.variant === 'error' ? 'alert' : 'status'"
          [attr.aria-label]="appearance(item.variant).label"
        >
          <span
            class="absolute inset-y-0 left-0 w-1"
            [class]="appearance(item.variant).accent"
            aria-hidden="true"
          ></span>

          <span
            class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
            [class]="appearance(item.variant).iconBackground"
            aria-hidden="true"
          >
            @switch (item.variant) {
              @case ('success') {
                <span class="inline-flex shrink-0" [class]="appearance(item.variant).icon"><lucide-angular [img]="icons.check" class="h-4 w-4" [strokeWidth]="2.25" aria-hidden="true" /></span>
              }
              @case ('error') {
                <span class="inline-flex shrink-0" [class]="appearance(item.variant).icon"><lucide-angular [img]="icons.x" class="h-4 w-4" [strokeWidth]="2.25" aria-hidden="true" /></span>
              }
              @case ('warning') {
                <span class="inline-flex shrink-0" [class]="appearance(item.variant).icon"><lucide-angular [img]="icons.alert" class="h-4 w-4" [strokeWidth]="1.9" aria-hidden="true" /></span>
              }
              @default {
                <span class="inline-flex shrink-0" [class]="appearance(item.variant).icon"><lucide-angular [img]="icons.info" class="h-4 w-4" [strokeWidth]="1.9" aria-hidden="true" /></span>
              }
            }
          </span>

          <div class="min-w-0 flex-1">
            @if (item.title) {
              <p class="text-sm leading-5 font-bold">{{ item.title }}</p>
            }
            <p class="text-sm leading-5 font-medium">{{ item.message }}</p>
          </div>

          <button
            type="button"
            (click)="dismiss(item.id)"
            class="text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors focus-visible:ring-2 focus-visible:outline-none"
            aria-label="Cerrar notificación"
          >
            <lucide-angular [img]="icons.x" class="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      }
    </div>
  `,
})
export class ToastHostComponent {
  readonly icons = { alert: TriangleAlert, check: Check, info: Info, x: X }

  private readonly service = inject(ToastService)
  readonly items = computed(() => this.service.items())

  appearance(variant: ToastVariant): ToastAppearance {
    return APPEARANCE[variant]
  }

  dismiss(id: string): void {
    this.service.dismiss(id)
  }
}
