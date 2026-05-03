import { Component, computed, inject } from '@angular/core'
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router'
import { SessionService } from '../auth/session.service'
import { ToastHostComponent } from '../../shared/feedback/toast-host.component'

interface NavItem {
  label: string
  short: string
  href: string
}

@Component({
  selector: 'mo-shell',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet, ToastHostComponent],
  template: `
    <div class="bg-background flex h-dvh flex-col overflow-hidden md:flex-row">
      <aside
        class="border-sidebar-border bg-sidebar hidden w-64 flex-shrink-0 flex-col border-r md:flex"
      >
        <div class="border-sidebar-border flex items-center gap-3 border-b px-5 py-[1.125rem]">
          <div
            class="bg-primary flex h-9 w-9 items-center justify-center rounded-lg text-white shadow-sm"
          >
            <span class="text-sm font-black">M</span>
          </div>
          <div>
            <p class="font-display text-[13px] leading-none font-bold tracking-wide text-white">
              MOVEONAPP
            </p>
            <p class="text-sidebar-muted mt-[3px] text-[11px] font-medium">Punto de Venta</p>
          </div>
        </div>

        <nav class="flex-1 space-y-0.5 px-3 py-4">
          <p
            class="text-sidebar-muted mb-2.5 px-2 text-[10px] font-bold tracking-[0.12em] uppercase"
          >
            Modulos
          </p>
          @for (item of navItems; track item.href) {
            <a
              [routerLink]="item.href"
              routerLinkActive="bg-primary text-white shadow-sm"
              class="group text-sidebar-fg hover:bg-sidebar-hover flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 hover:text-white"
            >
              <span class="border-sidebar-muted/30 h-2.5 w-2.5 rounded-full border"></span>
              {{ item.label }}
            </a>
          }
        </nav>

        <div class="border-sidebar-border border-t px-3 py-4">
          <div class="mb-2 flex min-w-0 items-center gap-3 rounded-lg px-2 py-2">
            <div
              class="bg-primary ring-primary/30 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white uppercase ring-2"
            >
              {{ userInitial() }}
            </div>
            <div class="min-w-0">
              <p class="truncate text-[13px] font-semibold text-white">{{ userName() }}</p>
              <p class="text-sidebar-muted text-[11px]">Operador</p>
            </div>
          </div>

          <button
            type="button"
            (click)="signOut()"
            class="text-sidebar-muted hover:bg-sidebar-hover flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 hover:text-white"
          >
            Cerrar sesion
          </button>
        </div>
      </aside>

      <main class="min-w-0 flex-1 overflow-auto">
        <div
          class="mx-auto h-full w-full max-w-7xl px-4 pt-4 pb-24 sm:px-6 sm:pt-6 md:pb-6 lg:py-8"
        >
          <router-outlet />
        </div>
      </main>

      <nav
        class="border-sidebar-border bg-sidebar fixed inset-x-0 bottom-0 z-40 border-t px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:hidden"
      >
        <div class="grid grid-cols-6 gap-1">
          @for (item of navItems; track item.href) {
            <a
              [routerLink]="item.href"
              routerLinkActive="bg-primary text-white"
              class="text-sidebar-muted hover:bg-sidebar-hover flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[10px] font-semibold transition-colors hover:text-white"
            >
              <span class="h-1.5 w-1.5 rounded-full border border-current"></span>
              <span class="max-w-full truncate">{{ item.short }}</span>
            </a>
          }
        </div>
      </nav>
    </div>

    <mo-toast-host />
  `,
})
export class ShellComponent {
  private readonly sessionService = inject(SessionService)
  private readonly router = inject(Router)

  readonly navItems: NavItem[] = [
    { label: 'Punto de Venta', short: 'POS', href: '/pos' },
    { label: 'Productos', short: 'Prod', href: '/productos' },
    { label: 'Inventario', short: 'Inv', href: '/inventario' },
    { label: 'Caja', short: 'Caja', href: '/caja' },
    { label: 'Clientes', short: 'Cli', href: '/clientes' },
    { label: 'Reportes', short: 'Rep', href: '/reportes' },
  ]

  readonly userName = computed(() => this.sessionService.user()?.email?.split('@')[0] ?? 'Usuario')
  readonly userInitial = computed(() => this.userName().slice(0, 1).toUpperCase())

  async signOut(): Promise<void> {
    await this.sessionService.signOut()
    await this.router.navigateByUrl('/login')
  }
}
