import { redirect } from 'next/navigation'
import { getAuthContext } from '@/shared/lib/auth-context'
import { getDailyReportAction } from '@/modules/reports/application/actions/daily-report.action'
import { DailyReportView } from '@/modules/reports/components/DailyReportView'
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

  const report = await getDailyReportAction(dateStr)

  return (
    <>
      <PageHeader
        title="Reportes"
        description="Analiza el rendimiento diario de tu tienda"
      />
      <DailyReportView initialReport={report} initialDate={dateStr} />
    </>
  )
}
