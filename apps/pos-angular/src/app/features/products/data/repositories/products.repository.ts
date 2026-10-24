import { inject, Injectable } from '@angular/core'
import { SupabaseClientService } from '@angular-app/core/supabase/supabase-client.service'
import { fetchAllPages } from '@angular-app/core/supabase/fetch-all-pages'
import { AuditLogRepository } from '@angular-app/features/audit/domain/repositories/audit-log.repository'
import {
  rowToCategoria,
  rowToProduct,
  rowToProveedor,
  type CategoriaRow,
  type ProductRow,
  type ProveedorRow,
} from '@angular-app/features/products/data/models/product.mapper'
import type { Categoria, Product, Proveedor } from '@angular-app/features/products/domain/entities/product.entity'
import type { CreateProductDto, UpdateProductDto } from '@angular-app/features/products/domain/dtos/product.dto'
import type { CreateCategoriaDto, UpdateCategoriaDto } from '@angular-app/features/products/domain/dtos/categoria.dto'
import type { CreateProveedorDto } from '@angular-app/features/products/domain/dtos/proveedor.dto'
import {
  ProductRepository as ProductRepositoryContract,
  type InitialStockInput,
  type ProductComponent,
  type ProductComponentLink,
  type ProductOption,
  type ProductOptionLink,
  type SearchProductsParams,
} from '@angular-app/features/products/domain/repositories/product.repository'
import {
  rowToProductComponent,
  buildComponentInsertRows,
  type ProductComponentRow,
} from '@angular-app/features/products/data/models/product-component.mapper'
import {
  rowToProductOption,
  buildOptionUpsertRows,
  type ProductOptionRow,
} from '@angular-app/features/products/data/models/product-option.mapper'

const PRODUCT_COLS =
  'id, tienda_id, nombre, sku, codigo_barras, categoria_id, proveedor_id, proveedores(nombre), para_que_sirve, recomendado_para, image_url, tipo, unidad, precio_venta, costo, iva_tasa, stock_minimo, participa_fidelizacion, is_active, deleted_at, created_at, updated_at'
/** Máximo de resultados de una búsqueda por término (no aplica al listado completo). */
const PRODUCT_SEARCH_LIMIT = 200
const CATEGORIA_COLS = 'id, tienda_id, nombre, orden, is_active, created_at, updated_at'
const PROVEEDOR_COLS = 'id, tienda_id, nombre, is_active, created_at, updated_at'

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
  }
}

interface ProductOptionsClient {
  from(table: 'product_options'): {
    select(cols: string): {
      eq(
        col: 'producto_id',
        value: string,
      ): {
        eq(
          col: 'tienda_id',
          value: string,
        ): {
          order(col: 'orden'): Promise<{
            data: ProductOptionRow[] | null
            error: { message: string } | null
          }>
        }
      }
    }
  }
}

@Injectable({ providedIn: 'root' })
export class ProductsRepository extends ProductRepositoryContract {
  private readonly supabaseClient = inject(SupabaseClientService)
  private readonly audit = inject(AuditLogRepository)

  /**
   * Sin término de búsqueda devuelve el catálogo COMPLETO (paginado): el POS,
   * inventario y reportes dependen de ver todos los productos. Antes un
   * `.limit(200)` fijo los cortaba en silencio. Con término, el tope de
   * `PRODUCT_SEARCH_LIMIT` es solo un límite de resultados de búsqueda.
   */
  async listProducts(params: SearchProductsParams): Promise<Product[]> {
    // Se eliminan los metacaracteres de la sintaxis de filtros de PostgREST
    // (, ( ) . ") para que el término no pueda inyectar condiciones extra.
    const term = params.query?.trim().replace(/[,()."\\]/g, ' ').trim() ?? ''

    // Cada página necesita un builder nuevo: los de supabase-js no se reutilizan.
    const buildQuery = () => {
      let query = this.supabaseClient.supabase
        .from('productos')
        .select(PRODUCT_COLS)
        .eq('tienda_id', params.tiendaId)
        .is('deleted_at', null)
      if (params.soloActivos) query = query.eq('is_active', true)
      if (params.categoriaId) query = query.eq('categoria_id', params.categoriaId)
      if (term) query = query.or(`nombre.ilike.%${term}%,sku.ilike.%${term}%,codigo_barras.eq.${term}`)
      return query.order('nombre', { ascending: true }).order('id', { ascending: true })
    }

    if (term) {
      const { data, error } = await buildQuery().limit(PRODUCT_SEARCH_LIMIT).returns<ProductRow[]>()
      if (error) throw new Error(error.message)
      return (data ?? []).map(rowToProduct)
    }

    const rows = await fetchAllPages<ProductRow>(async (from, to) => {
      const { data, error } = await buildQuery().range(from, to).returns<ProductRow[]>()
      if (error) throw new Error(error.message)
      return data ?? []
    })
    return rows.map(rowToProduct)
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

  async listProveedores(tiendaId: string): Promise<Proveedor[]> {
    const { data, error } = await this.supabaseClient.supabase
      .from('proveedores')
      .select(PROVEEDOR_COLS)
      .eq('tienda_id', tiendaId)
      .eq('is_active', true)
      .order('nombre', { ascending: true })
      .returns<ProveedorRow[]>()

    if (error) throw new Error(error.message)
    return (data ?? []).map(rowToProveedor)
  }

  async createProveedor(dto: CreateProveedorDto, tiendaId: string): Promise<Proveedor> {
    const client = this.supabaseClient.supabase as unknown as UntypedClient
    const { data, error } = await client
      .from('proveedores')
      .insert({ tienda_id: tiendaId, nombre: dto.nombre, is_active: true })
      .select(PROVEEDOR_COLS)
      .single<ProveedorRow>()
    if (error) throw new Error(error.message)
    if (!data) throw new Error('Proveedor creado sin respuesta')
    return rowToProveedor(data)
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
        p_proveedor_id: dto.proveedorId ?? null,
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
    if (dto.proveedorId !== undefined) patch['proveedor_id'] = dto.proveedorId ?? null
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

  async listComponentsByTienda(tiendaId: string): Promise<ProductComponentLink[]> {
    const rows = await fetchAllPages<ProductComponentRow & { producto_id: string }>(async (from, to) => {
      const { data, error } = await this.supabaseClient.supabase
        .from('product_components')
        .select('producto_id, componente_id, cantidad, productos!componente_id(nombre)')
        .eq('tienda_id', tiendaId)
        .order('producto_id', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to)
        .returns<(ProductComponentRow & { producto_id: string })[]>()
      if (error) throw new Error(error.message)
      return data ?? []
    })
    return rows.map((row) => ({ productoId: row.producto_id, ...rowToProductComponent(row) }))
  }

  /** Reemplazo atómico (save_product_components_atomic): nunca deja el producto sin receta a medias. */
  async saveComponents(
    productId: string,
    tiendaId: string,
    components: { componenteId: string; cantidad: number }[],
  ): Promise<void> {
    const rpc = this.supabaseClient.supabase as unknown as RpcClient
    const { error } = await rpc.rpc<number>('save_product_components_atomic', {
      p_producto_id: productId,
      p_tienda_id: tiendaId,
      p_components: buildComponentInsertRows(productId, tiendaId, components),
    })
    if (error) throw new Error(error.message)
  }

  async getOptions(productId: string, tiendaId: string): Promise<ProductOption[]> {
    const db = this.supabaseClient.supabase as unknown as ProductOptionsClient
    const { data, error } = await db
      .from('product_options')
      .select(
        'id, grupo, nombre, precio_extra, componente_id, componente_cantidad, es_default, orden, is_active, productos!componente_id(nombre)',
      )
      .eq('producto_id', productId)
      .eq('tienda_id', tiendaId)
      .order('orden')

    if (error) throw new Error(error.message)
    return (data ?? []).filter((row) => row.is_active).map(rowToProductOption)
  }

  async listActiveOptionsByTienda(tiendaId: string): Promise<ProductOptionLink[]> {
    const rows = await fetchAllPages<ProductOptionRow & { producto_id: string }>(async (from, to) => {
      const { data, error } = await this.supabaseClient.supabase
        .from('product_options')
        .select(
          'id, producto_id, grupo, nombre, precio_extra, componente_id, componente_cantidad, es_default, orden, is_active, productos!componente_id(nombre)',
        )
        .eq('tienda_id', tiendaId)
        .eq('is_active', true)
        .order('orden', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to)
        .returns<(ProductOptionRow & { producto_id: string })[]>()
      if (error) throw new Error(error.message)
      return data ?? []
    })
    return rows.map((row) => ({ ...rowToProductOption(row), id: row.id, productoId: row.producto_id }))
  }

  /**
   * Guarda las opciones por su clave natural (producto, grupo, nombre) en una
   * sola transacción (save_product_options_atomic): las existentes se
   * actualizan y las que el admin quitó se DESACTIVAN, nunca se borran —
   * `sale_items.option_id` de ventas pasadas apunta a esas filas (ADR 0017 §2.2).
   */
  async saveOptions(
    productId: string,
    tiendaId: string,
    options: ProductOption[],
  ): Promise<void> {
    const rpc = this.supabaseClient.supabase as unknown as RpcClient
    const { error } = await rpc.rpc<number>('save_product_options_atomic', {
      p_producto_id: productId,
      p_tienda_id: tiendaId,
      p_options: buildOptionUpsertRows(productId, tiendaId, options),
    })
    if (error) throw new Error(error.message)
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
