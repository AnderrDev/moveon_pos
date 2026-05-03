import { ChangeDetectionStrategy, Component, input } from '@angular/core'
import { ControlContainer, FormGroupDirective, ReactiveFormsModule } from '@angular/forms'

@Component({
  selector: 'mo-form-checkbox',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  viewProviders: [{ provide: ControlContainer, useExisting: FormGroupDirective }],
  template: `
    <label class="flex cursor-pointer items-center gap-2 text-sm">
      <input
        type="checkbox"
        [formControlName]="controlName()"
        class="border-input h-4 w-4 rounded border accent-[hsl(var(--primary))]"
      />
      <span>{{ label() }}</span>
    </label>
    @if (description()) {
      <p class="text-muted-foreground ml-6 text-xs">{{ description() }}</p>
    }
  `,
})
export class FormCheckboxComponent {
  readonly controlName = input.required<string>()
  readonly label = input.required<string>()
  readonly description = input<string | null>(null)
}
