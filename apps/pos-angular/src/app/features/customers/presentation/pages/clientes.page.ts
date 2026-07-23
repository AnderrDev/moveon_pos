import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core'
import {
  LucideAngularModule,
  CupSoda,
  FileDown,
  IdCard,
  Mail,
  Pencil,
  Phone,
  Search,
  Trash2,
  UserPlus,
} from 'lucide-angular'
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
    LucideAngularModule,
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
      <mo-page-header title="Clientes" [subtitle]="subtitle()">
        <div class="relative">
          <lucide-angular
            [img]="icons.search"
            class="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
            aria-hidden="true"
          />
          <input
            type="search"
            [value]="query()"
            (input)="onQuery($event)"
            placeholder="Buscar por nombre, email o telefono"
            class="border-input bg-card focus:ring-ring h-10 w-72 rounded-lg border pr-3 pl-9 text-sm focus:ring-2 focus:outline-none"
          />
        </div>
        @if (canExport()) {
          <mo-button
            variant="outline"
            [loading]="exporting()"
            loadingText="Generando..."
            [disabled]="filtered().length === 0"
            (click)="exportCustomers()"
          >
            <lucide-angular [img]="icons.download" class="mr-1.5 h-4 w-4" aria-hidden="true" />
            Descargar Excel
          </mo-button>
        }
        <mo-button (click)="openCreate()">
          <lucide-angular [img]="icons.userPlus" class="mr-1.5 h-4 w-4" aria-hidden="true" />
          Nuevo cliente
        </mo-button>
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
                <th moTh>Cliente</th>
                <th moTh>Documento</th>
                <th moTh>Contacto</th>
                <th moTh class="text-right">Acciones</th>
              </tr>
            </thead>
            <tbody class="divide-y">
              @for (c of filtered(); track c.id) {
                <tr class="hover:bg-muted/30 group">
                  <td moTd>
                    <div class="flex items-center gap-3">
                      <span
                        class="bg-primary/10 text-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-black uppercase"
                      >
                        {{ initials(c) }}
                      </span>
                      <div class="min-w-0">
                        <div class="flex items-center gap-1.5">
                          <p class="truncate font-semibold">{{ c.nombre }}</p>
                          @if (c.autorizaFidelizacion) {
                            <span
                              class="bg-primary/10 text-primary inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                              title="Participa en MOVE ON Club"
                            >
                              <lucide-angular [img]="icons.cup" class="h-3 w-3" aria-hidden="true" />
                              Club
                            </span>
                          }
                        </div>
                      </div>
                    </div>
                  </td>
                  <td moTd class="text-muted-foreground text-xs">
                    @if (c.tipoDocumento && c.numeroDocumento) {
                      <span class="inline-flex items-center gap-1.5">
                        <lucide-angular [img]="icons.idCard" class="h-3.5 w-3.5" aria-hidden="true" />
                        {{ c.tipoDocumento }} · {{ c.numeroDocumento }}
                      </span>
                    } @else {
                      —
                    }
                  </td>
                  <td moTd class="text-muted-foreground text-xs">
                    <div class="space-y-0.5">
                      @if (c.telefono) {
                        <p class="flex items-center gap-1.5">
                          <lucide-angular [img]="icons.phone" class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          {{ c.telefono }}
                        </p>
                      }
                      @if (c.email) {
                        <p class="flex items-center gap-1.5">
                          <lucide-angular [img]="icons.mail" class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          <span class="truncate">{{ c.email }}</span>
                        </p>
                      }
                      @if (!c.telefono && !c.email) {
                        —
                      }
                    </div>
                  </td>
                  <td moTd class="text-right">
                    <div class="flex justify-end gap-1">
                      <mo-button size="sm" variant="outline" (click)="openLoyalty(c)">
                        <lucide-angular [img]="icons.cup" class="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                        Club
                      </mo-button>
                      <mo-button size="sm" variant="outline" title="Editar cliente" (click)="openEdit(c)">
                        <lucide-angular [img]="icons.pencil" class="h-3.5 w-3.5" aria-hidden="true" />
                        <span class="sr-only">Editar</span>
                      </mo-button>
                      <mo-button size="sm" variant="ghost" title="Eliminar cliente" (click)="confirmDelete(c)">
                        <lucide-angular [img]="icons.trash" class="text-destructive h-3.5 w-3.5" aria-hidden="true" />
                        <span class="sr-only">Eliminar</span>
                      </mo-button>
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

  readonly subtitle = computed(() => {
    const total = this.clientes().length
    if (total === 0) return 'Directorio de clientes'
    const club = this.clientes().filter((c) => c.autorizaFidelizacion).length
    return `${total} ${total === 1 ? 'cliente' : 'clientes'} · ${club} en MOVE ON Club`
  })

  readonly icons = {
    search: Search,
    download: FileDown,
    userPlus: UserPlus,
    cup: CupSoda,
    idCard: IdCard,
    mail: Mail,
    phone: Phone,
    pencil: Pencil,
    trash: Trash2,
  }

  initials(c: Cliente): string {
    return c.nombre
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
  }

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
