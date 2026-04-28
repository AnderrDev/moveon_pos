'use client'

import type { CashSession, CashMovement } from '../domain/entities/cash-session.entity'
import type { CashSessionPaymentBreakdown } from '../domain/repositories/cash-register.repository'
import { AddMovementDialog } from './AddMovementDialog'
import { CloseSessionDialog } from './CloseSessionDialog'
import { formatCurrency as formatCOP, formatTime } from '@/shared/lib/format'
import { getPaymentMethodLabel } from '@/shared/lib/payment-methods'

function printCashReport(
  session: CashSession,
  movements: CashMovement[],
  paymentBreakdown: CashSessionPaymentBreakdown[],
  expected: number,
) {
  const now     = new Date().toLocaleString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  const opened  = session.openedAt.toLocaleString('es-CO', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  const ingresos = movements.filter((m) => m.tipo === 'cash_in').reduce((s, m) => s + m.amount, 0)
  const egresos  = movements.filter((m) => m.tipo !== 'cash_in').reduce((s, m) => s + m.amount, 0)
  const cashPaymentsTotal = paymentBreakdown.find((p) => p.metodo === 'cash')?.total ?? 0
  const digitalRows = paymentBreakdown
    .filter((p) => p.metodo !== 'cash')
    .map((p) => `
      <tr>
        <td>${getPaymentMethodLabel(p.metodo)}</td>
        <td style="text-align:center">${p.count}</td>
        <td style="text-align:right">${formatCOP(p.total)}</td>
      </tr>
    `).join('')

  const movRows = movements.map((m) => `
    <tr>
      <td>${formatTime(m.createdAt)}</td>
      <td>${m.tipo === 'cash_in' ? 'Ingreso' : m.tipo === 'cash_out' ? 'Egreso' : 'Gasto'}</td>
      <td>${m.motivo ?? ''}</td>
      <td style="text-align:right;${m.tipo === 'cash_in' ? 'color:#16a34a' : 'color:#dc2626'}">${m.tipo === 'cash_in' ? '+' : '-'}${formatCOP(m.amount)}</td>
    </tr>`).join('')

  const html = `
    <div style="text-align:center;margin-bottom:10px">
      <div style="font-size:16px;font-weight:800">MOVEONAPP POS</div>
      <div style="font-size:11px">Cuadre de caja</div>
      <div style="font-size:10px;color:#666">Impreso: ${now}</div>
    </div>
    <div style="border-top:1px dashed #000;margin:6px 0"></div>
    <table style="width:100%;font-size:11px;border-collapse:collapse">
      <tr><td>Apertura</td><td style="text-align:right">${opened}</td></tr>
      <tr><td>Monto inicial</td><td style="text-align:right">${formatCOP(session.openingAmount)}</td></tr>
      <tr><td>Ventas efectivo</td><td style="text-align:right">${formatCOP(cashPaymentsTotal)}</td></tr>
      <tr><td>Ingresos</td><td style="text-align:right;color:#16a34a">+${formatCOP(ingresos)}</td></tr>
      <tr><td>Egresos</td><td style="text-align:right;color:#dc2626">-${formatCOP(egresos)}</td></tr>
    </table>
    <div style="border-top:1px solid #000;margin:6px 0"></div>
    <table style="width:100%;font-size:13px;font-weight:800;border-collapse:collapse">
      <tr><td>EFECTIVO ESPERADO</td><td style="text-align:right">${formatCOP(expected)}</td></tr>
    </table>
    ${movements.length > 0 ? `
      <div style="border-top:1px dashed #000;margin:8px 0"></div>
      <div style="font-size:10px;font-weight:700;margin-bottom:4px">MOVIMIENTOS</div>
      <table style="width:100%;font-size:10px;border-collapse:collapse">
        ${movRows}
      </table>
    ` : ''}
    ${digitalRows ? `
      <div style="border-top:1px dashed #000;margin:8px 0"></div>
      <div style="font-size:10px;font-weight:700;margin-bottom:4px">OTROS MEDIOS</div>
      <table style="width:100%;font-size:10px;border-collapse:collapse">
        <tr><td>Método</td><td style="text-align:center">#</td><td style="text-align:right">Total</td></tr>
        ${digitalRows}
      </table>
    ` : ''}
    <div style="border-top:1px dashed #000;margin:8px 0;text-align:center;font-size:10px;color:#666">
      Efectivo contado: __________ <br/><br/>
      Diferencia: __________
    </div>
  `

  const win = window.open('', '_blank', 'width=380,height=700')
  if (!win) return
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>Cuadre de caja</title>
    <style>
      * { margin:0;padding:0;box-sizing:border-box }
      body { font-family:'Courier New',monospace;width:80mm;padding:5mm;font-size:12px }
      @media print { @page { size:80mm auto;margin:0 } body { padding:2mm } }
    </style>
  </head><body>${html}</body></html>`)
  win.document.close()
  setTimeout(() => { win.print(); win.close() }, 150)
}

const TIPO_LABELS: Record<string, string> = {
  cash_in:    'Ingreso',
  cash_out:   'Egreso',
  expense:    'Gasto',
  correction: 'Corrección',
}

interface Props {
  session: CashSession
  movements: CashMovement[]
  paymentBreakdown: CashSessionPaymentBreakdown[]
}

export function SessionSummary({ session, movements, paymentBreakdown }: Props) {
  const ingresos  = movements.filter((m) => m.tipo === 'cash_in').reduce((s, m) => s + m.amount, 0)
  const egresos   = movements.filter((m) => m.tipo !== 'cash_in').reduce((s, m) => s + m.amount, 0)
  const cashPaymentsTotal = paymentBreakdown.find((p) => p.metodo === 'cash')?.total ?? 0
  const digitalPayments = paymentBreakdown.filter((p) => p.metodo !== 'cash')
  const digitalTotal = digitalPayments.reduce((sum, p) => sum + p.total, 0)
  const expected  = session.openingAmount + cashPaymentsTotal + ingresos - egresos

  return (
    <div className="space-y-6">
      {/* Resumen de saldos */}
      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: 'Apertura',        value: session.openingAmount, neutral: true },
          { label: 'Ventas efectivo', value: cashPaymentsTotal, positive: true },
          { label: 'Ingresos',        value: ingresos,  positive: true },
          { label: 'Egresos',         value: egresos,   negative: true },
        ].map(({ label, value, positive, negative }) => (
          <div key={label} className="rounded-xl border bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className={`mt-1 font-display text-2xl font-bold tabular-nums ${positive ? 'text-green-600' : negative ? 'text-destructive' : 'text-foreground'}`}>
              {formatCOP(value)}
            </p>
          </div>
        ))}
      </div>

      {digitalPayments.length > 0 && (
        <div className="rounded-xl border bg-card">
          <div className="flex items-center justify-between border-b px-5 py-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Otros medios confirmados</p>
              <p className="text-sm text-muted-foreground">Validación manual por hora, valor y método</p>
            </div>
            <p className="font-display text-xl font-bold tabular-nums text-foreground">{formatCOP(digitalTotal)}</p>
          </div>
          <table className="w-full text-sm">
            <tbody className="divide-y">
              {digitalPayments.map((p) => (
                <tr key={p.metodo} className="hover:bg-muted/30 transition-colors">
                  <td className="px-5 py-3 font-medium">{getPaymentMethodLabel(p.metodo)}</td>
                  <td className="px-5 py-3 text-center tabular-nums text-muted-foreground">{p.count}</td>
                  <td className="px-5 py-3 text-right font-mono font-semibold tabular-nums">{formatCOP(p.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Saldo esperado + acciones */}
      <div className="flex items-center justify-between rounded-xl border bg-muted/40 px-5 py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Efectivo esperado en caja</p>
          <p className="mt-0.5 font-display text-3xl font-bold tabular-nums text-foreground">
            {formatCOP(expected)}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => printCashReport(session, movements, paymentBreakdown, expected)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium hover:bg-muted transition-colors"
          >
            <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" aria-hidden>
              <path d="M4 6V2h8v4M4 12H2V7h12v5h-2" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
              <rect x="4" y="10" width="8" height="4" rx="0.5" stroke="currentColor" strokeWidth="1.25"/>
            </svg>
            Imprimir
          </button>
          <AddMovementDialog sessionId={session.id} />
          <CloseSessionDialog sessionId={session.id} expectedAmount={expected} />
        </div>
      </div>

      {/* Movimientos del turno */}
      {movements.length > 0 && (
        <div className="overflow-hidden rounded-xl border bg-card">
          <p className="border-b px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Movimientos del turno
          </p>
          <table className="w-full text-sm">
            <tbody className="divide-y">
              {movements.map((m) => (
                <tr key={m.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-5 py-3 text-xs text-muted-foreground">
                    {formatTime(m.createdAt)}
                  </td>
                  <td className="px-5 py-3 font-medium">{TIPO_LABELS[m.tipo] ?? m.tipo}</td>
                  <td className="px-5 py-3 text-muted-foreground">{m.motivo}</td>
                  <td className={`px-5 py-3 text-right font-mono font-semibold tabular-nums ${m.tipo === 'cash_in' ? 'text-green-600' : 'text-destructive'}`}>
                    {m.tipo === 'cash_in' ? '+' : '-'}{formatCOP(m.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
