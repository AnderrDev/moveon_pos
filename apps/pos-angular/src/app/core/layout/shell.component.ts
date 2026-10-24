import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core'
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { filter } from 'rxjs'
import {
  ChartColumn,
  Ellipsis,
  History,
  LogOut,
  LucideAngularModule,
  type LucideIconData,
  Package,
  PiggyBank,
  ScanBarcode,
  Settings,
  ShieldCheck,
  Users,
  Wallet,
  X,
} from 'lucide-angular'
import { SessionService } from '../auth/session.service'
import { ToastHostComponent } from '../../shared/organisms/toast/toast-host.component'

interface NavItem {
  label: string
  short: string
  href: string
  icon: LucideIconData
  adminOnly?: boolean
  /** Visible directo en la barra inferior móvil (el resto va en "Más"). */
  primary?: boolean
}

interface NavGroup {
  label: string
  items: readonly NavItem[]
}

const NAV_GROUPS: readonly NavGroup[] = [
  {
    label: 'Vender',
    items: [
      { label: 'Punto de Venta', short: 'Vender', href: '/pos', icon: ScanBarcode, primary: true },
      { label: 'Caja', short: 'Caja', href: '/caja', icon: Wallet, primary: true },
      { label: 'Clientes', short: 'Clientes', href: '/clientes', icon: Users, primary: true },
    ],
  },
  {
    label: 'Mercancía',
    items: [
      { label: 'Productos', short: 'Productos', href: '/productos', icon: Package, adminOnly: true },
    ],
  },
  {
    label: 'Negocio',
    items: [
      { label: 'Reportes', short: 'Reportes', href: '/reportes', icon: ChartColumn, adminOnly: true, primary: true },
      { label: 'Finanzas', short: 'Finanzas', href: '/finanzas', icon: PiggyBank, adminOnly: true },
      { label: 'Historial de caja', short: 'Historial', href: '/caja/historial', icon: History, adminOnly: true },
    ],
  },
  {
    label: 'Sistema',
    items: [
      { label: 'Auditoría', short: 'Auditoría', href: '/auditoria', icon: ShieldCheck, adminOnly: true },
      { label: 'Configuración', short: 'Ajustes', href: '/configuracion', icon: Settings, adminOnly: true },
    ],
  },
]

@Component({
  selector: 'mo-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, RouterOutlet, ToastHostComponent, LucideAngularModule],
  host: { class: 'fixed inset-0 block overflow-hidden' },
  template: `
    <div class="bg-background flex h-dvh flex-col overflow-hidden md:flex-row">
      <aside class="bg-sidebar hidden w-60 flex-shrink-0 flex-col md:flex">
        <a routerLink="/pos" class="block px-5 pt-6 pb-5" aria-label="MOVE ON — ir al punto de venta">
          <img src="assets/brand/moveon-logo.png" alt="MOVE ON Nutrition" class="h-auto w-36" />
        </a>

        <nav class="flex-1 space-y-5 overflow-y-auto px-3 pb-4" aria-label="Principal">
          @for (group of navGroups(); track group.label) {
            <div>
              <p class="text-sidebar-muted mb-1.5 px-3 text-[11px] font-semibold">{{ group.label }}</p>
              <div class="space-y-0.5">
                @for (item of group.items; track item.href) {
                  <a
                    [routerLink]="item.href"
                    routerLinkActive="bg-primary! text-primary-foreground!"
                    [routerLinkActiveOptions]="{ exact: item.href === '/caja' }"
                    class="text-sidebar-fg hover:bg-sidebar-hover focus-visible:ring-primary flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition-colors hover:text-white focus-visible:ring-2 focus-visible:outline-none"
                  >
                    <lucide-angular [img]="item.icon" class="h-[18px] w-[18px] shrink-0" [strokeWidth]="2" aria-hidden="true" />
                    {{ item.label }}
                  </a>
                }
              </div>
            </div>
          }
        </nav>

        <div class="border-sidebar-border flex items-center gap-3 border-t px-4 py-4">
          <div
            class="bg-primary text-primary-foreground font-display flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-extrabold uppercase"
            aria-hidden="true"
          >
            {{ userInitial() }}
          </div>
          <div class="min-w-0 flex-1">
            <p class="truncate text-[13px] font-semibold text-white">{{ userName() }}</p>
            <p class="text-sidebar-muted text-[11px]">{{ roleLabel() }}</p>
          </div>
          <button
            type="button"
            (click)="signOut()"
            class="text-sidebar-muted hover:bg-sidebar-hover focus-visible:ring-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors hover:text-white focus-visible:ring-2 focus-visible:outline-none"
            aria-label="Cerrar sesión"
            title="Cerrar sesión"
          >
            <lucide-angular [img]="icons.logOut" class="h-[18px] w-[18px]" aria-hidden="true" />
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

      <!-- Barra inferior móvil: accesos principales + "Más" con el resto. -->
      <nav
        class="bg-sidebar fixed inset-x-0 bottom-0 z-40 px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:hidden"
        aria-label="Principal"
      >
        <div class="flex gap-1">
          @for (item of mobilePrimary(); track item.href) {
            <a
              [routerLink]="item.href"
              routerLinkActive="bg-primary! text-primary-foreground!"
              [routerLinkActiveOptions]="{ exact: item.href === '/caja' }"
              class="text-sidebar-fg flex min-h-14 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-semibold transition-colors"
            >
              <lucide-angular [img]="item.icon" class="h-5 w-5" aria-hidden="true" />
              <span class="max-w-full truncate">{{ item.short }}</span>
            </a>
          }
          @if (mobileMore().length > 0) {
            <button
              type="button"
              (click)="moreOpen.set(true)"
              [class]="moreButtonClass()"
              [attr.aria-expanded]="moreOpen()"
            >
              <lucide-angular [img]="icons.more" class="h-5 w-5" aria-hidden="true" />
              <span>Más</span>
            </button>
          }
        </div>
      </nav>

      @if (moreOpen()) {
        <div class="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Más secciones">
          <button
            type="button"
            class="absolute inset-0 bg-black/50"
            aria-label="Cerrar menú"
            (click)="moreOpen.set(false)"
          ></button>
          <div
            class="bg-sidebar absolute inset-x-0 bottom-0 rounded-t-2xl px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
          >
            <div class="mb-3 flex items-center justify-between">
              <img src="assets/brand/moveon-logo.png" alt="MOVE ON Nutrition" class="h-auto w-28" />
              <button
                type="button"
                (click)="moreOpen.set(false)"
                class="text-sidebar-fg flex h-10 w-10 items-center justify-center rounded-lg"
                aria-label="Cerrar menú"
              >
                <lucide-angular [img]="icons.close" class="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <div class="grid grid-cols-3 gap-2">
              @for (item of mobileMore(); track item.href) {
                <a
                  [routerLink]="item.href"
                  routerLinkActive="bg-primary! text-primary-foreground!"
                  class="bg-sidebar-hover text-sidebar-fg flex min-h-20 flex-col items-center justify-center gap-2 rounded-xl px-2 text-center text-xs font-semibold"
                >
                  <lucide-angular [img]="item.icon" class="h-5 w-5" aria-hidden="true" />
                  {{ item.label }}
                </a>
              }
              <button
                type="button"
                (click)="signOut()"
                class="bg-sidebar-hover text-sidebar-muted flex min-h-20 flex-col items-center justify-center gap-2 rounded-xl px-2 text-xs font-semibold"
              >
                <lucide-angular [img]="icons.logOut" class="h-5 w-5" aria-hidden="true" />
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      }
    </div>

    <mo-toast-host />
  `,
})
export class ShellComponent {
  private readonly sessionService = inject(SessionService)
  private readonly router = inject(Router)

  readonly icons = { logOut: LogOut, more: Ellipsis, close: X }
  readonly moreOpen = signal(false)
  private readonly currentUrl = signal(this.router.url)

  /** Grupos visibles según el rol; los admin-only se ocultan al cajero. */
  readonly navGroups = computed(() => {
    const isAdmin = this.sessionService.isAdmin()
    return NAV_GROUPS.map((group) => ({
      label: group.label,
      items: group.items.filter((item) => !item.adminOnly || isAdmin),
    })).filter((group) => group.items.length > 0)
  })

  private readonly visibleItems = computed(() => this.navGroups().flatMap((group) => group.items))
  readonly mobilePrimary = computed(() => this.visibleItems().filter((item) => item.primary))
  readonly mobileMore = computed(() => this.visibleItems().filter((item) => !item.primary))

  /** "Más" se marca activo cuando la ruta actual vive dentro del menú. */
  readonly moreButtonClass = computed(() => {
    const url = this.currentUrl()
    const active = this.mobileMore().some((item) => url === item.href || url.startsWith(item.href + '/'))
    return [
      'flex min-h-14 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-semibold transition-colors',
      active ? 'bg-primary text-primary-foreground' : 'text-sidebar-fg',
    ].join(' ')
  })

  readonly userName = computed(() => this.sessionService.user()?.email?.split('@')[0] ?? 'Usuario')
  readonly userInitial = computed(() => this.userName().slice(0, 1).toUpperCase())
  readonly roleLabel = computed(() => (this.sessionService.isAdmin() ? 'Administrador' : 'Cajero'))

  constructor() {
    // Asegura que el rol esté cargado para la visibilidad reactiva del nav (OnPush).
    void this.sessionService.getRole()

    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe((event) => {
        this.currentUrl.set(event.urlAfterRedirects)
        this.moreOpen.set(false)
      })
  }

  async signOut(): Promise<void> {
    this.moreOpen.set(false)
    await this.sessionService.signOut()
    await this.router.navigateByUrl('/login')
  }
}
