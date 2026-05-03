import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core'
import { RouterLink, RouterLinkActive } from '@angular/router'
import { PageHeaderComponent } from '../../shared/layout/page-header.component'
import { ButtonComponent } from '../../shared/ui/button.component'
import { BadgeComponent } from '../../shared/ui/badge.component'
import { EmptyStateComponent } from '../../shared/feedback/empty-state.component'
import { CategoriaFormDialog } from './categoria-form.dialog'
import { ProductsRepository } from './products.repository'
import { SessionService } from '../../core/auth/session.service'
import { ToastService } from '../../shared/feedback/toast.service'
import type { Categoria } from '@/modules/products/domain/entities/product.entity'

@Component({
  selector: 'mo-categorias-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    RouterLinkActive,
    PageHeaderComponent,
    ButtonComponent,
    BadgeComponent,
    EmptyStateComponent,
    CategoriaFormDialog,
  ],
  template: `
    <section class="flex h-full min-h-0 flex-col">
      <mo-page-header title="Productos" subtitle="Catalogo y precios">
        <mo-button (click)="openCreate()">+ Nueva categoria</mo-button>
      </mo-page-header>

      <nav class="mb-4 flex gap-1 text-sm">
        <a
          routerLink="/productos"
          routerLinkActive="bg-primary text-primary-foreground"
          [routerLinkActiveOptions]="{ exact: true }"
          class="hover:bg-muted rounded-lg px-3 py-1.5 font-semibold"
          >Productos</a
        >
        <a
          routerLink="/productos/categorias"
          routerLinkActive="bg-primary text-primary-foreground"
          class="hover:bg-muted rounded-lg px-3 py-1.5 font-semibold"
          >Categorias</a
        >
      </nav>

      @if (loading()) {
        <div class="bg-card flex-1 animate-pulse rounded-xl border p-8">
          <div class="bg-muted mb-3 h-6 w-40 rounded"></div>
          <div class="bg-muted/50 h-72 rounded-xl"></div>
        </div>
      } @else if (loadError()) {
        <mo-empty-state title="No se pudieron cargar las categorias" [description]="loadError()">
          <mo-button (click)="load()">Reintentar</mo-button>
        </mo-empty-state>
      } @else if (categorias().length === 0) {
        <mo-empty-state
          title="Sin categorias"
          description="Crea categorias para organizar tu catalogo."
        >
          <mo-button (click)="openCreate()">+ Nueva categoria</mo-button>
        </mo-empty-state>
      } @else {
        <div class="bg-card flex-1 overflow-auto rounded-xl border">
          <table class="w-full text-sm">
            <thead class="bg-muted/50 text-muted-foreground sticky top-0 text-left text-xs uppercase tracking-wide">
              <tr>
                <th class="px-4 py-3">Categoria</th>
                <th class="px-4 py-3">Estado</th>
                <th class="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody class="divide-y">
              @for (cat of categorias(); track cat.id) {
                <tr class="hover:bg-muted/30">
                  <td class="px-4 py-3 font-semibold">{{ cat.nombre }}</td>
                  <td class="px-4 py-3">
                    @if (cat.isActive) {
                      <mo-badge variant="success">Activa</mo-badge>
                    } @else {
                      <mo-badge variant="warning">Inactiva</mo-badge>
                    }
                  </td>
                  <td class="px-4 py-3 text-right">
                    <div class="flex justify-end gap-1">
                      <mo-button size="sm" variant="outline" (click)="openEdit(cat)">
                        Editar
                      </mo-button>
                      @if (cat.isActive) {
                        <mo-button size="sm" variant="ghost" (click)="confirmDeactivate(cat)">
                          Desactivar
                        </mo-button>
                      }
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>

    <mo-categoria-form-dialog
      [open]="dialogOpen()"
      [categoria]="editing()"
      (closed)="closeDialog()"
      (saved)="onSaved($event)"
    />
  `,
})
export class CategoriasPage {
  private readonly repo = inject(ProductsRepository)
  private readonly session = inject(SessionService)
  private readonly toast = inject(ToastService)

  readonly categorias = signal<Categoria[]>([])
  readonly loading = signal(true)
  readonly loadError = signal<string | null>(null)
  readonly dialogOpen = signal(false)
  readonly editing = signal<Categoria | null>(null)

  constructor() {
    void this.load()
  }

  async load(): Promise<void> {
    this.loading.set(true)
    this.loadError.set(null)
    try {
      const auth = await this.session.getAuthContext()
      if (!auth) throw new Error('No autenticado')
      const list = await this.repo.listCategorias(auth.tiendaId)
      this.categorias.set(list)
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

  openEdit(cat: Categoria): void {
    this.editing.set(cat)
    this.dialogOpen.set(true)
  }

  closeDialog(): void {
    this.dialogOpen.set(false)
    this.editing.set(null)
  }

  onSaved(cat: Categoria): void {
    const current = this.categorias()
    const idx = current.findIndex((c) => c.id === cat.id)
    if (idx >= 0) {
      const next = [...current]
      next[idx] = cat
      this.categorias.set(next)
    } else {
      this.categorias.set([...current, cat])
    }
  }

  async confirmDeactivate(cat: Categoria): Promise<void> {
    if (!window.confirm(`¿Desactivar "${cat.nombre}"?`)) return
    const auth = await this.session.getAuthContext()
    if (!auth) return
    try {
      await this.repo.deactivateCategoria(cat.id, auth.tiendaId)
      this.toast.success('Categoria desactivada')
      this.categorias.set(
        this.categorias().map((c) => (c.id === cat.id ? { ...c, isActive: false } : c)),
      )
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'No se pudo desactivar')
    }
  }
}
