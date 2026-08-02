import { ChangeDetectionStrategy, Component, input } from '@angular/core'

@Component({
  selector: 'mo-empty-state',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bg-card flex flex-col items-center justify-center rounded-xl border p-10 text-center">
      <p class="text-foreground text-sm font-semibold">{{ title() }}</p>
      @if (description()) {
        <p class="text-muted-foreground mt-1 max-w-sm text-sm">{{ description() }}</p>
      }
      <div class="mt-4">
        <ng-content />
      </div>
    </div>
  `,
})
export class EmptyStateComponent {
  readonly title = input.required<string>()
  readonly description = input<string | null>(null)
}
