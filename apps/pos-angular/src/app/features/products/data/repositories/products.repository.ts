import { inject, Injectable } from '@angular/core'
import { SupabaseClientService } from '@angular-app/core/supabase/supabase-client.service'
import { AuditLogRepository } from '@angular-app/features/audit/data/repositories/audit-log.repository'
import {
  rowToCategoria,
  rowToProduct,
  type CategoriaRow,
  type ProductRow,
} from '@angular-app/features/products/data/models/product.mapper'
import type { Categoria, Product } from '@angular-app/features/products/domain/entities/product.entity'
import type { CreateProductDto, UpdateProductDto } from '@angular-app/features/products/domain/dtos/product.dto'
import type { CreateCategoriaDto, UpdateCategoriaDto } from '@angular-app/features/products/domain/dtos/categoria.dto'
import type { InventoryLocation } from '@/shared/types'
import {
  rowToProductComponent,
  buildComponentInsertRows,
  type ProductComponentRow,
} from '@angular-app/features/products/presentation/services/product-component.helpers'

const PRODUCT_COLS =
  'id, tienda_id, nombre, sku, codigo_barras, categoria_id, proveedor, para_que_sirve, recomendado_para, image_url, tipo, unidad, precio_venta, costo, iva_tasa, stock_minimo, participa_fidelizacion, is_active, deleted_at, created_at, updated_at'
const CATEGORIA_COLS = 'id, tienda_id, nombre, orden, is_active, created_at, updated_at'

interface SearchProductsParams {
  tiendaId: string
  query?: string
  categoriaId?: string | null
  soloActivos?: boolean
}

interface UntypedClient {
  from(table: string): {
    insert(values: Record<string, unknown>): { select(cols: string): { single<T>(): Promise<{ data: T | null; error: { message: string } | null }> } }
    update(values: Record<string, unknown>): {
      eq(col: string, value: unknown): {
        eq(col: string, value: unknown): {
          select(cols: string): { single<T>(): Promise<{ data: T | null; error: { message: string } | null }> }
        }
      }
    }
  }
}

interface RpcClient {
  rpc<T>(
    fn: string,
    args: Record<string, unknown>,
  ): Promise<{ data: T | null; error: { message: string } | null }>
}

interface ProductComponentsClient {
  from(table: 'product_components'): {
    select(cols: string): {
      eq(col: 'producto_id', value: string): {
        eq(col: 'tienda_id', value: string): Promise<{
          data: ProductComponentRow[] | null
          error: { message: string } | null
        }>
      }
    }
    delete(): {
      eq(col: 'producto_id', value: string): {
        eq(col: 'tienda_id', value: string): Promise<{ error: { message: string } | null }>
      }
    }
    insert(values: Record<string, unknown>[]): Promise<{ error: { message: string } | null }>
  }
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

@Injectable({ providedIn: 'root' })
export class ProductsRepository {
  private readonly supabaseClient = inject(SupabaseClientService)
  private readonly audit = inject(AuditLogRepository)

  async listProducts(params: SearchProductsParams): Promise<Product[]> {
    let query = this.supabaseClient.supabase
      .from('productos')
      .select(PRODUCT_COLS)
      .eq('tienda_id', params.tiendaId)
      .is('deleted_at', null)

    if (params.soloActivos) query = query.eq('is_active', true)
    if (params.categoriaId) query = query.eq('categoria_id', params.categoriaId)
    if (params.query?.trim()) {
      const q = params.query.trim()
      query = query.or(`nombre.ilike.%${q}%,sku.ilike.%${q}%,codigo_barras.eq.${q}`)
    }

    const { data, error } = await query
      .order('nombre', { ascending: true })
      .limit(200)
      .returns<ProductRow[]>()

    if (error) throw new Error(error.message)
    return (data ?? []).map(rowToProduct)
  }

  async listCategorias(tiendaId: string): Promise<Categoria[]> {
    const { data, error } = await this.supabaseClient.supabase
      .from('categorias')
      .select(CATEGORIA_COLS)
      .eq('tienda_id', tiendaId)
      .order('orden', { ascending: true })
      .order('nombre', { ascending: true })
      .returns<CategoriaRow[]>()

    if (error) throw new Error(error.message)
    return (data ?? []).map(rowToCategoria)
  }

  async createProduct(dto: CreateProductDto, initialStock: InitialStockInput): Promise<Product> {
    const client = this.supabaseClient.supabase as unknown as RpcClient
    const { data: productId, error } = await client.rpc<string>(
      'create_product_with_initial_stock',
      {
        p_tienda_id: dto.tiendaId,
        p_nombre: dto.nombre,
        p_sku: dto.sku ?? null,
        p_codigo_barras: dto.codigoBarras ?? null,
        p_categoria_id: dto.categoriaId ?? null,
        p_proveedor: dto.proveedor ?? null,
        p_para_que_sirve: dto.paraQueSirve ?? null,
        p_recomendado_para: dto.recomendadoPara ?? null,
        p_image_url: dto.imageUrl ?? null,
        p_tipo: dto.tipo,
        p_unidad: dto.unidad,
        p_precio_venta: dto.precioVenta,
        p_costo: dto.costo ?? null,
        p_iva_tasa: dto.ivaTasa,
        p_stock_minimo: dto.stockMinimo,
        p_is_active: dto.isActive,
        p_initial_stock: initialStock.cantidad,
        p_initial_location: initialStock.ubicacion,
        p_participa_fidelizacion: dto.participaFidelizacion ?? false,
      },
    )

    if (error) throw new Error(error.message)
    if (!productId) throw new Error('Producto creado sin respuesta')

    const { data, error: readError } = await this.supabaseClient.supabase
      .from('productos')
      .select(PRODUCT_COLS)
      .eq('id', productId)
      .eq('tienda_id', dto.tiendaId)
      .single<ProductRow>()

    if (readError) throw new Error(readError.message)
    const product = rowToProduct(data)
    void this.audit.log({
      tiendaId: dto.tiendaId,
      entityType: 'producto',
      entityId: product.id,
      entityLabel: product.nombre,
      action: 'create',
      changes: { tipo: product.tipo, precioVenta: product.precioVenta, costo: product.costo, ivaTasa: product.ivaTasa },
    })
    return product
  }

  async updateProduct(
    id: string,
    tiendaId: string,
    dto: UpdateProductDto,
  ): Promise<Product> {
    const patch: Record<string, unknown> = {}
    if (dto.nombre !== undefined) patch['nombre'] = dto.nombre
    if (dto.sku !== undefined) patch['sku'] = dto.sku ?? null
    if (dto.codigoBarras !== undefined) patch['codigo_barras'] = dto.codigoBarras ?? null
    if (dto.categoriaId !== undefined) patch['categoria_id'] = dto.categoriaId ?? null
    if (dto.proveedor !== undefined) patch['proveedor'] = dto.proveedor ?? null
    if (dto.paraQueSirve !== undefined) patch['para_que_sirve'] = dto.paraQueSirve ?? null
    if (dto.recomendadoPara !== undefined) patch['recomendado_para'] = dto.recomendadoPara ?? null
    if (dto.imageUrl !== undefined) patch['image_url'] = dto.imageUrl ?? null
    if (dto.tipo !== undefined) patch['tipo'] = dto.tipo
    if (dto.unidad !== undefined) patch['unidad'] = dto.unidad
    if (dto.precioVenta !== undefined) patch['precio_venta'] = dto.precioVenta
    if (dto.costo !== undefined) patch['costo'] = dto.costo ?? null
    if (dto.ivaTasa !== undefined) patch['iva_tasa'] = dto.ivaTasa
    if (dto.stockMinimo !== undefined) patch['stock_minimo'] = dto.stockMinimo
    if (dto.participaFidelizacion !== undefined) patch['participa_fidelizacion'] = dto.participaFidelizacion
    if (dto.isActive !== undefined) patch['is_active'] = dto.isActive

    const client = this.supabaseClient.supabase as unknown as UntypedClient
    const { data, error } = await client
      .from('productos')
      .update(patch)
      .eq('id', id)
      .eq('tienda_id', tiendaId)
      .select(PRODUCT_COLS)
      .single<ProductRow>()

    if (error) throw new Error(error.message)
    if (!data) throw new Error('Producto actualizado sin respuesta')
    const product = rowToProduct(data)
    const auditChanges: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(dto)) if (v !== undefined) auditChanges[k] = v
    void this.audit.log({
      tiendaId,
      entityType: 'producto',
      entityId: id,
      entityLabel: product.nombre,
      action: 'update',
      changes: auditChanges,
    })
    return product
  }

  async deleteProduct(id: string, tiendaId: string): Promise<void> {
    const client = this.supabaseClient.supabase as unknown as UntypedClient
    const result = await client
      .from('productos')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('tienda_id', tiendaId)
      .select(PRODUCT_COLS)
      .single<ProductRow>()
    if (result.error) throw new Error(result.error.message)
    const label = result.data ? rowToProduct(result.data).nombre : id
    void this.audit.log({ tiendaId, entityType: 'producto', entityId: id, entityLabel: label, action: 'delete' })
  }

  async deactivateProduct(id: string, tiendaId: string): Promise<void> {
    const client = this.supabaseClient.supabase as unknown as UntypedClient
    const result = await client
      .from('productos')
      .update({ is_active: false })
      .eq('id', id)
      .eq('tienda_id', tiendaId)
      .select(PRODUCT_COLS)
      .single<ProductRow>()
    if (result.error) throw new Error(result.error.message)
    const label = result.data ? rowToProduct(result.data).nombre : id
    void this.audit.log({ tiendaId, entityType: 'producto', entityId: id, entityLabel: label, action: 'deactivate' })
  }

  async createCategoria(dto: CreateCategoriaDto, tiendaId: string): Promise<Categoria> {
    const client = this.supabaseClient.supabase as unknown as UntypedClient
    const { data, error } = await client
      .from('categorias')
      .insert({
        tienda_id: tiendaId,
        nombre: dto.nombre,
        orden: 0,
        is_active: true,
      })
      .select(CATEGORIA_COLS)
      .single<CategoriaRow>()
    if (error) throw new Error(error.message)
    if (!data) throw new Error('Categoria creada sin respuesta')
    return rowToCategoria(data)
  }

  async updateCategoria(
    id: string,
    tiendaId: string,
    dto: UpdateCategoriaDto,
  ): Promise<Categoria> {
    const client = this.supabaseClient.supabase as unknown as UntypedClient
    const { data, error } = await client
      .from('categorias')
      .update({ nombre: dto.nombre })
      .eq('id', id)
      .eq('tienda_id', tiendaId)
      .select(CATEGORIA_COLS)
      .single<CategoriaRow>()
    if (error) throw new Error(error.message)
    if (!data) throw new Error('Categoria actualizada sin respuesta')
    return rowToCategoria(data)
  }

  async getComponents(productId: string, tiendaId: string): Promise<ProductComponent[]> {
    const client = this.supabaseClient.supabase as unknown as ProductComponentsClient
    const { data, error } = await client
      .from('product_components')
      .select('componente_id, cantidad, productos!componente_id(nombre)')
      .eq('producto_id', productId)
      .eq('tienda_id', tiendaId)

    if (error) throw new Error(error.message)
    return (data ?? [] as ProductComponentRow[]).map(rowToProductComponent)
  }

  async saveComponents(
    productId: string,
    tiendaId: string,
    components: { componenteId: string; cantidad: number }[],
  ): Promise<void> {
    const db = this.supabaseClient.supabase as unknown as ProductComponentsClient

    const { error: delError } = await db
      .from('product_components')
      .delete()
      .eq('producto_id', productId)
      .eq('tienda_id', tiendaId)

    if (delError) throw new Error(delError.message)
    if (components.length === 0) return

    const { error: insError } = await db
      .from('product_components')
      .insert(buildComponentInsertRows(productId, tiendaId, components))

    if (insError) throw new Error(insError.message)
  }

  async deactivateCategoria(id: string, tiendaId: string): Promise<void> {
    const client = this.supabaseClient.supabase as unknown as UntypedClient
    const result = await client
      .from('categorias')
      .update({ is_active: false })
      .eq('id', id)
      .eq('tienda_id', tiendaId)
      .select(CATEGORIA_COLS)
      .single<CategoriaRow>()
    if (result.error) throw new Error(result.error.message)
  }
}
