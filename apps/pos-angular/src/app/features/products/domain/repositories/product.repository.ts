import type { Product, Categoria, Proveedor } from '@angular-app/features/products/domain/entities/product.entity'
import type { CreateProductDto, UpdateProductDto } from '@angular-app/features/products/domain/dtos/product.dto'
import type { CreateCategoriaDto, UpdateCategoriaDto } from '@angular-app/features/products/domain/dtos/categoria.dto'
import type { CreateProveedorDto } from '@angular-app/features/products/domain/dtos/proveedor.dto'
import type { InventoryLocation, TiendaId } from '@/shared/types'

export interface SearchProductsParams {
  tiendaId: TiendaId
  query?: string
  categoriaId?: string | null
  soloActivos?: boolean
}

export interface InitialStockInput {
  cantidad: number
  ubicacion: InventoryLocation
}

export interface ProductComponent {
  componenteId: string
  componenteNombre: string
  cantidad: number
}

/**
 * Opción de venta de un producto preparado (ADR 0017): el cajero elige una al
 * vender. `precioExtra` se suma al precio base y `componenteId` se descuenta
 * del inventario.
 */
export interface ProductOption {
  /** Ausente en las opciones nuevas que aún no se han guardado. */
  id?: string
  grupo: string
  nombre: string
  precioExtra: number
  componenteId: string | null
  componenteNombre: string
  componenteCantidad: number
  esDefault: boolean
}

/**
 * Contrato de persistencia de productos y categorías. Abstract class
 * (ADR 0015 §6.1). Reescrito desde el uso real (2026-07-17): la
 * implementación Angular maneja productos y categorías en una sola clase
 * (`ProductsRepository`), así que el contrato los une igual — dividirlos
 * exigiría primero dividir la implementación, fuera del alcance de PLAN-62.
 * La interfaz previa (`findById`/`findByBarcode`/`Result<T>`, split en
 * `ProductRepository` + `CategoriaRepository`) era aspiracional: esos
 * métodos nunca se implementaron.
 */
export abstract class ProductRepository {
  abstract listProducts(params: SearchProductsParams): Promise<Product[]>
  abstract listCategorias(tiendaId: TiendaId): Promise<Categoria[]>
  abstract listProveedores(tiendaId: TiendaId): Promise<Proveedor[]>
  abstract createProveedor(dto: CreateProveedorDto, tiendaId: TiendaId): Promise<Proveedor>
  abstract createProduct(dto: CreateProductDto, initialStock: InitialStockInput): Promise<Product>
  abstract updateProduct(id: string, tiendaId: TiendaId, dto: UpdateProductDto): Promise<Product>
  abstract deleteProduct(id: string, tiendaId: TiendaId): Promise<void>
  abstract deactivateProduct(id: string, tiendaId: TiendaId): Promise<void>
  abstract createCategoria(dto: CreateCategoriaDto, tiendaId: TiendaId): Promise<Categoria>
  abstract updateCategoria(id: string, tiendaId: TiendaId, dto: UpdateCategoriaDto): Promise<Categoria>
  abstract getComponents(productId: string, tiendaId: TiendaId): Promise<ProductComponent[]>
  abstract saveComponents(
    productId: string,
    tiendaId: TiendaId,
    components: { componenteId: string; cantidad: number }[],
  ): Promise<void>
  abstract getOptions(productId: string, tiendaId: TiendaId): Promise<ProductOption[]>
  abstract saveOptions(
    productId: string,
    tiendaId: TiendaId,
    options: ProductOption[],
  ): Promise<void>
  abstract deactivateCategoria(id: string, tiendaId: TiendaId): Promise<void>
}
