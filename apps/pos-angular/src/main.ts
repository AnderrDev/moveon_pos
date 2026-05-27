import { bootstrapApplication } from '@angular/platform-browser'
import { AppComponent } from './app/app.component'
import { appConfig } from './app/app.config'
import { reportError } from './app/core/observability/sentry'

bootstrapApplication(AppComponent, appConfig).catch((error: unknown) => {
  console.error(error)
  void reportError(error)
})
