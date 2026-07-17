import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  input,
  output,
} from '@angular/core'

@Component({
  selector: 'mo-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
        <button
          type="button"
          aria-label="Cerrar"
          class="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
          [disabled]="busy()"
          (click)="onClose()"
        ></button>

        <section
          role="dialog"
          aria-modal="true"
          [attr.aria-labelledby]="'mo-dialog-title'"
          class="bg-card ring-border/60 relative z-10 flex max-h-[calc(100dvh-1.5rem)] w-full flex-col overflow-hidden rounded-2xl shadow-2xl ring-1"
          [class.max-w-md]="width() === 'sm'"
          [class.max-w-lg]="width() === 'md'"
          [class.max-w-2xl]="width() === 'lg'"
          [class.max-w-3xl]="width() === 'xl'"
        >
          <div class="bg-primary h-1" [class.animate-pulse]="busy()"></div>

          <header class="flex shrink-0 items-start justify-between border-b px-5 pt-4 pb-3 sm:px-6">
            <div>
              <h2 id="mo-dialog-title" class="font-display text-lg leading-none font-bold">
                {{ title() }}
              </h2>
              @if (description()) {
                <p class="text-muted-foreground mt-1.5 text-sm">{{ description() }}</p>
              }
            </div>
            <button
              type="button"
              [disabled]="busy()"
              (click)="onClose()"
              class="text-muted-foreground hover:bg-accent ml-4 shrink-0 rounded-lg p-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Cerrar"
            >
              ×
            </button>
          </header>

          <div class="min-h-0 overflow-y-auto p-5 sm:p-6">
            <ng-content />
          </div>
        </section>
      </div>
    }
  `,
})
export class DialogComponent {
  readonly open = input<boolean>(false)
  readonly title = input.required<string>()
  readonly description = input<string | null>(null)
  readonly busy = input<boolean>(false)
  readonly width = input<'sm' | 'md' | 'lg' | 'xl'>('md')

  readonly closed = output<void>()

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open() && !this.busy()) this.onClose()
  }

  onClose(): void {
    if (this.busy()) return
    this.closed.emit()
  }
}
