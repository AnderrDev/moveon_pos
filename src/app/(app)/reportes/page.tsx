import { redirect } from 'next/navigation'
import { getAuthContext } from '@/shared/lib/auth-context'
import { getDailyReportAction } from '@/modules/reports/application/actions/daily-report.action'
import { getStockReportAction } from '@/modules/reports/application/actions/stock-report.action'
import { DailyReportView } from '@/modules/reports/components/DailyReportView'
import { StockReportSection } from '@/modules/reports/components/StockReportSection'
import { PageHeader } from '@/shared/components/layout/PageHeader'

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>
}) {
  const auth = await getAuthContext()
  if (!auth) redirect('/login')

  const { date: dateParam } = await searchParams
  const today   = new Date().toISOString().slice(0, 10)
  const dateStr = dateParam ?? today

  const [report, stockRows] = await Promise.all([
    getDailyReportAction(dateStr),
    getStockReportAction(),
  ])

  const lowCount = stockRows.filter((r) => r.isLow).length

  return (
    <>
      <PageHeader
        title="Reportes"
        description={
          lowCount > 0
            ? `${lowCount} producto${lowCount !== 1 ? 's' : ''} con stock bajo`
            : 'Analiza el rendimiento diario de tu tienda'
        }
      />
      <div className="space-y-10">
        <section>
          <h2 className="mb-4 font-display text-base font-bold text-foreground">Ventas del día</h2>
          <DailyReportView initialReport={report} initialDate={dateStr} />
        </section>
        <section>
          <h2 className="mb-4 font-display text-base font-bold text-foreground">Inventario</h2>
          <StockReportSection rows={stockRows} />
        </section>
      </div>
    </>
  )
}
