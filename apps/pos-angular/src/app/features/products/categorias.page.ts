import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core'
import { getErrorMessage } from '@/shared/lib/error-message'
import { RouterLink, RouterLinkActive } from '@angular/router'
import { PageHeaderComponent } from '../../shared/molecules/page-header.component'
import { ButtonComponent } from '../../shared/atoms/button.component'
import { BadgeComponent } from '../../shared/atoms/badge.component'
import { EmptyStateComponent } from '../../shared/molecules/empty-state.component'
import { CategoriaFormDialog } from './categoria-form.dialog'
import { ProductsRepository } from './products.repository'
import { ProductsCacheStore } from './products-cache.store'
import { SessionService } from '../../core/auth/session.service'
import { ToastService } from '../../shared/organisms/toast/toast.service'
import type { Categoria } from '@/modules/products/domain/entities/product.entity'
import { ExcelExportService } from '../../shared/services/export/excel-export.service'
import { buildCategoriesWorkbook } from './product-export'

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
        <mo-button
          variant="outline"
          [loading]="exporting()"
          loadingText="Generando..."
          [disabled]="categorias().length === 0"
          (click)="exportCategories()"
        >
          Descargar Excel
        </mo-button>
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
            <thead
              class="bg-muted/50 text-muted-foreground sticky top-0 text-left text-xs tracking-wide uppercase"
            >
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
  private readonly store = inject(ProductsCacheStore)
  private readonly session = inject(SessionService)
  private readonly toast = inject(ToastService)
  private readonly excel = inject(ExcelExportService)

  readonly categorias = computed(() => this.store.categorias() ?? [])
  readonly loading = signal(true)
  readonly loadError = signal<string | null>(null)
  readonly dialogOpen = signal(false)
  readonly editing = signal<Categoria | null>(null)
  readonly exporting = signal(false)

  constructor() {
    void this.load()
  }

  async load(options: { force?: boolean } = {}): Promise<void> {
    this.loading.set(true)
    this.loadError.set(null)
    try {
      const auth = await this.session.getAuthContext()
      if (!auth) throw new Error('No autenticado')
      await this.store.ensureCategorias(auth.tiendaId, { force: options.force })
    } catch (error) {
      this.loadError.set(getErrorMessage(error, 'Error al cargar'))
    } finally {
      this.loading.set(false)
    }
  }

  async exportCategories(): Promise<void> {
    this.exporting.set(true)
    try {
      await this.excel.download(buildCategoriesWorkbook(this.categorias()))
      this.toast.success('Archivo de categorías descargado')
    } catch (error) {
      this.toast.error(getErrorMessage(error, 'No se pudo generar el archivo'))
    } finally {
      this.exporting.set(false)
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
    this.store.upsertCategoria(cat)
  }

  async confirmDeactivate(cat: Categoria): Promise<void> {
    if (!window.confirm(`¿Desactivar "${cat.nombre}"?`)) return
    const auth = await this.session.getAuthContext()
    if (!auth) return
    try {
      await this.repo.deactivateCategoria(cat.id, auth.tiendaId)
      this.toast.success('Categoria desactivada')
      this.store.patchCategoria(cat.id, { isActive: false })
    } catch (error) {
      this.toast.error(getErrorMessage(error, 'No se pudo desactivar'))
    }
  }
}
