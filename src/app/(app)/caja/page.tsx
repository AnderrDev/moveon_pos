import { redirect } from 'next/navigation'
import { getAuthContext } from '@/shared/lib/auth-context'
import { SupabaseCashRegisterRepository } from '@/modules/cash-register/infrastructure/repositories/supabase-cash-register.repository'
import { PageHeader } from '@/shared/components/layout/PageHeader'
import { OpenSessionForm } from '@/modules/cash-register/components/OpenSessionForm'
import { SessionSummary } from '@/modules/cash-register/components/SessionSummary'
import { Badge } from '@/shared/components/ui/Badge'
import { formatCurrency, formatShortDate, formatTime } from '@/shared/lib/format'

export default async function CajaPage() {
  const auth = await getAuthContext()
  if (!auth) redirect('/login')

  const repo = new SupabaseCashRegisterRepository()

  const [sessionResult, sessionsResult] = await Promise.all([
    repo.getOpenSession(auth.tiendaId),
    repo.listSessions(auth.tiendaId, 5),
  ])

  const openSession    = sessionResult.ok    ? sessionResult.value    : null
  const recentSessions = sessionsResult.ok   ? sessionsResult.value   : []

  let movements: import('@/modules/cash-register/domain/entities/cash-session.entity').CashMovement[] = []
  let paymentBreakdown: import('@/modules/cash-register/domain/repositories/cash-register.repository').CashSessionPaymentBreakdown[] = []
  if (openSession) {
    const [movResult, paymentBreakdownResult] = await Promise.all([
      repo.listMovements(openSession.id),
      repo.getPaymentBreakdown(openSession.id, auth.tiendaId),
    ])
    if (movResult.ok) movements = movResult.value
    if (paymentBreakdownResult.ok) paymentBreakdown = paymentBreakdownResult.value
  }

  return (
    <>
      <PageHeader
        title="Caja"
        description={openSession ? 'Turno en curso' : 'Sin turno activo'}
      >
        <Badge variant={openSession ? 'success' : 'outline'}>
          {openSession ? 'Abierta' : 'Cerrada'}
        </Badge>
      </PageHeader>

      {openSession ? (
        <SessionSummary
          session={openSession}
          movements={movements ?? []}
          paymentBreakdown={paymentBreakdown}
        />
      ) : (
        <div className="space-y-8">
          <OpenSessionForm />

          {recentSessions.filter((s) => s.status === 'closed').length > 0 && (
            <div>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Últimas sesiones
              </h2>
              <div className="overflow-hidden rounded-xl border bg-card">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Apertura</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cierre</th>
                      <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ventas esperadas</th>
                      <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Confirmado</th>
                      <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Dif. ventas</th>
                      <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Dif. efectivo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {recentSessions
                      .filter((s) => s.status === 'closed')
                      .map((s) => {
                        const salesDiff = s.salesDifference ?? 0
                        const cashDiff = s.difference ?? 0
                        return (
                          <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                            <td className="px-5 py-3 text-xs text-muted-foreground">
                              {formatShortDate(s.openedAt)} {formatTime(s.openedAt)}
                            </td>
                            <td className="px-5 py-3 text-xs text-muted-foreground">
                              {s.closedAt
                                ? `${formatShortDate(s.closedAt)} ${formatTime(s.closedAt)}`
                                : '—'}
                            </td>
                            <td className="px-5 py-3 text-right font-mono tabular-nums">
                              {s.expectedSalesAmount !== null
                                ? formatCurrency(s.expectedSalesAmount)
                                : '—'}
                            </td>
                            <td className="px-5 py-3 text-right font-mono tabular-nums">
                              {s.actualSalesAmount !== null
                                ? formatCurrency(s.actualSalesAmount)
                                : '—'}
                            </td>
                            <td className={`px-5 py-3 text-right font-mono font-semibold tabular-nums ${salesDiff > 0 ? 'text-destructive' : salesDiff < 0 ? 'text-green-600' : 'text-muted-foreground'}`}>
                              {salesDiff === 0
                                ? '±$0'
                                : formatCurrency(salesDiff)}
                            </td>
                            <td className={`px-5 py-3 text-right font-mono font-semibold tabular-nums ${cashDiff > 0 ? 'text-destructive' : cashDiff < 0 ? 'text-green-600' : 'text-muted-foreground'}`}>
                              {cashDiff === 0
                                ? '±$0'
                                : formatCurrency(cashDiff)}
                            </td>
                          </tr>
                        )
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  )
}
