import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core'
import { getErrorMessage } from '@/shared/lib/error-message'
import { PageHeaderComponent } from '../../shared/molecules/page-header.component'
import { ButtonComponent } from '../../shared/atoms/button.component'
import { BadgeComponent } from '../../shared/atoms/badge.component'
import { EmptyStateComponent } from '../../shared/molecules/empty-state.component'
import { AuditLogRepository } from './audit-log.repository'
import { SessionService } from '../../core/auth/session.service'
import type { AuditLog, AuditEntityType } from '@/modules/audit/domain/entities/audit-log.entity'

type DateRange = 'today' | 'week' | 'month' | 'all'

function dateRangeToDates(range: DateRange): { from?: Date; to?: Date } {
  const now = new Date()
  if (range === 'today') {
    const from = new Date(now); from.setHours(0, 0, 0, 0)
    return { from }
  }
  if (range === 'week') {
    const from = new Date(now); from.setDate(now.getDate() - 7); from.setHours(0, 0, 0, 0)
    return { from }
  }
  if (range === 'month') {
    const from = new Date(now); from.setDate(now.getDate() - 30); from.setHours(0, 0, 0, 0)
    return { from }
  }
  return {}
}

const ACTION_LABELS: Record<string, string> = {
  create: 'Crear',
  update: 'Editar',
  delete: 'Eliminar',
  activate: 'Activar',
  deactivate: 'Desactivar',
  void: 'Anular',
  open: 'Abrir caja',
  close: 'Cerrar caja',
  entry: 'Entrada',
  adjust: 'Ajuste',
  transfer: 'Traslado',
  correct_payment: 'Corregir pago',
  correct_opening: 'Corregir apertura',
}

const MODULE_LABELS: Record<string, string> = {
  producto: 'Producto',
  venta: 'Venta',
  movimiento_inventario: 'Inventario',
  sesion_caja: 'Caja',
}

const ACTION_VARIANT: Record<string, 'default' | 'warning' | 'destructive'> = {
  delete: 'destructive',
  void: 'destructive',
  deactivate: 'warning',
}

@Component({
  selector: 'mo-auditoria-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeaderComponent, ButtonComponent, BadgeComponent, EmptyStateComponent],
  template: `
    <section class="flex h-full min-h-0 flex-col">
      <mo-page-header title="Auditoría" subtitle="Registro de actividad del sistema">
        <mo-button variant="outline" [loading]="loading()" loadingText="Actualizando..." (click)="load()">
          Actualizar
        </mo-button>
      </mo-page-header>

      <div class="mb-4 flex flex-wrap gap-2">
        <select
          [value]="filterModule()"
          (change)="onModuleChange($event)"
          class="border-input bg-card focus:ring-ring h-10 rounded-lg border px-3 text-sm focus:ring-2 focus:outline-none"
        >
          <option value="">Todos los módulos</option>
          <option value="producto">Productos</option>
          <option value="venta">Ventas</option>
          <option value="movimiento_inventario">Inventario</option>
          <option value="sesion_caja">Caja</option>
        </select>
        <select
          [value]="dateRange()"
          (change)="onDateRangeChange($event)"
          class="border-input bg-card focus:ring-ring h-10 rounded-lg border px-3 text-sm focus:ring-2 focus:outline-none"
        >
          <option value="today">Hoy</option>
          <option value="week">Últimos 7 días</option>
          <option value="month">Últimos 30 días</option>
          <option value="all">Todo</option>
        </select>
      </div>

      @if (loading()) {
        <div class="bg-card flex-1 animate-pulse rounded-xl border p-8">
          <div class="bg-muted/50 h-72 rounded-xl"></div>
        </div>
      } @else if (loadError()) {
        <mo-empty-state title="No se pudo cargar el registro" [description]="loadError()">
          <mo-button (click)="load()">Reintentar</mo-button>
        </mo-empty-state>
      } @else if (logs().length === 0) {
        <mo-empty-state
          title="Sin registros"
          description="No hay actividad registrada para los filtros seleccionados."
        />
      } @else {
        <div class="bg-card flex-1 overflow-auto rounded-xl border">
          <table class="w-full text-sm">
            <thead class="bg-muted/50 text-muted-foreground sticky top-0 text-left text-xs tracking-wide uppercase">
              <tr>
                <th class="px-4 py-3">Fecha</th>
                <th class="px-4 py-3">Usuario</th>
                <th class="px-4 py-3">Módulo</th>
                <th class="px-4 py-3">Acción</th>
                <th class="px-4 py-3">Entidad</th>
                <th class="px-4 py-3">Detalle</th>
              </tr>
            </thead>
            <tbody class="divide-y">
              @for (log of logs(); track log.id) {
                <tr class="hover:bg-muted/30">
                  <td class="text-muted-foreground px-4 py-3 tabular-nums text-xs whitespace-nowrap">
                    {{ formatDate(log.createdAt) }}
                  </td>
                  <td class="px-4 py-3 text-xs">
                    {{ log.userEmail || '—' }}
                  </td>
                  <td class="px-4 py-3">
                    <span class="text-muted-foreground text-xs">{{ moduleLabel(log.entityType) }}</span>
                  </td>
                  <td class="px-4 py-3">
                    <mo-badge [variant]="actionVariant(log.action)">{{ actionLabel(log.action) }}</mo-badge>
                  </td>
                  <td class="px-4 py-3 font-medium text-xs max-w-[180px] truncate">
                    {{ log.entityLabel || log.entityId }}
                  </td>
                  <td class="text-muted-foreground px-4 py-3 text-xs max-w-[240px]">
                    {{ changesLabel(log) }}
                  </td>
                </tr>
              }
            </tbody>
          </table>
          <p class="text-muted-foreground px-4 py-3 text-xs">
            Mostrando {{ logs().length }} registros más recientes
          </p>
        </div>
      }
    </section>
  `,
})
export class AuditoriaPage {
  private readonly repo = inject(AuditLogRepository)
  private readonly session = inject(SessionService)

  readonly logs = signal<AuditLog[]>([])
  readonly loading = signal(true)
  readonly loadError = signal<string | null>(null)
  readonly filterModule = signal<string>('')
  readonly dateRange = signal<DateRange>('week')

  constructor() {
    void this.load()
  }

  async load(): Promise<void> {
    this.loading.set(true)
    this.loadError.set(null)
    try {
      const auth = await this.session.getAuthContext()
      if (!auth) throw new Error('No autenticado')
      const { from, to } = dateRangeToDates(this.dateRange())
      const mod = this.filterModule()
      this.logs.set(
        await this.repo.list(auth.tiendaId, {
          entityType: mod ? (mod as AuditEntityType) : undefined,
          from,
          to,
          limit: 500,
        })
      )
    } catch (error) {
      this.loadError.set(getErrorMessage(error, 'Error al cargar registros'))
    } finally {
      this.loading.set(false)
    }
  }

  onModuleChange(event: Event): void {
    this.filterModule.set((event.target as HTMLSelectElement).value)
    void this.load()
  }

  onDateRangeChange(event: Event): void {
    this.dateRange.set((event.target as HTMLSelectElement).value as DateRange)
    void this.load()
  }

  formatDate(date: Date): string {
    return date.toLocaleString('es-CO', {
      day: '2-digit', month: '2-digit', year: '2-digit',
      hour: '2-digit', minute: '2-digit',
    })
  }

  moduleLabel(type: string): string {
    return MODULE_LABELS[type] ?? type
  }

  actionLabel(action: string): string {
    return ACTION_LABELS[action] ?? action
  }

  actionVariant(action: string): 'default' | 'warning' | 'destructive' {
    return ACTION_VARIANT[action] ?? 'default'
  }

  changesLabel(log: AuditLog): string {
    if (!log.changes) return '—'
    const entries = Object.entries(log.changes)
    if (entries.length === 0) return '—'
    return entries
      .filter(([, v]) => v !== null && v !== undefined)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : String(v)}`)
      .join(' · ')
      .slice(0, 120)
  }
}
