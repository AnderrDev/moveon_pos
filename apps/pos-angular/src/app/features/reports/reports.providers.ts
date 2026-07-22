import type { Provider } from '@angular/core'
import { ReportRepository } from '@angular-app/features/reports/domain/repositories/report.repository'
import { ReportsRepository } from '@angular-app/features/reports/data/repositories/reports.repository'
import { LoyaltyReportRepository } from '@angular-app/features/reports/domain/repositories/loyalty-report.repository'
import { LoyaltyReportsRepository } from '@angular-app/features/reports/data/repositories/loyalty-report.repository'

/** Composition root de la feature (ADR 0015 §6.2). */
export const reportsProviders: Provider[] = [
  { provide: ReportRepository, useClass: ReportsRepository },
  { provide: LoyaltyReportRepository, useClass: LoyaltyReportsRepository },
]
