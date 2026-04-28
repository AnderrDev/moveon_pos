'use client'

import { Dialog } from '@/shared/components/ui/Dialog'
import { Button } from '@/shared/components/ui/Button'
import { formatCurrency as formatCOP } from '@/shared/lib/format'
import { getPaymentMethodLabel } from '@/shared/lib/payment-methods'

export interface TicketData {
  items: Array<{
    nombre: string
    sku: string | null
    quantity: number
    unitPrice: number
    discountAmount: number
    total: number
    ivaTasa: number
  }>
  payments: Array<{ metodo: string; amount: number }>
  totals: { subtotal: number; discountTotal: number; taxTotal: number; total: number }
  clienteNombre: string | null
}

interface Props {
  open: boolean
  saleNumber: string
  total: number
  change: number
  ticketData: TicketData
  onClose: () => void
}

function generateTicketHTML(saleNumber: string, change: number, data: TicketData): string {
  const now = new Date().toLocaleString('es-CO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
  const itemsHTML = data.items.map((item) => {
    const price = formatCOP(item.unitPrice)
    const total = formatCOP(item.total)
    const name  = item.nombre.length > 24 ? item.nombre.slice(0, 22) + '…' : item.nombre
    return `
      <tr>
        <td colspan="3" style="padding-top:4px;font-weight:600">${name}</td>
      </tr>
      <tr>
        <td style="color:#666">${item.quantity} × ${price}</td>
        <td></td>
        <td style="text-align:right;font-weight:600">${total}</td>
      </tr>
      ${item.discountAmount > 0 ? `<tr><td colspan="3" style="color:#c00;font-size:10px">Desc: -${formatCOP(item.discountAmount * item.quantity)}</td></tr>` : ''}
    `
  }).join('')

  const paymentsHTML = data.payments.map((p) =>
    `<tr><td>${getPaymentMethodLabel(p.metodo)}</td><td></td><td style="text-align:right">${formatCOP(p.amount)}</td></tr>`
  ).join('')

  return `
    <div style="text-align:center;margin-bottom:8px">
      <div style="font-size:16px;font-weight:800;letter-spacing:1px">MOVEONAPP POS</div>
      <div style="font-size:10px;color:#666">${now}</div>
      <div style="font-size:10px;color:#666">Venta #${saleNumber}</div>
      ${data.clienteNombre ? `<div style="font-size:10px">Cliente: ${data.clienteNombre}</div>` : ''}
    </div>
    <div style="border-top:1px dashed #000;margin:4px 0"></div>

    <table style="width:100%;border-collapse:collapse;font-size:11px">
      ${itemsHTML}
    </table>

    <div style="border-top:1px dashed #000;margin:6px 0"></div>
    <table style="width:100%;font-size:11px;border-collapse:collapse">
      ${data.totals.discountTotal > 0 ? `<tr><td>Descuentos</td><td></td><td style="text-align:right;color:#c00">-${formatCOP(data.totals.discountTotal)}</td></tr>` : ''}
      ${data.totals.taxTotal > 0 ? `<tr><td>IVA</td><td></td><td style="text-align:right">${formatCOP(data.totals.taxTotal)}</td></tr>` : ''}
      <tr style="font-size:14px;font-weight:800">
        <td>TOTAL</td><td></td><td style="text-align:right">${formatCOP(data.totals.total)}</td>
      </tr>
    </table>

    <div style="border-top:1px dashed #000;margin:6px 0"></div>
    <table style="width:100%;font-size:11px;border-collapse:collapse">
      ${paymentsHTML}
      ${change > 0 ? `<tr style="font-weight:700"><td>Cambio</td><td></td><td style="text-align:right">${formatCOP(change)}</td></tr>` : ''}
    </table>

    <div style="border-top:1px dashed #000;margin:8px 0"></div>
    <div style="text-align:center;font-size:10px;color:#666">¡Gracias por tu compra!</div>
  `
}

function handlePrint(saleNumber: string, change: number, data: TicketData) {
  const body = generateTicketHTML(saleNumber, change, data)
  const win  = window.open('', '_blank', 'width=380,height=700')
  if (!win) return
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>Ticket ${saleNumber}</title>
    <style>
      * { margin:0; padding:0; box-sizing:border-box }
      body { font-family:'Courier New',monospace; width:80mm; padding:5mm; font-size:12px }
      @media print { @page { size:80mm auto; margin:0 } body { padding:2mm } }
    </style>
  </head><body>${body}</body></html>`)
  win.document.close()
  setTimeout(() => { win.print(); win.close() }, 150)
}

export function SaleSuccessModal({ open, saleNumber, total, change, ticketData, onClose }: Props) {
  return (
    <Dialog open={open} onClose={onClose} title="">
      <div className="py-2 text-center">
        {/* Checkmark */}
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15">
          <svg viewBox="0 0 24 24" fill="none" className="h-8 w-8 text-emerald-600" aria-hidden>
            <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <h2 className="font-display text-xl font-bold text-foreground">¡Venta completada!</h2>
        <p className="mt-1 text-sm text-muted-foreground">Venta #{saleNumber}</p>
        {ticketData.clienteNombre && (
          <p className="mt-0.5 text-sm text-muted-foreground">Cliente: {ticketData.clienteNombre}</p>
        )}

        {/* Resumen */}
        <div className="mt-5 space-y-1.5 rounded-xl bg-muted/50 px-5 py-4 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total cobrado</span>
            <span className="font-bold tabular-nums">{formatCOP(total)}</span>
          </div>
          {ticketData.payments.map((p, i) => (
            <div key={i} className="flex justify-between text-muted-foreground">
              <span>{getPaymentMethodLabel(p.metodo)}</span>
              <span className="tabular-nums">{formatCOP(p.amount)}</span>
            </div>
          ))}
          {change > 0 && (
            <div className="flex justify-between border-t pt-1.5 font-bold text-primary">
              <span>Cambio al cliente</span>
              <span className="tabular-nums">{formatCOP(change)}</span>
            </div>
          )}
        </div>

        {/* Acciones */}
        <div className="mt-5 flex gap-2">
          <Button
            variant="outline"
            className="flex-1 gap-2"
            onClick={() => handlePrint(saleNumber, change, ticketData)}
          >
            <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" aria-hidden>
              <path d="M4 6V2h8v4M4 12H2V7h12v5h-2" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
              <rect x="4" y="10" width="8" height="4" rx="0.5" stroke="currentColor" strokeWidth="1.25"/>
            </svg>
            Ticket
          </Button>
          <Button className="flex-1" onClick={onClose} autoFocus>
            Nueva venta
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
