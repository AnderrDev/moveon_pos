import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core'
import { ReactiveFormsModule } from '@angular/forms'
import { RouterLink } from '@angular/router'
import { SessionService } from '../../core/auth/session.service'
import { FormInputComponent } from '../../shared/forms/form-input.component'
import { FormErrorComponent } from '../../shared/forms/form-error.component'
import { ForgotPasswordFormPresenter } from './forgot-password-form.presenter'
import { forgotPasswordFormMapper } from '@/modules/auth/forms/forgot-password-form.mapper'

// Mensaje genérico: NO revela si el correo existe o no (regla de seguridad).
const GENERIC_SUCCESS_MESSAGE =
  'Si el correo existe, te enviamos un enlace para restablecer tu contraseña. Revisa tu bandeja de entrada y la carpeta de spam.'
const RATE_LIMIT_MESSAGE =
  'Demasiados intentos. Espera unos minutos e inténtalo de nuevo'
const CONNECTION_MESSAGE = 'No se pudo conectar. Revisa tu conexión a internet'

@Component({
  selector: 'mo-forgot-password-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, FormInputComponent, FormErrorComponent],
  providers: [ForgotPasswordFormPresenter],
  template: `
    <main class="bg-background flex min-h-dvh items-center justify-center px-4 py-10">
      <section class="bg-card w-full max-w-md rounded-2xl border p-6 shadow-xl">
        <div class="mb-6">
          <div
            class="bg-primary mb-4 flex h-11 w-11 items-center justify-center rounded-xl text-sm font-black text-white"
          >
            M
          </div>
          <h1 class="font-display text-2xl font-bold">¿Olvidaste tu contraseña?</h1>
          <p class="text-muted-foreground mt-1 text-sm">
            Ingresa tu correo y te enviaremos un enlace para restablecerla.
          </p>
        </div>

        @if (sent()) {
          <div
            role="status"
            class="border-primary/30 bg-primary/10 text-foreground rounded-lg border px-4 py-3 text-sm"
          >
            {{ successMessage }}
          </div>
          <a
            routerLink="/login"
            class="text-primary mt-6 inline-block text-sm font-semibold hover:underline"
          >
            Volver a iniciar sesión
          </a>
        } @else {
          <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-4">
            <mo-form-input
              controlName="email"
              label="Email"
              type="email"
              autocomplete="email"
              [required]="true"
              [error]="presenter.errors().email ?? null"
            />

            <mo-form-error [message]="presenter.errors().root ?? null" />

            <button
              type="submit"
              [disabled]="isSubmitting()"
              class="bg-primary text-primary-foreground h-11 w-full rounded-lg text-sm font-bold transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {{ isSubmitting() ? 'Enviando...' : 'Enviar enlace' }}
            </button>
          </form>

          <a
            routerLink="/login"
            class="text-primary mt-6 inline-block text-sm font-semibold hover:underline"
          >
            Volver a iniciar sesión
          </a>
        }
      </section>
    </main>
  `,
})
export class ForgotPasswordPage {
  private readonly sessionService = inject(SessionService)
  readonly presenter = inject(ForgotPasswordFormPresenter)

  readonly isSubmitting = signal(false)
  readonly sent = signal(false)
  readonly form = this.presenter.form

  readonly successMessage = GENERIC_SUCCESS_MESSAGE

  async submit(): Promise<void> {
    const value = this.presenter.validate()
    if (!value) return

    this.isSubmitting.set(true)
    const { email } = forgotPasswordFormMapper.toResetRequest(value)
    const redirectTo = `${window.location.origin}/restablecer-contrasena`
    const { error } = await this.sessionService.requestPasswordReset(email, redirectTo)
    this.isSubmitting.set(false)

    // Solo se informan rate-limit (429) y fallos de red (status undefined); el
    // resto (incluido "email no encontrado") cae al mensaje de éxito genérico
    // para no revelar la existencia del correo.
    if (error && error.status === 429) {
      this.presenter.setRootError(RATE_LIMIT_MESSAGE)
      return
    }
    if (error && error.status === undefined) {
      this.presenter.setRootError(CONNECTION_MESSAGE)
      return
    }

    this.sent.set(true)
  }
}
