import { bootstrapApplication } from '@angular/platform-browser'
import { CatalogoPage } from './app/features/catalog/catalogo.page'
import { appConfig } from './app/app.config'
import { reportError } from './app/core/observability/sentry'

bootstrapApplication(CatalogoPage, appConfig).catch((error: unknown) => {
  console.error(error)
  void reportError(error)
})
