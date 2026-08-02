import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core'
import { ReactiveFormsModule } from '@angular/forms'
import { Router, RouterLink } from '@angular/router'
import { SessionService } from '@angular-app/core/auth/session.service'
import { ToastService } from '@angular-app/shared/organisms/toast/toast.service'
import { FormInputComponent } from '@angular-app/shared/molecules/form-input.component'
import { FormErrorComponent } from '@angular-app/shared/molecules/form-error.component'
import { ResetPasswordFormPresenter } from '@angular-app/features/auth/presentation/presenters/reset-password-form.presenter'
import { mapResetPasswordError } from '@angular-app/features/auth/presentation/services/reset-password-error-mapper'
import { resetPasswordFormMapper } from '@angular-app/features/auth/presentation/forms/reset-password-form.mapper'

@Component({
  selector: 'mo-reset-password-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, FormInputComponent, FormErrorComponent],
  providers: [ResetPasswordFormPresenter],
  template: `
    <main class="bg-background flex min-h-dvh items-center justify-center px-4 py-10">
      <section class="bg-card w-full max-w-md rounded-2xl border p-6 shadow-xl">
        <div class="mb-6">
          <div
            class="bg-primary mb-4 flex h-11 w-11 items-center justify-center rounded-xl text-sm font-black text-white"
          >
            M
          </div>
          <h1 class="font-display text-2xl font-bold">Nueva contraseña</h1>
          <p class="text-muted-foreground mt-1 text-sm">
            Define la contraseña con la que ingresarás a partir de ahora.
          </p>
        </div>

        <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-4">
          <mo-form-input
            controlName="password"
            label="Nueva contraseña"
            type="password"
            autocomplete="new-password"
            [required]="true"
            [error]="presenter.errors().password ?? null"
          />

          <mo-form-input
            controlName="confirmPassword"
            label="Confirmar contraseña"
            type="password"
            autocomplete="new-password"
            [required]="true"
            [error]="presenter.errors().confirmPassword ?? null"
          />

          <mo-form-error [message]="presenter.errors().root ?? null" />

          <button
            type="submit"
            [disabled]="isSubmitting()"
            class="bg-primary text-primary-foreground h-11 w-full rounded-lg text-sm font-bold transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {{ isSubmitting() ? 'Guardando...' : 'Guardar contraseña' }}
          </button>
        </form>

        <a
          routerLink="/login"
          class="text-primary mt-6 inline-block text-sm font-semibold hover:underline"
        >
          Volver a iniciar sesión
        </a>
      </section>
    </main>
  `,
})
export class ResetPasswordPage {
  private readonly sessionService = inject(SessionService)
  private readonly toast = inject(ToastService)
  private readonly router = inject(Router)
  readonly presenter = inject(ResetPasswordFormPresenter)

  readonly isSubmitting = signal(false)
  readonly form = this.presenter.form

  async submit(): Promise<void> {
    const value = this.presenter.validate()
    if (!value) return

    this.isSubmitting.set(true)
    const { password } = resetPasswordFormMapper.toUpdatePayload(value)
    const { error } = await this.sessionService.updatePassword(password)
    this.isSubmitting.set(false)

    if (error) {
      this.presenter.setRootError(mapResetPasswordError(error))
      return
    }

    // La sesión de recuperación deja al usuario logueado: navegamos al shell,
    // donde sí existe el host de toasts, y mostramos la confirmación.
    this.toast.success('Tu contraseña se actualizó correctamente')
    await this.router.navigateByUrl('/pos')
  }
}
