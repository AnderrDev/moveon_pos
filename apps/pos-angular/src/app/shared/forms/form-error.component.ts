import { ChangeDetectionStrategy, Component, input } from '@angular/core'

@Component({
  selector: 'mo-form-error',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (message()) {
      <div
        role="alert"
        class="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-4 py-3 text-sm"
      >
        {{ message() }}
      </div>
    }
  `,
})
export class FormErrorComponent {
  readonly message = input<string | null>(null)
}
