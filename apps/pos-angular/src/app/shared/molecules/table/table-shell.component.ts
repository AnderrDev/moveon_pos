import { ChangeDetectionStrategy, Component } from '@angular/core'

@Component({
  selector: 'mo-table-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'bg-card block overflow-auto rounded-xl border' },
  template: `<ng-content />`,
})
export class TableShellComponent {}
