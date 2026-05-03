import { ChangeDetectionStrategy, Component, input } from '@angular/core'

@Component({
  selector: 'mo-page-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="mb-4 flex shrink-0 flex-col gap-2 sm:mb-5 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 class="font-display text-2xl font-bold">{{ title() }}</h1>
        @if (subtitle()) {
          <p class="text-muted-foreground mt-1 text-sm">{{ subtitle() }}</p>
        }
      </div>
      <div class="flex shrink-0 items-center gap-2">
        <ng-content />
      </div>
    </header>
  `,
})
export class PageHeaderComponent {
  readonly title = input.required<string>()
  readonly subtitle = input<string | null>(null)
}
