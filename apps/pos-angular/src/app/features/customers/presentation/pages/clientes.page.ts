import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core'
import { getErrorMessage } from '@/shared/lib/error-message'
import { PageHeaderComponent } from '@angular-app/shared/molecules/page-header.component'
import { ButtonComponent } from '@angular-app/shared/atoms/button.component'
import { EmptyStateComponent } from '@angular-app/shared/molecules/empty-state.component'
import { TableShellComponent } from '@angular-app/shared/molecules/table/table-shell.component'
import { MO_TABLE } from '@angular-app/shared/molecules/table/table.directives'
import { ClienteFormDialog } from '@angular-app/features/customers/presentation/dialogs/cliente-form.dialog'
import { ClienteLoyaltyDialog } from '@angular-app/features/loyalty/presentation/dialogs/cliente-loyalty.dialog'
import { CustomerRepository } from '@angular-app/features/customers/domain/repositories/customer.repository'
import { deleteCustomer } from '@angular-app/features/customers/domain/usecases/delete-customer.use-case'
import { SessionService } from '@angular-app/core/auth/session.service'
import { ToastService } from '@angular-app/shared/organisms/toast/toast.service'
import type { Cliente } from '@angular-app/features/customers/domain/entities/cliente.entity'
import { ExcelExportService } from '@angular-app/shared/services/export/excel-export.service'
import { buildCustomersWorkbook } from '@angular-app/features/customers/presentation/services/customer-export'

@Component({
  selector: 'mo-clientes-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PageHeaderComponent,
    ButtonComponent,
    EmptyStateComponent,
    ClienteFormDialog,
    ClienteLoyaltyDialog,
    TableShellComponent,
    MO_TABLE,
  ],
  template: `
    <section class="flex h-full min-h-0 flex-col">
      <mo-page-header title="Clientes" subtitle="Directorio de clientes">
        <input
          type="search"
          [value]="query()"
          (input)="onQuery($event)"
          placeholder="Buscar por nombre, email o telefono"
          class="border-input bg-card focus:ring-ring h-10 w-72 rounded-lg border px-3 text-sm focus:ring-2 focus:outline-none"
        />
        @if (canExport()) {
          <mo-button
            variant="outline"
            [loading]="exporting()"
            loadingText="Generando..."
            [disabled]="filtered().length === 0"
            (click)="exportCustomers()"
          >
            Descargar Excel
          </mo-button>
        }
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
        <mo-table-shell class="flex-1">
          <table moTable>
            <thead moThead>
              <tr>
                <th moTh>Nombre</th>
                <th moTh>Documento</th>
                <th moTh>Email</th>
                <th moTh>Telefono</th>
                <th moTh class="text-right">Acciones</th>
              </tr>
            </thead>
            <tbody class="divide-y">
              @for (c of filtered(); track c.id) {
                <tr class="hover:bg-muted/30">
                  <td moTd class="font-semibold">{{ c.nombre }}</td>
                  <td moTd class="text-muted-foreground text-xs">
                    @if (c.tipoDocumento && c.numeroDocumento) {
                      {{ c.tipoDocumento }} · {{ c.numeroDocumento }}
                    } @else {
                      —
                    }
                  </td>
                  <td moTd class="text-muted-foreground">{{ c.email ?? '—' }}</td>
                  <td moTd class="text-muted-foreground">{{ c.telefono ?? '—' }}</td>
                  <td moTd class="text-right">
                    <div class="flex justify-end gap-1">
                      <mo-button size="sm" variant="outline" (click)="openLoyalty(c)"
                        >Club</mo-button
                      >
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
        </mo-table-shell>
      }
    </section>

    <mo-cliente-form-dialog
      [open]="dialogOpen()"
      [cliente]="editing()"
      (closed)="closeDialog()"
      (saved)="onSaved($event)"
    />

    <mo-cliente-loyalty-dialog
      [open]="loyaltyFor() !== null"
      [cliente]="loyaltyFor()"
      (closed)="loyaltyFor.set(null)"
    />
  `,
})
export class ClientesPage {
  private readonly repo = inject(CustomerRepository)
  private readonly session = inject(SessionService)
  private readonly toast = inject(ToastService)
  private readonly excel = inject(ExcelExportService)

  readonly clientes = signal<Cliente[]>([])
  readonly loading = signal(true)
  readonly loadError = signal<string | null>(null)
  readonly query = signal('')
  readonly dialogOpen = signal(false)
  readonly editing = signal<Cliente | null>(null)
  readonly loyaltyFor = signal<Cliente | null>(null)
  readonly exporting = signal(false)
  readonly canExport = this.session.isAdmin

  readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase()
    if (!q) return this.clientes()
    return this.clientes().filter((c) =>
      [c.nombre, c.email ?? '', c.telefono ?? '', c.numeroDocumento ?? '']
        .join(' ')
        .toLowerCase()
        .includes(q)
    )
  })

  constructor() {
    void this.session.getRole()
    void this.load()
  }

  onQuery(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value)
  }

  async exportCustomers(): Promise<void> {
    if (!this.canExport()) return

    this.exporting.set(true)
    try {
      await this.excel.download(buildCustomersWorkbook(this.filtered(), this.query()))
      this.toast.success('Archivo de clientes descargado')
    } catch (error) {
      this.toast.error(getErrorMessage(error, 'No se pudo generar el archivo'))
    } finally {
      this.exporting.set(false)
    }
  }

  async load(): Promise<void> {
    this.loading.set(true)
    this.loadError.set(null)
    try {
      const auth = await this.session.getAuthContext()
      if (!auth) throw new Error('No autenticado')
      this.clientes.set(await this.repo.list(auth.tiendaId))
    } catch (error) {
      this.loadError.set(getErrorMessage(error, 'Error al cargar'))
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

  openLoyalty(c: Cliente): void {
    this.loyaltyFor.set(c)
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
      await deleteCustomer({ repo: this.repo }, c.id, auth.tiendaId)
      this.toast.success('Cliente eliminado')
      this.clientes.set(this.clientes().filter((x) => x.id !== c.id))
    } catch (error) {
      this.toast.error(getErrorMessage(error, 'No se pudo eliminar'))
    }
  }
}
