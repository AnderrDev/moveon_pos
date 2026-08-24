import { bootstrapApplication } from '@angular/platform-browser'
import { appConfig } from './app/app.config'
import { LinksPage } from './app/links.page'

bootstrapApplication(LinksPage, appConfig).catch((error: unknown) => console.error(error))
