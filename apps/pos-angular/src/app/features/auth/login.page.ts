import { Component, inject, signal } from '@angular/core'
import { ReactiveFormsModule } from '@angular/forms'
import { Router } from '@angular/router'
import { SessionService } from '../../core/auth/session.service'
import { LoginFormPresenter } from './login-form.presenter'
import { loginFormMapper } from '@/modules/auth/forms/login-form.mapper'

@Component({
  selector: 'mo-login-page',
  standalone: true,
  imports: [ReactiveFormsModule],
  providers: [LoginFormPresenter],
  template: `
    <main class="bg-background flex min-h-dvh items-center justify-center px-4 py-10">
      <section class="bg-card w-full max-w-md rounded-2xl border p-6 shadow-xl">
        <div class="mb-6">
          <div
            class="bg-primary mb-4 flex h-11 w-11 items-center justify-center rounded-xl text-sm font-black text-white"
          >
            M
          </div>
          <h1 class="font-display text-2xl font-bold">MOVEONAPP POS</h1>
          <p class="text-muted-foreground mt-1 text-sm">Ingresa para operar la tienda.</p>
        </div>

        <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-4">
          <label class="block">
            <span class="text-sm font-semibold">Email</span>
            <input
              type="email"
              formControlName="email"
              autocomplete="email"
              class="border-input bg-background focus:ring-ring mt-1 h-11 w-full rounded-lg border px-3 text-sm outline-none focus:ring-2"
            />
            @if (presenter.errors().email) {
              <span class="text-destructive mt-1 block text-xs">{{
                presenter.errors().email
              }}</span>
            }
          </label>

          <label class="block">
            <span class="text-sm font-semibold">Contrasena</span>
            <input
              type="password"
              formControlName="password"
              autocomplete="current-password"
              class="border-input bg-background focus:ring-ring mt-1 h-11 w-full rounded-lg border px-3 text-sm outline-none focus:ring-2"
            />
            @if (presenter.errors().password) {
              <span class="text-destructive mt-1 block text-xs">{{
                presenter.errors().password
              }}</span>
            }
          </label>

          @if (presenter.errors().root) {
            <p class="bg-destructive/10 text-destructive rounded-lg px-3 py-2 text-sm">
              {{ presenter.errors().root }}
            </p>
          }

          <button
            type="submit"
            [disabled]="isSubmitting()"
            class="bg-primary text-primary-foreground h-11 w-full rounded-lg text-sm font-bold transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {{ isSubmitting() ? 'Ingresando...' : 'Ingresar' }}
          </button>
        </form>
      </section>
    </main>
  `,
})
export class LoginPage {
  private readonly sessionService = inject(SessionService)
  private readonly router = inject(Router)
  readonly presenter = inject(LoginFormPresenter)

  readonly isSubmitting = signal(false)
  readonly form = this.presenter.form

  constructor() {
    this.form.patchValue({
      email: 'admin@moveonpos.co',
      password: 'Admin1234!',
    })
  }

  async submit(): Promise<void> {
    const value = this.presenter.validate()
    if (!value) return

    this.isSubmitting.set(true)
    const payload = loginFormMapper.toSignInPayload(value)
    const { error } = await this.sessionService.signIn(payload.email, payload.password)
    this.isSubmitting.set(false)

    if (error) {
      this.presenter.setRootError(error.message)
      return
    }

    await this.router.navigateByUrl('/pos')
  }
}
