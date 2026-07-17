import type { Product, Categoria } from '@angular-app/features/products/domain/entities/product.entity'
import type { CreateProductDto, UpdateProductDto } from '@angular-app/features/products/domain/dtos/product.dto'
import type { CreateCategoriaDto, UpdateCategoriaDto } from '@angular-app/features/products/domain/dtos/categoria.dto'
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
  abstract deactivateCategoria(id: string, tiendaId: TiendaId): Promise<void>
}
