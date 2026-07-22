import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideZoneChangeDetection,
} from '@angular/core'
import {
  PreloadAllModules,
  provideRouter,
  withComponentInputBinding,
  withPreloading,
} from '@angular/router'
import { routes } from './app.routes'
import { AppConfigService } from './core/config/app-config.service'
import { initSentry } from './core/observability/sentry'
import { auditProviders } from '@angular-app/features/audit/audit.providers'
import { cashRegisterProviders } from '@angular-app/features/cash-register/cash-register.providers'
import { customersProviders } from '@angular-app/features/customers/customers.providers'
import { expensesProviders } from '@angular-app/features/expenses/expenses.providers'
import { inventoryProviders } from '@angular-app/features/inventory/inventory.providers'
import { loyaltyProviders } from '@angular-app/features/loyalty/loyalty.providers'
import { productsProviders } from '@angular-app/features/products/products.providers'
import { reportsProviders } from '@angular-app/features/reports/reports.providers'
import { salesProviders } from '@angular-app/features/sales/sales.providers'
import { settingsProviders } from '@angular-app/features/settings/settings.providers'

/**
 * Composition roots por feature (ADR 0015 §6.2), registrados en la raíz.
 * No se registran por ruta: casi todos los repositorios se consumen desde
 * múltiples rutas a la vez (ej. InventoryRepository desde /pos, /inventario
 * y /reportes) y `withPreloading(PreloadAllModules)` ya carga todo el código
 * de antemano, así que no hay beneficio de lazy-scoping que proteger — y
 * escoparlos por ruta rompería la resolución cuando una ruta hermana
 * necesita el mismo contrato.
 */
const featureProviders = [
  ...auditProviders,
  ...cashRegisterProviders,
  ...customersProviders,
  ...expensesProviders,
  ...inventoryProviders,
  ...loyaltyProviders,
  ...productsProviders,
  ...reportsProviders,
  ...salesProviders,
  ...settingsProviders,
]

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withPreloading(PreloadAllModules),
    ),
    ...featureProviders,
    provideAppInitializer(async () => {
      const cfg = await inject(AppConfigService).load()
      await initSentry({
        dsn: cfg.sentryDsn,
        environment: cfg.environment,
      })
    }),
  ],
}
