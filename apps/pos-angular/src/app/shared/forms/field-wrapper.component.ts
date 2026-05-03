import { ChangeDetectionStrategy, Component, input } from '@angular/core'

@Component({
  selector: 'mo-field-wrapper',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-1.5">
      @if (label()) {
        <span class="text-foreground text-sm font-semibold">
          {{ label() }}
          @if (required()) {
            <span class="text-destructive ml-0.5" aria-hidden="true">*</span>
          }
        </span>
      }

      <ng-content />

      @if (description() && !error()) {
        <p class="text-muted-foreground text-xs">{{ description() }}</p>
      }

      @if (error()) {
        <p class="text-destructive text-xs" role="alert">{{ error() }}</p>
      }
    </div>
  `,
})
export class FieldWrapperComponent {
  readonly label = input<string | null>(null)
  readonly description = input<string | null>(null)
  readonly error = input<string | null>(null)
  readonly required = input<boolean>(false)
}
