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

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withPreloading(PreloadAllModules),
    ),
    provideAppInitializer(async () => {
      const cfg = await inject(AppConfigService).load()
      await initSentry({
        dsn: cfg.sentryDsn,
        environment: cfg.environment,
      })
    }),
  ],
}
