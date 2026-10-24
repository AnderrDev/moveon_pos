import { ChangeDetectionStrategy, Component, input } from '@angular/core'

@Component({
  selector: 'mo-page-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header
      class="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
    >
      <div>
        <h1 class="font-display text-2xl font-bold">{{ title() }}</h1>
        @if (subtitle()) {
          <p class="text-muted-foreground mt-1 text-sm">{{ subtitle() }}</p>
        }
      </div>
      <div class="flex flex-wrap items-center gap-2 sm:justify-end">
        <ng-content />
      </div>
    </header>
  `,
})
export class PageHeaderComponent {
  readonly title = input.required<string>()
  readonly subtitle = input<string | null>(null)
}
