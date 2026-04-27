import type { CashSession, CashMovement } from '../domain/entities/cash-session.entity'
import { AddMovementDialog } from './AddMovementDialog'
import { CloseSessionDialog } from './CloseSessionDialog'

function formatCOP(value: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value)
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
}

export function SessionSummary({ session, movements }: Props) {
  const ingresos  = movements.filter((m) => m.tipo === 'cash_in').reduce((s, m) => s + m.amount, 0)
  const egresos   = movements.filter((m) => m.tipo !== 'cash_in').reduce((s, m) => s + m.amount, 0)
  const expected  = session.openingAmount + ingresos - egresos

  return (
    <div className="space-y-6">
      {/* Resumen de saldos */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: 'Apertura',  value: session.openingAmount, neutral: true },
          { label: 'Ingresos',  value: ingresos,  positive: true },
          { label: 'Egresos',   value: egresos,   negative: true },
        ].map(({ label, value, positive, negative }) => (
          <div key={label} className="rounded-xl border bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className={`mt-1 font-display text-2xl font-bold tabular-nums ${positive ? 'text-green-600' : negative ? 'text-destructive' : 'text-foreground'}`}>
              {formatCOP(value)}
            </p>
          </div>
        ))}
      </div>

      {/* Saldo esperado + acciones */}
      <div className="flex items-center justify-between rounded-xl border bg-muted/40 px-5 py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Efectivo esperado en caja</p>
          <p className="mt-0.5 font-display text-3xl font-bold tabular-nums text-foreground">
            {formatCOP(expected)}
          </p>
        </div>
        <div className="flex gap-2">
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
                    {m.createdAt.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
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
