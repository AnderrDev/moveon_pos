import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core'
import { getErrorMessage } from '@/shared/lib/error-message'
import { RouterLink, RouterLinkActive } from '@angular/router'
import { MO_MENU } from '@angular-app/shared/molecules/menu.component'
import { PageHeaderComponent } from '@angular-app/shared/molecules/page-header.component'
import { ButtonComponent } from '@angular-app/shared/atoms/button.component'
import { BadgeComponent } from '@angular-app/shared/atoms/badge.component'
import { EmptyStateComponent } from '@angular-app/shared/molecules/empty-state.component'
import { CategoriaFormDialog } from '@angular-app/features/products/presentation/dialogs/categoria-form.dialog'
import { TableShellComponent } from '@angular-app/shared/molecules/table/table-shell.component'
import { MO_TABLE } from '@angular-app/shared/molecules/table/table.directives'
import { ProductRepository } from '@angular-app/features/products/domain/repositories/product.repository'
import { deactivateCategoria } from '@angular-app/features/products/domain/usecases/deactivate-categoria.use-case'
import { ProductsCacheStore } from '@angular-app/core/catalog/products-cache.store'
import { SessionService } from '@angular-app/core/auth/session.service'
import { ToastService } from '@angular-app/shared/organisms/toast/toast.service'
import type { Categoria } from '@angular-app/features/products/domain/entities/product.entity'
import { ExcelExportService } from '@angular-app/shared/services/export/excel-export.service'
import { buildCategoriesWorkbook } from '@angular-app/features/products/presentation/services/product-export'
import { PageSkeletonComponent } from '@angular-app/shared/molecules/page-skeleton.component'

@Component({
  selector: 'mo-categorias-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageSkeletonComponent,
    ...MO_MENU,
    RouterLink,
    RouterLinkActive,
    PageHeaderComponent,
    ButtonComponent,
    BadgeComponent,
    EmptyStateComponent,
    CategoriaFormDialog,
    TableShellComponent,
    MO_TABLE,
  ],
  template: `
    <section class="flex h-full min-h-0 flex-col gap-4">
      <mo-page-header title="Productos" subtitle="Categorías del catálogo">
        <mo-button (click)="openCreate()">Nueva categoría</mo-button>
        <mo-menu [busy]="exporting()">
          <button
            type="button"
            moMenuItem
            [disabled]="exporting() || categorias().length === 0"
            (click)="exportCategories()"
          >
            {{ exporting() ? 'Generando Excel…' : 'Descargar Excel' }}
          </button>
        </mo-menu>
      </mo-page-header>

      <nav class="flex gap-6 border-b text-sm" aria-label="Secciones de productos">
        <a
          routerLink="/productos"
          routerLinkActive="border-primary! text-foreground!"
          [routerLinkActiveOptions]="{ exact: true }"
          class="text-muted-foreground hover:text-foreground -mb-px border-b-[3px] border-transparent pt-1 pb-2.5 font-semibold transition-colors"
          >Productos</a
        >
        <a
          routerLink="/productos/categorias"
          routerLinkActive="border-primary! text-foreground!"
          class="text-muted-foreground hover:text-foreground -mb-px border-b-[3px] border-transparent pt-1 pb-2.5 font-semibold transition-colors"
          >Categorías</a
        >
      </nav>

      @if (loading()) {
        <mo-page-skeleton variant="table" [rows]="4" label="Cargando categorías…" />
      } @else if (loadError()) {
        <mo-empty-state title="No se pudieron cargar las categorias" [description]="loadError()">
          <mo-button (click)="load()">Reintentar</mo-button>
        </mo-empty-state>
      } @else if (categorias().length === 0) {
        <mo-empty-state
          title="Sin categorias"
          description="Crea categorias para organizar tu catalogo."
        >
          <mo-button (click)="openCreate()">Nueva categoría</mo-button>
        </mo-empty-state>
      } @else {
        <mo-table-shell class="flex-1">
          <table moTable>
            <thead moThead>
              <tr>
                <th moTh>Categoria</th>
                <th moTh>Estado</th>
                <th moTh class="text-right">Acciones</th>
              </tr>
            </thead>
            <tbody class="divide-y">
              @for (cat of categorias(); track cat.id) {
                <tr class="hover:bg-muted/30">
                  <td moTd class="font-semibold">{{ cat.nombre }}</td>
                  <td moTd>
                    @if (cat.isActive) {
                      <mo-badge variant="success">Activa</mo-badge>
                    } @else {
                      <mo-badge variant="warning">Inactiva</mo-badge>
                    }
                  </td>
                  <td moTd class="text-right">
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
        </mo-table-shell>
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
  private readonly repo = inject(ProductRepository)
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
      const result = await deactivateCategoria({ repo: this.repo }, cat.id, auth.tiendaId)
      if (!result.ok) {
        this.toast.error(result.error.message)
        return
      }
      this.toast.success('Categoria desactivada')
      this.store.patchCategoria(cat.id, { isActive: false })
    } catch (error) {
      this.toast.error(getErrorMessage(error, 'No se pudo desactivar'))
    }
  }
}
