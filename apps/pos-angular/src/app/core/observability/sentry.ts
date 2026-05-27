/**
 * Wrapper defensivo para @sentry/angular.
 *
 * - `initSentry(dsn)` se llama desde un `provideAppInitializer` después de
 *   cargar el `runtime-config.json`. Sin DSN no inicializa nada (el chunk de
 *   Sentry no se descarga).
 * - `reportError(error)` puede llamarse desde main.ts y catch handlers; si
 *   Sentry no está inicializado es noop.
 *
 * El import es dinámico para mantener Sentry fuera del chunk principal.
 */

let initialized = false

export interface SentryInitOptions {
  dsn: string | undefined
  environment: string
  release?: string
  tracesSampleRate?: number
}

export async function initSentry(options: SentryInitOptions): Promise<void> {
  if (!options.dsn || initialized) return
  try {
    const Sentry = await import('@sentry/angular')
    Sentry.init({
      dsn: options.dsn,
      environment: options.environment,
      release: options.release,
      tracesSampleRate: options.tracesSampleRate ?? 0.1,
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 0,
    })
    initialized = true
  } catch (error) {
    console.warn('[sentry] no se pudo inicializar', error)
  }
}

export async function reportError(error: unknown): Promise<void> {
  if (!initialized) return
  try {
    const Sentry = await import('@sentry/angular')
    Sentry.captureException(error)
  } catch {
    /* noop */
  }
}
