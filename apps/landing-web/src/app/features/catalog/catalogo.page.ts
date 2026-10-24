import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core'
import { CommonModule } from '@angular/common'
import { ClubProgressComponent } from '../club/club-progress.component'
import { OffersCarouselComponent } from './offers-carousel.component'
import {
  CatalogoService,
  type CatalogoProducto,
  type CatalogoCategoria,
  type CatalogoContactSettings,
} from './catalogo.service'
import { reportError } from '../../core/observability/sentry'
import { WA_MENSAJES, whatsappLink } from '../../shared/whatsapp'
import {
  BATIDO_ADICIONALES,
  BATIDO_BASES,
  BATIDO_PREMIUM,
  BATIDO_TOPPINGS,
  CAFE_ITEMS,
  COMBOS,
  CONFIANZA,
  DEFAULT_CONTACT_SETTINGS,
  HORARIO_FESTIVOS,
  HORARIO_SEMANA,
  MAPS_URL,
  SNACK_ITEMS,
} from './catalog-content'
// Con alias: sin ellos los nombres chocarían visualmente con los miembros de
// la clase (`visibleCategories`, `totalPages`, `shortText`).
import {
  filterProducts,
  paginate,
  PRODUCTS_PAGE_SIZE,
  selectOffers,
  shortText as truncate,
  totalPages as calcTotalPages,
  visibleCategories as onlyVisibleCategories,
} from './catalog-filters'

const BADGE_STYLES: Record<string, [string, string]> = {
  'Más vendido': ['#F9D128', '#000000'],
  'Nuevo': ['#FFFFFF', '#000000'],
  'Promoción': ['#FF5C39', '#000000'],
}
const BADGE_DEFAULT: [string, string] = ['#161616', '#F9D128']

/** Milisegundos que tarda el menú móvil en colapsar (transición .18s + margen). */
const MOBILE_MENU_COLLAPSE_MS = 240

interface CategoryChip {
  id: string
  nombre: string
  conteoTexto: string
}

@Component({
  selector: 'mo-catalogo-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ClubProgressComponent, OffersCarouselComponent],
  templateUrl: './catalogo.page.html',
  styleUrl: './catalogo.page.css',
})
export class CatalogoPage implements OnInit {
  private readonly catalogoService = inject(CatalogoService)

  readonly loading = signal(true)
  readonly loadError = signal(false)
  private readonly categorias = signal<CatalogoCategoria[]>([])
  private readonly contactSettings = signal<CatalogoContactSettings>(DEFAULT_CONTACT_SETTINGS)
  readonly search = signal('')
  readonly selectedCategory = signal<'all' | string>('all')
  readonly currentPage = signal(1)
  readonly mobileMenuOpen = signal(false)

  readonly visibleCategories = computed(() => onlyVisibleCategories(this.categorias()))

  readonly categoryChips = computed<CategoryChip[]>(() =>
    this.visibleCategories()
      .filter((cat) => cat.productos.length > 0)
      .map((cat) => ({
        id: cat.id,
        nombre: cat.nombre,
        conteoTexto: String(cat.productos.length),
      })),
  )

  readonly allProducts = computed(() =>
    this.visibleCategories().flatMap((cat) => cat.productos),
  )

  readonly totalProductos = computed(() => this.allProducts().length)

  readonly ofertas = computed(() => selectOffers(this.allProducts()))

  readonly productosFiltrados = computed(() =>
    filterProducts(this.allProducts(), {
      categoryId: this.selectedCategory(),
      search: this.search(),
    }),
  )

  readonly showPagination = computed(() => this.productosFiltrados().length > PRODUCTS_PAGE_SIZE)

  readonly totalPages = computed(() => calcTotalPages(this.productosFiltrados().length))

  readonly productosPaginados = computed(() => {
    const products = this.productosFiltrados()
    if (!this.showPagination()) return products
    return paginate(products, this.currentPage())
  })

  readonly resultsLabel = computed(() => {
    const count = this.productosFiltrados().length
    const label = count === 1 ? '1 producto disponible' : `${count} productos disponibles`
    if (this.showPagination()) {
      const start = (this.currentPage() - 1) * PRODUCTS_PAGE_SIZE + 1
      const end = Math.min(this.currentPage() * PRODUCTS_PAGE_SIZE, count)
      return `${label} · mostrando ${start}-${end}`
    }
    if (this.selectedCategory() === 'all' && !this.search()) return label
    return `${label} para tu búsqueda`
  })

  readonly waGeneral = computed(() => this.wa(WA_MENSAJES.general))
  readonly waBatidos = computed(() => this.wa(WA_MENSAJES.batidos))
  readonly instagram = computed(() => this.contactSettings().instagramHandle)
  readonly igLink = computed(() => this.contactSettings().instagramUrl)
  readonly whatsappDisplay = computed(() => this.contactSettings().whatsappDisplay)
  readonly whatsappNumber = computed(() => this.contactSettings().whatsappNumber)

  readonly horarioSemana = HORARIO_SEMANA
  readonly horarioFestivos = HORARIO_FESTIVOS
  readonly mapsUrl = MAPS_URL
  readonly currentYear = new Date().getFullYear()

  readonly confianza = CONFIANZA
  readonly batidoBases = BATIDO_BASES
  readonly batidoAdicionales = BATIDO_ADICIONALES
  readonly batidoToppings = BATIDO_TOPPINGS
  readonly batidoPremium = BATIDO_PREMIUM
  readonly cafeItems = CAFE_ITEMS
  readonly snackItems = SNACK_ITEMS
  readonly combos = COMBOS

  async ngOnInit(): Promise<void> {
    try {
      const [categorias, contactSettings] = await Promise.all([
        this.catalogoService.getCatalogo(),
        // Degradación elegante: sin settings se usan los de por defecto, pero
        // el fallo igual se reporta (un WhatsApp desactualizado es un bug).
        this.catalogoService.getContactSettings().catch((error: unknown) => {
          void reportError(error)
          return null
        }),
      ])
      this.categorias.set(categorias)
      if (contactSettings) this.contactSettings.set(contactSettings)
    } catch (error: unknown) {
      void reportError(error)
      this.loadError.set(true)
    } finally {
      this.loading.set(false)
    }
  }

  onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value)
    this.currentPage.set(1)
  }

  selectCategory(catId: 'all' | string): void {
    this.selectedCategory.set(catId)
    this.currentPage.set(1)
  }

  clearFilters(): void {
    this.search.set('')
    this.selectedCategory.set('all')
    this.currentPage.set(1)
  }

  toggleMobileMenu(): void {
    this.mobileMenuOpen.update((open) => !open)
  }

  closeMobileMenu(): void {
    if (!this.mobileMenuOpen()) return
    this.mobileMenuOpen.set(false)
    // El colapso del menú resta altura por encima del ancla mientras el scroll
    // suave está en vuelo; re-alinear al destino cuando termine la transición.
    setTimeout(() => {
      const id = window.location.hash.slice(1)
      if (id) document.getElementById(id)?.scrollIntoView({ block: 'start' })
    }, MOBILE_MENU_COLLAPSE_MS)
  }

  prevPage(): void {
    this.currentPage.update((page) => Math.max(1, page - 1))
    this.scrollCatalogIntoView()
  }

  nextPage(): void {
    this.currentPage.update((page) => Math.min(this.totalPages(), page + 1))
    this.scrollCatalogIntoView()
  }

  marcaDe(p: CatalogoProducto): string {
    return p.marca ?? p.categoriaNombre ?? 'Move On'
  }

  badgeBg(etiqueta: string): string {
    return (BADGE_STYLES[etiqueta] ?? BADGE_DEFAULT)[0]
  }

  badgeFg(etiqueta: string): string {
    return (BADGE_STYLES[etiqueta] ?? BADGE_DEFAULT)[1]
  }

  waProducto(p: CatalogoProducto): string {
    return this.wa(WA_MENSAJES.producto(p.nombre))
  }

  shortText(value: string): string {
    return truncate(value)
  }

  private wa(msg: string): string {
    return whatsappLink(this.contactSettings().whatsappNumber, msg)
  }

  private scrollCatalogIntoView(): void {
    setTimeout(() => document.getElementById('catalogo')?.scrollIntoView({ block: 'start' }))
  }
}
