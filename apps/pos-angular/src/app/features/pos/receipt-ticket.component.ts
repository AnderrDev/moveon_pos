import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core'
import { formatCurrency } from '@/shared/lib/format'
import { getPaymentMethodLabel } from '@/shared/lib/payment-methods'
import type { Sale } from '@/modules/sales/domain/entities/sale.entity'
import type { TiendaInfo } from '../../core/tienda/tienda-info.service'

export interface ReceiptCliente {
  nombre: string
  tipoDocumento: string | null
  numeroDocumento: string | null
}

@Component({
  selector: 'mo-receipt-ticket',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (sale(); as s) {
      @if (tienda(); as t) {
        <div class="receipt-print-area">
          <header class="receipt-header">
            <p class="receipt-title">{{ t.nombre }}</p>
            @if (t.receipt.mostrarNit && t.nit) {
              <p>NIT {{ t.nit }}</p>
            }
            @if (t.direccion) {
              <p>{{ t.direccion }}{{ t.ciudad ? ' · ' + t.ciudad : '' }}</p>
            }
            @if (t.receipt.mostrarTelefono && t.telefono) {
              <p>Tel. {{ t.telefono }}</p>
            }
          </header>

          <p class="receipt-banner">TICKET INTERNO — NO ES DOCUMENTO FISCAL</p>

          <section class="receipt-meta">
            <p><span>Venta:</span><span>{{ s.saleNumber }}</span></p>
            <p><span>Fecha:</span><span>{{ fecha(s.createdAt) }}</span></p>
            @if (cashierEmail()) {
              <p><span>Cajero:</span><span>{{ cashierEmail() }}</span></p>
            }
            @if (cliente(); as c) {
              <p>
                <span>Cliente:</span>
                <span>
                  {{ c.nombre }}
                  @if (c.tipoDocumento && c.numeroDocumento) {
                    ({{ c.tipoDocumento }} {{ c.numeroDocumento }})
                  }
                </span>
              </p>
            }
            @if (s.status === 'voided') {
              <p class="receipt-voided">VENTA ANULADA</p>
            }
          </section>

          <hr />

          <section class="receipt-items">
            @for (item of s.items; track item.id) {
              <div class="item">
                <p class="item-name">{{ item.productoNombre }}</p>
                <p class="item-line">
                  <span>{{ item.quantity }} × {{ money(item.unitPrice) }}</span>
                  <span>{{ money(item.total) }}</span>
                </p>
              </div>
            }
          </section>

          <hr />

          <section class="receipt-totals">
            <p><span>Subtotal</span><span>{{ money(s.subtotal) }}</span></p>
            @if (s.discountTotal > 0) {
              <p><span>Descuento</span><span>−{{ money(s.discountTotal) }}</span></p>
            }
            @if (s.taxTotal > 0) {
              <p><span>IVA</span><span>{{ money(s.taxTotal) }}</span></p>
            }
            <p class="total"><span>TOTAL</span><span>{{ money(s.total) }}</span></p>
          </section>

          <hr />

          <section class="receipt-payments">
            <p class="receipt-section-title">Pagos</p>
            @for (pay of s.payments; track pay.id) {
              <p>
                <span>
                  {{ paymentLabel(pay.metodo) }}
                  @if (pay.referencia) {
                    <span class="ref">· {{ pay.referencia }}</span>
                  }
                </span>
                <span>{{ money(pay.amount) }}</span>
              </p>
            }
            @if (change() > 0) {
              <p class="change"><span>Cambio</span><span>{{ money(change()) }}</span></p>
            }
          </section>

          @if (t.receipt.mensajePie) {
            <p class="receipt-footer">{{ t.receipt.mensajePie }}</p>
          }
        </div>
      }
    }
  `,
  styles: [
    `
      :host {
        display: contents;
      }

      .receipt-print-area {
        width: 72mm;
        max-width: 72mm;
        padding: 4mm 3mm;
        margin: 0 auto;
        font-family: ui-monospace, 'Fira Code', 'Courier New', monospace;
        font-size: 12px;
        line-height: 1.35;
        color: #111;
        background: #fff;
      }

      .receipt-print-area p {
        margin: 0;
      }

      .receipt-header {
        text-align: center;
        margin-bottom: 6px;
      }

      .receipt-title {
        font-weight: 700;
        font-size: 14px;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }

      .receipt-banner {
        text-align: center;
        font-weight: 600;
        font-size: 11px;
        margin: 4px 0 6px;
        text-transform: uppercase;
      }

      .receipt-voided {
        color: #b91c1c;
        font-weight: 700;
        text-align: center;
        margin-top: 4px;
      }

      hr {
        border: 0;
        border-top: 1px dashed #444;
        margin: 6px 0;
      }

      .receipt-meta p,
      .receipt-totals p,
      .receipt-payments p {
        display: flex;
        justify-content: space-between;
        gap: 8px;
      }

      .receipt-items .item {
        margin-bottom: 4px;
      }

      .receipt-items .item-name {
        font-weight: 600;
      }

      .receipt-items .item-line {
        display: flex;
        justify-content: space-between;
      }

      .receipt-totals .total {
        font-weight: 700;
        font-size: 14px;
        margin-top: 4px;
      }

      .receipt-payments .receipt-section-title {
        text-transform: uppercase;
        font-size: 11px;
        letter-spacing: 0.04em;
        margin-bottom: 2px;
      }

      .receipt-payments .ref {
        font-size: 10px;
        opacity: 0.7;
      }

      .receipt-payments .change {
        font-weight: 700;
        margin-top: 4px;
      }

      .receipt-footer {
        text-align: center;
        margin-top: 8px;
        font-size: 11px;
      }
    `,
  ],
})
export class ReceiptTicketComponent {
  readonly sale = input.required<Sale | null>()
  readonly tienda = input.required<TiendaInfo | null>()
  readonly cashierEmail = input<string | null>(null)
  readonly cliente = input<ReceiptCliente | null>(null)
  readonly changeOverride = input<number | null>(null)

  readonly change = computed<number>(() => {
    const override = this.changeOverride()
    if (override !== null) return override
    const s = this.sale()
    if (!s) return 0
    const paid = s.payments.reduce((acc, p) => acc + p.amount, 0)
    return Math.max(0, paid - s.total)
  })

  money(value: number): string {
    return formatCurrency(value)
  }

  paymentLabel(metodo: string): string {
    return getPaymentMethodLabel(metodo)
  }

  fecha(date: Date): string {
    return date.toLocaleString('es-CO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }
}
