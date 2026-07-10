import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core'
import { AppConfigService } from './core/config/app-config.service'
import { initSentry } from './core/observability/sentry'

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideAppInitializer(async () => {
      const cfg = await inject(AppConfigService).load()
      await initSentry({
        dsn: cfg.sentryDsn,
        environment: cfg.environment,
      })
    }),
  ],
}
