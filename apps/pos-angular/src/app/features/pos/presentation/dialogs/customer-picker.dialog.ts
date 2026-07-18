import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core'
import { getErrorMessage } from '@/shared/lib/error-message'
import { normalizePhoneCO } from '@angular-app/features/customers/domain/value-objects/phone-co'
import { DialogComponent } from '@angular-app/shared/organisms/dialog.component'
import { CustomerRepository } from '@angular-app/features/customers/domain/repositories/customer.repository'
import { SessionService } from '@angular-app/core/auth/session.service'
import type { Cliente } from '@angular-app/features/customers/domain/entities/cliente.entity'

@Component({
  selector: 'mo-customer-picker-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DialogComponent],
  template: `
    <mo-dialog [open]="open()" title="Asociar cliente" width="md" (closed)="onClose()">
      <div class="space-y-3">
        <div class="flex gap-2">
          <input
            type="search"
            [value]="query()"
            (input)="onQuery($event)"
            placeholder="Buscar por celular, documento o nombre"
            class="border-input bg-card focus:ring-ring h-11 min-w-0 flex-1 rounded-lg border px-3.5 text-sm focus:ring-2 focus:outline-none"
          />
          <button
            type="button"
            (click)="onCreateRequested()"
            class="border-primary/50 text-primary hover:bg-primary/10 h-11 shrink-0 rounded-lg border border-dashed px-3 text-xs font-bold transition-colors"
          >
            + Nuevo
          </button>
        </div>

        @if (loading()) {
          <div class="space-y-2">
            @for (i of [0, 1, 2, 3]; track i) {
              <div class="bg-muted/50 h-12 animate-pulse rounded-lg"></div>
            }
          </div>
        } @else if (loadError()) {
          <div class="text-center">
            <p class="text-destructive text-sm font-semibold">{{ loadError() }}</p>
            <button
              type="button"
              (click)="load()"
              class="text-primary mt-2 text-xs font-semibold underline"
            >
              Reintentar
            </button>
          </div>
        } @else if (filtered().length === 0) {
          <p class="text-muted-foreground py-8 text-center text-sm">
            @if (query().trim()) {
              Sin clientes para "{{ query() }}"
            } @else {
              No hay clientes registrados
            }
          </p>
        } @else {
          <div class="max-h-80 space-y-1.5 overflow-y-auto overscroll-contain">
            @for (c of filtered(); track c.id) {
              <button
                type="button"
                (click)="select(c)"
                class="bg-background hover:border-primary/50 hover:bg-primary/5 focus:ring-ring flex w-full items-center justify-between gap-3 rounded-lg border px-3.5 py-2.5 text-left transition-colors focus:ring-2 focus:outline-none"
              >
                <span class="min-w-0">
                  <span class="block truncate text-sm font-semibold">{{ c.nombre }}</span>
                  <span class="text-muted-foreground block truncate text-xs">
                    @if (c.tipoDocumento && c.numeroDocumento) {
                      {{ c.tipoDocumento }} · {{ c.numeroDocumento }}
                    }
                    @if (c.telefono) {
                      <span>· {{ c.telefono }}</span>
                    }
                  </span>
                </span>
                @if (c.autorizaFidelizacion) {
                  <span
                    class="bg-primary/10 text-primary inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-bold"
                  >
                    Club
                  </span>
                }
              </button>
            }
          </div>
        }
      </div>
    </mo-dialog>
  `,
})
export class CustomerPickerDialog {
  private readonly repo = inject(CustomerRepository)
  private readonly session = inject(SessionService)

  readonly open = input<boolean>(false)

  readonly closed = output<void>()
  readonly selected = output<Cliente>()
  /** Registro rápido desde el flujo de venta (RN-CL07): la página abre el form. */
  readonly createRequested = output<void>()

  readonly clientes = signal<Cliente[]>([])
  readonly loading = signal(false)
  readonly loadError = signal<string | null>(null)
  readonly query = signal('')

  /**
   * Búsqueda flexible: si la consulta es un celular colombiano se compara
   * contra el celular normalizado (así "+57 301..." encuentra "3012244006");
   * en paralelo filtra por nombre, documento, teléfono crudo o email.
   */
  readonly filtered = computed(() => {
    const raw = this.query().trim()
    if (!raw) return this.clientes()
    const q = raw.toLowerCase()
    const phone = normalizePhoneCO(raw)
    return this.clientes().filter(
      (c) =>
        (phone !== null && c.celularNormalizado === phone) ||
        [c.nombre, c.numeroDocumento ?? '', c.telefono ?? '', c.celularNormalizado ?? '', c.email ?? '']
          .join(' ')
          .toLowerCase()
          .includes(q),
    )
  })

  constructor() {
    // Recarga en cada apertura: un cliente puede haberse creado desde el
    // registro rápido del POS (o desde /clientes) después de la carga inicial.
    effect(() => {
      if (this.open()) {
        void this.load()
      }
    })
  }

  async load(): Promise<void> {
    this.loading.set(true)
    this.loadError.set(null)
    try {
      const auth = await this.session.getAuthContext()
      if (!auth) throw new Error('No autenticado')
      this.clientes.set(await this.repo.list(auth.tiendaId))
    } catch (error) {
      this.loadError.set(getErrorMessage(error, 'No se pudieron cargar los clientes'))
    } finally {
      this.loading.set(false)
    }
  }

  onQuery(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value)
  }

  select(cliente: Cliente): void {
    this.selected.emit(cliente)
    this.closed.emit()
  }

  onCreateRequested(): void {
    this.createRequested.emit()
    this.closed.emit()
  }

  onClose(): void {
    this.closed.emit()
  }
}
