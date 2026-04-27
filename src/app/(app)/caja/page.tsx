import { redirect } from 'next/navigation'
import { getAuthContext } from '@/shared/lib/auth-context'
import { SupabaseCashRegisterRepository } from '@/modules/cash-register/infrastructure/repositories/supabase-cash-register.repository'
import { PageHeader } from '@/shared/components/layout/PageHeader'
import { OpenSessionForm } from '@/modules/cash-register/components/OpenSessionForm'
import { SessionSummary } from '@/modules/cash-register/components/SessionSummary'
import { Badge } from '@/shared/components/ui/Badge'

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
  if (openSession) {
    const movResult = await repo.listMovements(openSession.id)
    if (movResult.ok) movements = movResult.value
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
        <SessionSummary session={openSession} movements={movements ?? []} />
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
                      <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Efectivo esperado</th>
                      <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contado</th>
                      <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Diferencia</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {recentSessions
                      .filter((s) => s.status === 'closed')
                      .map((s) => {
                        const diff = s.difference ?? 0
                        return (
                          <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                            <td className="px-5 py-3 text-xs text-muted-foreground">
                              {s.openedAt.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}{' '}
                              {s.openedAt.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="px-5 py-3 text-xs text-muted-foreground">
                              {s.closedAt
                                ? `${s.closedAt.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })} ${s.closedAt.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}`
                                : '—'}
                            </td>
                            <td className="px-5 py-3 text-right font-mono tabular-nums">
                              {s.expectedCashAmount !== null
                                ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(s.expectedCashAmount)
                                : '—'}
                            </td>
                            <td className="px-5 py-3 text-right font-mono tabular-nums">
                              {s.actualCashAmount !== null
                                ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(s.actualCashAmount)
                                : '—'}
                            </td>
                            <td className={`px-5 py-3 text-right font-mono font-semibold tabular-nums ${diff < 0 ? 'text-destructive' : diff > 0 ? 'text-green-600' : 'text-muted-foreground'}`}>
                              {diff === 0
                                ? '±$0'
                                : new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(diff)}
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
