import { ChangeDetectionStrategy, Component, inject } from '@angular/core'
import { ReceiptPrintService } from './receipt-print.service'
import { ReceiptTicketComponent } from './receipt-ticket.component'

@Component({
  selector: 'mo-receipt-print-host',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReceiptTicketComponent],
  template: `
    @if (service.visible()) {
      <div class="receipt-print-host">
        <mo-receipt-ticket
          [sale]="service.sale()"
          [tienda]="service.tienda()"
          [cliente]="service.cliente()"
          [cashierEmail]="service.cashierEmail()"
          [changeOverride]="service.change()"
        />
      </div>
    }
  `,
  styles: [
    `
      .receipt-print-host {
        position: fixed;
        inset: 0;
        z-index: -1;
        opacity: 0;
        pointer-events: none;
      }
    `,
  ],
})
export class ReceiptPrintHostComponent {
  readonly service = inject(ReceiptPrintService)
}
