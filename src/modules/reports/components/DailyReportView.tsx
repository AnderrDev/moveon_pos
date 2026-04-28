'use client'

import { useState, useTransition } from 'react'
import { getDailyReportAction, type DailyReport } from '../application/actions/daily-report.action'
import { Button } from '@/shared/components/ui/Button'
import { Skeleton } from '@/shared/components/feedback/Skeleton'
import { formatCurrency as formatCOP, formatTime } from '@/shared/lib/format'
import { getPaymentMethodLabel } from '@/shared/lib/payment-methods'

function toDateInput(d: Date) {
  return d.toISOString().slice(0, 10)
}

function paymentLabel(metodo: string) {
  return getPaymentMethodLabel(metodo)
}

function paymentSummary(payments: { metodo: string; amount: number }[]) {
  return payments
    .map((p) => `${paymentLabel(p.metodo)} ${formatCOP(p.amount)}`)
    .join(' · ')
}

function diffTone(value: number | null) {
  if (!value) return 'text-muted-foreground'
  return value > 0 ? 'text-destructive' : 'text-green-600'
}

interface Props { initialReport: DailyReport | null; initialDate: string }

export function DailyReportView({ initialReport, initialDate }: Props) {
  const [date, setDate]       = useState(initialDate)
  const [report, setReport]   = useState(initialReport)
  const [isPending, startTransition] = useTransition()

  function handleDateChange(newDate: string) {
    setDate(newDate)
    startTransition(async () => {
      const r = await getDailyReportAction(newDate)
      setReport(r)
    })
  }

  return (
    <div className="space-y-6">
      {/* Date selector */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => {
            const d = new Date(date); d.setDate(d.getDate() - 1)
            handleDateChange(toDateInput(d))
          }}
          className="rounded-lg border px-3 py-2 text-sm hover:bg-muted transition-colors disabled:opacity-50"
          disabled={isPending}
        >←</button>
        <input
          type="date"
          value={date}
          onChange={(e) => handleDateChange(e.target.value)}
          disabled={isPending}
          className="rounded-lg border border-input bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <button
          onClick={() => {
            const d = new Date(date); d.setDate(d.getDate() + 1)
            if (d <= new Date()) handleDateChange(toDateInput(d))
          }}
          className="rounded-lg border px-3 py-2 text-sm hover:bg-muted transition-colors disabled:opacity-50"
          disabled={isPending || date >= toDateInput(new Date())}
        >→</button>
        {isPending && <span className="text-sm text-muted-foreground">Actualizando reporte…</span>}

        <Button
          variant="outline"
          onClick={() => window.print()}
          className="ml-auto print:hidden"
        >
          <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" aria-hidden>
            <path d="M4 6V2h8v4M4 12H2V7h12v5h-2" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
            <rect x="4" y="10" width="8" height="4" rx="0.5" stroke="currentColor" strokeWidth="1.25"/>
          </svg>
          Imprimir
        </Button>
      </div>

      {isPending ? (
        <ReportContentSkeleton />
      ) : !report ? (
        <div className="rounded-xl border border-dashed bg-card py-16 text-center">
          <p className="text-sm text-muted-foreground">Sin datos para esta fecha</p>
        </div>
      ) : (
        <>
          {(() => {
            const cashTotal = report.paymentBreakdown.find((p) => p.metodo === 'cash')?.total ?? 0
            const digitalBreakdown = report.paymentBreakdown.filter((p) => p.metodo !== 'cash')
            const digitalTotal = digitalBreakdown.reduce((sum, p) => sum + p.total, 0)
            const closedSessions = report.sessions.filter((session) => session.closedAt)
            const pendingCloseTotal = report.sessions
              .filter((session) => !session.closedAt)
              .reduce((sum, session) => sum + session.expectedSalesAmount, 0)

            return (
              <div className="space-y-4">
                <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr_1fr]">
                  <div className="rounded-xl border bg-card p-5 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Total vendido</p>
                    <p className="mt-2 font-display text-3xl font-bold tabular-nums text-foreground">{formatCOP(report.totalVentas)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {report.countVentas} venta{report.countVentas !== 1 ? 's' : ''} completada{report.countVentas !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="rounded-xl border bg-card p-5 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Efectivo ventas</p>
                    <p className="mt-2 font-display text-2xl font-bold tabular-nums text-foreground">{formatCOP(cashTotal)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">No incluye base ni movimientos</p>
                  </div>
                  <div className="rounded-xl border bg-card p-5 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Otros medios</p>
                    <p className="mt-2 font-display text-2xl font-bold tabular-nums text-foreground">{formatCOP(digitalTotal)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Tarjeta, Nequi, Daviplata y transferencias</p>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
                  <div className="rounded-xl border bg-card shadow-sm">
                    <div className="flex items-center justify-between border-b px-5 py-4">
                      <div>
                        <h3 className="font-display text-sm font-bold">Distribución de pagos</h3>
                        <p className="mt-0.5 text-xs text-muted-foreground">Participación de cada medio sobre ventas completadas</p>
                      </div>
                      <p className="font-display text-xl font-bold tabular-nums text-foreground">{formatCOP(report.totalVentas)}</p>
                    </div>
                    <div className="divide-y">
                      {report.paymentBreakdown.length === 0 ? (
                        <p className="px-5 py-5 text-sm text-muted-foreground">Sin pagos registrados</p>
                      ) : report.paymentBreakdown.map((payment) => {
                        const share = report.totalVentas > 0 ? Math.round((payment.total / report.totalVentas) * 100) : 0
                        return (
                          <div key={payment.metodo} className="px-5 py-3">
                            <div className="flex items-center justify-between gap-4">
                              <div>
                                <p className="text-sm font-medium">{paymentLabel(payment.metodo)}</p>
                                <p className="text-xs text-muted-foreground">{payment.count} pago{payment.count !== 1 ? 's' : ''} · {share}%</p>
                              </div>
                              <p className="font-mono text-sm font-semibold tabular-nums">{formatCOP(payment.total)}</p>
                            </div>
                            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                              <div className="h-full rounded-full bg-primary" style={{ width: `${share}%` }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  <div className="rounded-xl border bg-card p-5 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cierres de caja</p>
                    <p className="mt-2 font-display text-2xl font-bold tabular-nums text-foreground">{closedSessions.length}/{report.sessions.length}</p>
                    <p className="mt-1 text-xs text-muted-foreground">turnos cerrados del día</p>
                    {pendingCloseTotal > 0 && (
                      <div className="mt-4 rounded-lg bg-amber-500/10 px-3 py-2">
                        <p className="text-xs font-medium text-amber-700">Pendiente por cerrar: {formatCOP(pendingCloseTotal)}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })()}

          {/* KPIs */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: 'Total ventas',   value: formatCOP(report.totalVentas), sub: `${report.countVentas} transacción${report.countVentas !== 1 ? 'es' : ''}` },
              { label: 'Promedio',        value: formatCOP(report.avgVenta),    sub: 'por venta' },
              { label: 'IVA generado',    value: formatCOP(report.taxTotal),    sub: 'incluido en total' },
              { label: 'Base antes de IVA', value: formatCOP(report.subtotalVentas), sub: report.discountTotal > 0 ? `${formatCOP(report.discountTotal)} en descuentos` : 'sin descuentos' },
            ].map((kpi) => (
              <div key={kpi.label} className="rounded-xl border bg-card p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{kpi.label}</p>
                <p className="mt-2 font-display text-2xl font-bold text-foreground">{kpi.value}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{kpi.sub}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Pagos por método */}
            <div className="rounded-xl border bg-card shadow-sm">
              <div className="border-b px-5 py-4">
                <h3 className="font-display text-sm font-bold">Ventas por método de pago</h3>
              </div>
              {report.paymentBreakdown.length === 0 ? (
                <p className="px-5 py-6 text-sm text-muted-foreground">Sin pagos registrados</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Método</th>
                      <th className="px-5 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">#</th>
                      <th className="px-5 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {report.paymentBreakdown.map((p) => (
                      <tr key={p.metodo} className="hover:bg-muted/20">
                        <td className="px-5 py-3 font-medium">{paymentLabel(p.metodo)}</td>
                        <td className="px-5 py-3 text-center tabular-nums text-muted-foreground">{p.count}</td>
                        <td className="px-5 py-3 text-right font-semibold tabular-nums">{formatCOP(p.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t bg-muted/20">
                    <tr>
                      <td className="px-5 py-3 font-bold">Total</td>
                      <td className="px-5 py-3 text-center font-bold tabular-nums">{report.paymentBreakdown.reduce((s, p) => s + p.count, 0)}</td>
                      <td className="px-5 py-3 text-right font-bold tabular-nums text-primary">{formatCOP(report.paymentBreakdown.reduce((s, p) => s + p.total, 0))}</td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>

            {/* Top productos */}
            <div className="rounded-xl border bg-card shadow-sm">
              <div className="border-b px-5 py-4">
                <h3 className="font-display text-sm font-bold">Productos más vendidos</h3>
              </div>
              {report.topProducts.length === 0 ? (
                <p className="px-5 py-6 text-sm text-muted-foreground">Sin productos vendidos</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Producto</th>
                      <th className="px-5 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">Uds.</th>
                      <th className="px-5 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {report.topProducts.map((p, i) => (
                      <tr key={p.productId} className="hover:bg-muted/20">
                        <td className="px-5 py-3">
                          <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">{i + 1}</span>
                          {p.nombre}
                        </td>
                        <td className="px-5 py-3 text-center tabular-nums text-muted-foreground">{p.qty}</td>
                        <td className="px-5 py-3 text-right font-semibold tabular-nums">{formatCOP(p.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Detalle de ventas */}
          {report.salesDetail.length > 0 && (
            <div className="rounded-xl border bg-card shadow-sm">
              <div className="border-b px-5 py-4">
                <h3 className="font-display text-sm font-bold">Detalle de ventas</h3>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">#</th>
                    <th className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Hora</th>
                    <th className="px-5 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ítems</th>
                    <th className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pago</th>
                    <th className="px-5 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Total</th>
                    <th className="px-5 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {report.salesDetail.map((s) => (
                    <tr key={s.id} className={s.status === 'voided' ? 'opacity-50' : 'hover:bg-muted/20'}>
                      <td className="px-5 py-3 font-mono text-xs font-semibold">{s.saleNumber}</td>
                      <td className="px-5 py-3 tabular-nums text-muted-foreground">
                        {formatTime(s.createdAt, { second: '2-digit' })}
                      </td>
                      <td className="px-5 py-3 text-center tabular-nums text-muted-foreground">{s.itemCount}</td>
                      <td className="px-5 py-3 text-xs text-muted-foreground">
                        {paymentSummary(s.payments)}
                      </td>
                      <td className="px-5 py-3 text-right font-semibold tabular-nums">{formatCOP(s.total)}</td>
                      <td className="px-5 py-3 text-center">
                        {s.status === 'voided'
                          ? <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">Anulada</span>
                          : <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">Completada</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Sesiones de caja */}
          {report.sessions.length > 0 && (
            <div className="rounded-xl border bg-card shadow-sm">
              <div className="border-b px-5 py-4">
                <h3 className="font-display text-sm font-bold">Sesiones de caja</h3>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Apertura</th>
                    <th className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cierre</th>
                    <th className="px-5 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ventas esperadas</th>
                    <th className="px-5 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Confirmado</th>
                    <th className="px-5 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Dif. ventas</th>
                    <th className="px-5 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Dif. efectivo</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {report.sessions.map((s) => (
                    <tr key={s.id}>
                      <td className="px-5 py-3 tabular-nums">{formatTime(s.openedAt)}</td>
                      <td className="px-5 py-3 tabular-nums text-muted-foreground">
                        {s.closedAt ? formatTime(s.closedAt) : <span className="text-green-600 font-medium">Abierta</span>}
                      </td>
                      <td className="px-5 py-3 text-right font-semibold tabular-nums">{formatCOP(s.expectedSalesAmount)}</td>
                      <td className="px-5 py-3 text-right font-semibold tabular-nums">
                        {s.actualSalesAmount !== null ? formatCOP(s.actualSalesAmount) : '—'}
                      </td>
                      <td className={`px-5 py-3 text-right font-semibold tabular-nums ${diffTone(s.salesDifference)}`}>
                        {s.salesDifference !== null ? formatCOP(s.salesDifference) : '—'}
                      </td>
                      <td className={`px-5 py-3 text-right font-semibold tabular-nums ${diffTone(s.cashDifference)}`}>
                        {s.cashDifference !== null ? formatCOP(s.cashDifference) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function ReportContentSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="rounded-xl border bg-card p-5 shadow-sm">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-3 h-7 w-28" />
            <Skeleton className="mt-2 h-3 w-20" />
          </div>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <div key={index} className="rounded-xl border bg-card p-5 shadow-sm">
            <Skeleton className="h-4 w-44" />
            <div className="mt-5 space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-11/12" />
              <Skeleton className="h-4 w-10/12" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
