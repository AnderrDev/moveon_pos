import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core'
import { getErrorMessage } from '@/shared/lib/error-message'
import { PageHeaderComponent } from '@angular-app/shared/molecules/page-header.component'
import { ButtonComponent } from '@angular-app/shared/atoms/button.component'
import { BadgeComponent } from '@angular-app/shared/atoms/badge.component'
import { EmptyStateComponent } from '@angular-app/shared/molecules/empty-state.component'
import { TableShellComponent } from '@angular-app/shared/molecules/table/table-shell.component'
import { MO_TABLE } from '@angular-app/shared/molecules/table/table.directives'
import { SessionService } from '@angular-app/core/auth/session.service'
import { AuditLogRepository } from '@angular-app/features/audit/domain/repositories/audit-log.repository'
import type { AuditLog } from '@angular-app/features/audit/domain/entities/audit-log.entity'
import { AUDIT_MODULES, type AuditModule } from '@angular-app/features/audit/domain/services/audit-modules'
import { PageSkeletonComponent } from '@angular-app/shared/molecules/page-skeleton.component'
import { TiendaInfoService } from '@angular-app/core/tienda/tienda-info.service'
import {
  auditRangeStart,
  type AuditDateRange,
} from '@angular-app/features/audit/presentation/services/audit-date-range'
import {
  auditActionInfo,
  auditModuleLabel,
  formatAuditDetails,
  summarizeAuditDetails,
  type AuditBadgeVariant,
  type AuditDetailItem,
} from '@angular-app/features/audit/presentation/services/audit-log-format'

/** Registro listo para pintar: textos calculados una vez por carga. */
interface AuditRow {
  log: AuditLog
  actionLabel: string
  variant: AuditBadgeVariant
  moduleLabel: string
  subject: string
  details: AuditDetailItem[]
  summary: string
  searchText: string
}

const LOAD_LIMIT = 500

@Component({
  selector: 'mo-auditoria-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PageSkeletonComponent,
    PageHeaderComponent,
    ButtonComponent,
    BadgeComponent,
    EmptyStateComponent,
    TableShellComponent,
    MO_TABLE,
  ],
  template: `
    <section class="flex h-full min-h-0 flex-col gap-4">
      <mo-page-header title="Auditoría" subtitle="Quién hizo qué, cuándo y con qué detalle">
        <mo-button variant="outline" [loading]="loading()" loadingText="Actualizando..." (click)="load()">
          Actualizar
        </mo-button>
      </mo-page-header>

      <div class="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <input
          type="search"
          [value]="query()"
          (input)="query.set(inputValue($event))"
          placeholder="Buscar por producto, venta, motivo, usuario..."
          aria-label="Buscar en la auditoría"
          class="border-input bg-card focus:ring-ring h-10 min-w-56 flex-1 rounded-lg border px-3 text-sm focus:ring-2 focus:outline-none"
        />
        <select
          [value]="filterModule()"
          (change)="onModuleChange($event)"
          aria-label="Filtrar por módulo"
          class="border-input bg-card focus:ring-ring h-10 rounded-lg border px-3 text-sm focus:ring-2 focus:outline-none"
        >
          <option value="">Todos los módulos</option>
          @for (module of modules; track module.key) {
            <option [value]="module.key">{{ module.label }}</option>
          }
        </select>
        <select
          [value]="filterUser()"
          (change)="filterUser.set(inputValue($event))"
          aria-label="Filtrar por usuario"
          class="border-input bg-card focus:ring-ring h-10 rounded-lg border px-3 text-sm focus:ring-2 focus:outline-none"
        >
          <option value="">Todos los usuarios</option>
          @for (user of users(); track user) {
            <option [value]="user">{{ user }}</option>
          }
        </select>
        <select
          [value]="dateRange()"
          (change)="onDateRangeChange($event)"
          aria-label="Periodo"
          class="border-input bg-card focus:ring-ring h-10 rounded-lg border px-3 text-sm focus:ring-2 focus:outline-none"
        >
          <option value="today">Hoy</option>
          <option value="week">Últimos 7 días</option>
          <option value="month">Últimos 30 días</option>
          <option value="all">Todo</option>
        </select>
      </div>

      @if (loading()) {
        <mo-page-skeleton variant="table" [rows]="8" label="Cargando registros…" />
      } @else if (loadError()) {
        <mo-empty-state title="No se pudo cargar el registro" [description]="loadError()">
          <mo-button (click)="load()">Reintentar</mo-button>
        </mo-empty-state>
      } @else if (visibleRows().length === 0) {
        <mo-empty-state
          title="Sin registros"
          description="No hay actividad registrada para los filtros seleccionados."
        />
      } @else {
        <mo-table-shell class="flex-1">
          <table moTable>
            <thead moThead>
              <tr>
                <th moTh>Fecha</th>
                <th moTh>Usuario</th>
                <th moTh>Acción</th>
                <th moTh>Sobre</th>
                <th moTh>Detalle</th>
              </tr>
            </thead>
            <tbody class="divide-y">
              @for (row of visibleRows(); track row.log.id) {
                <tr
                  class="hover:bg-muted/30 cursor-pointer align-top"
                  [class.bg-muted/40]="expandedId() === row.log.id"
                  tabindex="0"
                  [attr.aria-expanded]="expandedId() === row.log.id"
                  (click)="toggle(row.log.id)"
                  (keydown.enter)="toggle(row.log.id)"
                >
                  <td moTd class="text-muted-foreground text-xs whitespace-nowrap tabular-nums">
                    {{ formatDate(row.log.createdAt) }}
                  </td>
                  <td moTd class="max-w-[180px] truncate text-xs" [title]="row.log.userEmail">
                    {{ row.log.userEmail || 'Sistema' }}
                  </td>
                  <td moTd>
                    <mo-badge [variant]="row.variant">{{ row.actionLabel }}</mo-badge>
                    <div class="text-muted-foreground mt-1 text-[11px]">{{ row.moduleLabel }}</div>
                  </td>
                  <td moTd class="max-w-[200px] text-xs font-semibold">
                    <span class="line-clamp-2">{{ row.subject }}</span>
                  </td>
                  <td moTd class="text-muted-foreground max-w-[340px] text-xs">
                    <span class="line-clamp-2">{{ row.summary }}</span>
                  </td>
                </tr>
                @if (expandedId() === row.log.id) {
                  <tr class="bg-muted/20">
                    <td moTd colspan="5">
                      @if (row.details.length > 0) {
                        <dl class="grid gap-x-6 gap-y-2 text-xs sm:grid-cols-2 lg:grid-cols-3">
                          @for (item of row.details; track $index) {
                            <div>
                              <dt class="text-muted-foreground">{{ item.label }}</dt>
                              <dd class="font-semibold break-words">{{ item.value }}</dd>
                            </div>
                          }
                        </dl>
                      } @else {
                        <p class="text-muted-foreground text-xs">Este registro no guardó detalle.</p>
                      }
                      <p class="text-muted-foreground mt-3 text-[11px]">
                        {{ formatDateLong(row.log.createdAt) }} · {{ row.log.userEmail || 'Sistema' }}
                      </p>
                    </td>
                  </tr>
                }
              }
            </tbody>
          </table>
          <p class="text-muted-foreground px-4 py-3 text-xs">
            Mostrando {{ visibleRows().length }} de {{ rows().length }} registros
            @if (rows().length >= loadLimit) {
              (los {{ loadLimit }} más recientes del periodo; acota el periodo o el módulo para ver más)
            }
            · Toca un registro para ver todo su detalle.
          </p>
        </mo-table-shell>
      }
    </section>
  `,
})
export class AuditoriaPage {
  private readonly repo = inject(AuditLogRepository)
  private readonly session = inject(SessionService)
  private readonly tiendaInfo = inject(TiendaInfoService)

  readonly modules = AUDIT_MODULES
  readonly loadLimit = LOAD_LIMIT

  readonly logs = signal<AuditLog[]>([])
  readonly loading = signal(true)
  readonly loadError = signal<string | null>(null)
  readonly filterModule = signal<AuditModule | ''>('')
  readonly filterUser = signal('')
  readonly query = signal('')
  readonly dateRange = signal<AuditDateRange>('week')
  readonly expandedId = signal<string | null>(null)

  readonly rows = computed<AuditRow[]>(() =>
    this.logs().map((log) => {
      const info = auditActionInfo(log.action, log.entityType)
      const details = formatAuditDetails(log.details)
      const subject = log.entityLabel || '—'
      const moduleLabel = auditModuleLabel(log.entityType, log.action)
      return {
        log,
        actionLabel: info.label,
        variant: info.variant,
        moduleLabel,
        subject,
        details,
        summary: summarizeAuditDetails(details),
        searchText: [
          info.label,
          moduleLabel,
          subject,
          log.userEmail,
          ...details.map((d) => `${d.label} ${d.value}`),
        ]
          .join(' ')
          .toLowerCase(),
      }
    }),
  )

  readonly users = computed(() =>
    [...new Set(this.logs().map((l) => l.userEmail).filter((e) => !!e))].sort((a, b) => a.localeCompare(b, 'es')),
  )

  readonly visibleRows = computed(() => {
    const q = this.query().trim().toLowerCase()
    const user = this.filterUser()
    return this.rows().filter((row) => {
      if (user && row.log.userEmail !== user) return false
      if (q && !row.searchText.includes(q)) return false
      return true
    })
  })

  constructor() {
    void this.load()
  }

  async load(): Promise<void> {
    this.loading.set(true)
    this.loadError.set(null)
    try {
      const auth = await this.session.getAuthContext()
      if (!auth) throw new Error('No autenticado')
      const { timezone } = await this.tiendaInfo.get(auth.tiendaId)
      const from = auditRangeStart(this.dateRange(), timezone)
      const module = this.filterModule()
      this.logs.set(
        await this.repo.list(auth.tiendaId, {
          module: module || undefined,
          from,
          limit: LOAD_LIMIT,
        }),
      )
      this.expandedId.set(null)
    } catch (error) {
      this.loadError.set(getErrorMessage(error, 'Error al cargar registros'))
    } finally {
      this.loading.set(false)
    }
  }

  onModuleChange(event: Event): void {
    this.filterModule.set(this.inputValue(event) as AuditModule | '')
    void this.load()
  }

  onDateRangeChange(event: Event): void {
    this.dateRange.set(this.inputValue(event) as AuditDateRange)
    void this.load()
  }

  toggle(id: string): void {
    this.expandedId.update((current) => (current === id ? null : id))
  }

  inputValue(event: Event): string {
    return (event.target as HTMLInputElement | HTMLSelectElement).value
  }

  formatDate(date: Date): string {
    return date.toLocaleString('es-CO', {
      day: '2-digit', month: '2-digit', year: '2-digit',
      hour: '2-digit', minute: '2-digit',
    })
  }

  formatDateLong(date: Date): string {
    return date.toLocaleString('es-CO', { dateStyle: 'full', timeStyle: 'medium' })
  }
}
