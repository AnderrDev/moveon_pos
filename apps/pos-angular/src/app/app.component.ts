import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  Router,
  RouterOutlet,
} from '@angular/router'

/**
 * Raíz. Mientras la primera navegación resuelve guards (sesión y rol) y carga
 * la página diferida no hay nada que pintar, así que se muestra la pantalla de
 * arranque (la misma de index.html, para que no haya salto). Las navegaciones
 * siguientes las indica la barra de progreso del shell.
 */
@Component({
  selector: 'mo-root',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet],
  template: `
    @if (booting()) {
      <div
        class="bg-foreground fixed inset-0 z-[70] flex flex-col items-center justify-center gap-6"
        role="status"
        aria-live="polite"
      >
        <img src="assets/brand/moveon-logo.png" alt="MOVE ON Nutrition" class="h-auto w-48" />
        <div class="h-[3px] w-40 overflow-hidden rounded-full bg-white/15" aria-hidden="true">
          <div class="bg-primary mo-route-progress h-full rounded-full"></div>
        </div>
        <span class="sr-only">Cargando el punto de venta…</span>
      </div>
    }
    <router-outlet />
  `,
})
export class AppComponent {
  readonly booting = signal(true)

  constructor() {
    inject(Router)
      .events.pipe(takeUntilDestroyed())
      .subscribe((event) => {
        if (
          event instanceof NavigationEnd ||
          event instanceof NavigationCancel ||
          event instanceof NavigationError
        ) {
          this.booting.set(false)
        }
      })
  }
}
