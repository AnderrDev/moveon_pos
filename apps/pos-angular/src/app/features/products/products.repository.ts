import { inject, Injectable } from '@angular/core'
import { SupabaseClientService } from '../../core/supabase/supabase-client.service'
import {
  rowToCategoria,
  rowToProduct,
  type CategoriaRow,
  type ProductRow,
} from '@/modules/products/infrastructure/mappers/product.mapper'
import type { Categoria, Product } from '@/modules/products/domain/entities/product.entity'
import type { CreateProductDto, UpdateProductDto } from '@/modules/products/application/dtos/product.dto'
import type { CreateCategoriaDto, UpdateCategoriaDto } from '@/modules/products/application/dtos/categoria.dto'

const PRODUCT_COLS =
  'id, tienda_id, nombre, sku, codigo_barras, categoria_id, tipo, unidad, precio_venta, costo, iva_tasa, stock_minimo, is_active, created_at, updated_at'
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

@Injectable({ providedIn: 'root' })
export class ProductsRepository {
  private readonly supabaseClient = inject(SupabaseClientService)

  async listProducts(params: SearchProductsParams): Promise<Product[]> {
    let query = this.supabaseClient.supabase
      .from('productos')
      .select(PRODUCT_COLS)
      .eq('tienda_id', params.tiendaId)

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

  async createProduct(dto: CreateProductDto): Promise<Product> {
    const client = this.supabaseClient.supabase as unknown as UntypedClient
    const { data, error } = await client
      .from('productos')
      .insert({
        tienda_id: dto.tiendaId,
        nombre: dto.nombre,
        sku: dto.sku ?? null,
        codigo_barras: dto.codigoBarras ?? null,
        categoria_id: dto.categoriaId ?? null,
        tipo: dto.tipo,
        unidad: dto.unidad,
        precio_venta: dto.precioVenta,
        costo: dto.costo ?? null,
        iva_tasa: dto.ivaTasa,
        stock_minimo: dto.stockMinimo,
        is_active: dto.isActive,
      })
      .select(PRODUCT_COLS)
      .single<ProductRow>()

    if (error) throw new Error(error.message)
    if (!data) throw new Error('Producto creado sin respuesta')
    return rowToProduct(data)
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
    if (dto.tipo !== undefined) patch['tipo'] = dto.tipo
    if (dto.unidad !== undefined) patch['unidad'] = dto.unidad
    if (dto.precioVenta !== undefined) patch['precio_venta'] = dto.precioVenta
    if (dto.costo !== undefined) patch['costo'] = dto.costo ?? null
    if (dto.ivaTasa !== undefined) patch['iva_tasa'] = dto.ivaTasa
    if (dto.stockMinimo !== undefined) patch['stock_minimo'] = dto.stockMinimo
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
    return rowToProduct(data)
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
