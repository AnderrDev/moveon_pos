import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core'
import { PageHeaderComponent } from '../../shared/layout/page-header.component'
import { ButtonComponent } from '../../shared/ui/button.component'
import { EmptyStateComponent } from '../../shared/feedback/empty-state.component'
import { ClienteFormDialog } from './cliente-form.dialog'
import { CustomersRepository } from './customers.repository'
import { SessionService } from '../../core/auth/session.service'
import { ToastService } from '../../shared/feedback/toast.service'
import type { Cliente } from '@/modules/customers/domain/entities/cliente.entity'

@Component({
  selector: 'mo-clientes-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeaderComponent, ButtonComponent, EmptyStateComponent, ClienteFormDialog],
  template: `
    <section class="flex h-full min-h-0 flex-col">
      <mo-page-header title="Clientes" subtitle="Directorio de clientes">
        <input
          type="search"
          [value]="query()"
          (input)="onQuery($event)"
          placeholder="Buscar por nombre, email o telefono"
          class="border-input bg-card focus:ring-ring h-10 w-72 rounded-lg border px-3 text-sm focus:outline-none focus:ring-2"
        />
        <mo-button (click)="openCreate()">+ Nuevo cliente</mo-button>
      </mo-page-header>

      @if (loading()) {
        <div class="bg-card flex-1 animate-pulse rounded-xl border p-8">
          <div class="bg-muted/50 h-72 rounded-xl"></div>
        </div>
      } @else if (loadError()) {
        <mo-empty-state title="Error al cargar clientes" [description]="loadError()">
          <mo-button (click)="load()">Reintentar</mo-button>
        </mo-empty-state>
      } @else if (filtered().length === 0) {
        <mo-empty-state
          title="Sin clientes"
          description="Crea el primer cliente para empezar a registrarlos en ventas."
        >
          <mo-button (click)="openCreate()">+ Nuevo cliente</mo-button>
        </mo-empty-state>
      } @else {
        <div class="bg-card flex-1 overflow-auto rounded-xl border">
          <table class="w-full text-sm">
            <thead class="bg-muted/50 text-muted-foreground sticky top-0 text-left text-xs uppercase tracking-wide">
              <tr>
                <th class="px-4 py-3">Nombre</th>
                <th class="px-4 py-3">Documento</th>
                <th class="px-4 py-3">Email</th>
                <th class="px-4 py-3">Telefono</th>
                <th class="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody class="divide-y">
              @for (c of filtered(); track c.id) {
                <tr class="hover:bg-muted/30">
                  <td class="px-4 py-3 font-semibold">{{ c.nombre }}</td>
                  <td class="text-muted-foreground px-4 py-3 text-xs">
                    @if (c.tipoDocumento && c.numeroDocumento) {
                      {{ c.tipoDocumento }} · {{ c.numeroDocumento }}
                    } @else {
                      —
                    }
                  </td>
                  <td class="text-muted-foreground px-4 py-3">{{ c.email ?? '—' }}</td>
                  <td class="text-muted-foreground px-4 py-3">{{ c.telefono ?? '—' }}</td>
                  <td class="px-4 py-3 text-right">
                    <div class="flex justify-end gap-1">
                      <mo-button size="sm" variant="outline" (click)="openEdit(c)"
                        >Editar</mo-button
                      >
                      <mo-button size="sm" variant="ghost" (click)="confirmDelete(c)"
                        >Eliminar</mo-button
                      >
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>

    <mo-cliente-form-dialog
      [open]="dialogOpen()"
      [cliente]="editing()"
      (closed)="closeDialog()"
      (saved)="onSaved($event)"
    />
  `,
})
export class ClientesPage {
  private readonly repo = inject(CustomersRepository)
  private readonly session = inject(SessionService)
  private readonly toast = inject(ToastService)

  readonly clientes = signal<Cliente[]>([])
  readonly loading = signal(true)
  readonly loadError = signal<string | null>(null)
  readonly query = signal('')
  readonly dialogOpen = signal(false)
  readonly editing = signal<Cliente | null>(null)

  readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase()
    if (!q) return this.clientes()
    return this.clientes().filter((c) =>
      [c.nombre, c.email ?? '', c.telefono ?? '', c.numeroDocumento ?? '']
        .join(' ')
        .toLowerCase()
        .includes(q),
    )
  })

  constructor() {
    void this.load()
  }

  onQuery(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value)
  }

  async load(): Promise<void> {
    this.loading.set(true)
    this.loadError.set(null)
    try {
      const auth = await this.session.getAuthContext()
      if (!auth) throw new Error('No autenticado')
      this.clientes.set(await this.repo.list(auth.tiendaId))
    } catch (error) {
      this.loadError.set(error instanceof Error ? error.message : 'Error al cargar')
    } finally {
      this.loading.set(false)
    }
  }

  openCreate(): void {
    this.editing.set(null)
    this.dialogOpen.set(true)
  }

  openEdit(c: Cliente): void {
    this.editing.set(c)
    this.dialogOpen.set(true)
  }

  closeDialog(): void {
    this.dialogOpen.set(false)
    this.editing.set(null)
  }

  onSaved(c: Cliente): void {
    const current = this.clientes()
    const idx = current.findIndex((x) => x.id === c.id)
    if (idx >= 0) {
      const next = [...current]
      next[idx] = c
      this.clientes.set(next)
    } else {
      this.clientes.set([c, ...current])
    }
  }

  async confirmDelete(c: Cliente): Promise<void> {
    if (!window.confirm(`¿Eliminar a "${c.nombre}"?`)) return
    const auth = await this.session.getAuthContext()
    if (!auth) return
    try {
      await this.repo.delete(c.id, auth.tiendaId)
      this.toast.success('Cliente eliminado')
      this.clientes.set(this.clientes().filter((x) => x.id !== c.id))
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'No se pudo eliminar')
    }
  }
}
