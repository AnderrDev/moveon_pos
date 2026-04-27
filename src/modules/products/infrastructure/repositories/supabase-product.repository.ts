import { createClient } from '@/infrastructure/supabase/server'
import { ok, err } from '@/shared/result'
import type { Result } from '@/shared/result'
import type { TiendaId } from '@/shared/types'
import type { Product } from '../../domain/entities/product.entity'
import type { ProductRepository, SearchProductsParams } from '../../domain/repositories/product.repository'
import { rowToProduct, type ProductRow } from '../mappers/product.mapper'

// @supabase/ssr v0.5 no resuelve los tipos Insert/Update a través de createServerClient.
// Los datos están validados con Zod en la capa de aplicación; RLS garantiza seguridad en DB.
/* eslint-disable @typescript-eslint/no-explicit-any */

const SELECT_COLS =
  'id, tienda_id, nombre, sku, codigo_barras, categoria_id, tipo, unidad, precio_venta, costo, iva_tasa, stock_minimo, is_active, created_at, updated_at'

export class SupabaseProductRepository implements ProductRepository {
  async findById(id: string, tiendaId: TiendaId): Promise<Result<Product | null>> {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('productos')
      .select(SELECT_COLS)
      .eq('id', id)
      .eq('tienda_id', tiendaId)
      .maybeSingle()
      .returns<ProductRow>()

    if (error) return err(new Error(error.message))
    return ok(data ? rowToProduct(data) : null)
  }

  async findByBarcode(codigoBarras: string, tiendaId: TiendaId): Promise<Result<Product | null>> {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('productos')
      .select(SELECT_COLS)
      .eq('codigo_barras', codigoBarras)
      .eq('tienda_id', tiendaId)
      .eq('is_active', true)
      .maybeSingle()
      .returns<ProductRow>()

    if (error) return err(new Error(error.message))
    return ok(data ? rowToProduct(data) : null)
  }

  async search(params: SearchProductsParams): Promise<Result<Product[]>> {
    const supabase = await createClient()
    let query = supabase
      .from('productos')
      .select(SELECT_COLS)
      .eq('tienda_id', params.tiendaId)

    if (params.soloActivos) query = query.eq('is_active', true)
    if (params.categoriaId)  query = query.eq('categoria_id', params.categoriaId)

    if (params.query) {
      const q = params.query.trim()
      query = query.or(
        `nombre.ilike.%${q}%,sku.ilike.%${q}%,codigo_barras.eq.${q}`,
      )
    }

    const limit = params.limit ?? 50
    const offset = ((params.page ?? 1) - 1) * limit

    const { data, error } = await query
      .order('nombre', { ascending: true })
      .range(offset, offset + limit - 1)
      .returns<ProductRow[]>()

    if (error) return err(new Error(error.message))
    return ok((data ?? []).map(rowToProduct))
  }

  async create(
    product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Result<Product>> {
    const supabase = await createClient()
    const { data, error } = await (supabase as any)
      .from('productos')
      .insert({
        tienda_id:     product.tiendaId,
        nombre:        product.nombre,
        sku:           product.sku ?? null,
        codigo_barras: product.codigoBarras ?? null,
        categoria_id:  product.categoriaId ?? null,
        tipo:          product.tipo,
        unidad:        product.unidad,
        precio_venta:  product.precioVenta,
        costo:         product.costo ?? null,
        iva_tasa:      product.ivaTasa,
        stock_minimo:  product.stockMinimo,
        is_active:     product.isActive,
      })
      .select(SELECT_COLS)
      .single()

    if (error) return err(new Error(error.message))
    return ok(rowToProduct(data as ProductRow))
  }

  async update(
    id: string,
    tiendaId: TiendaId,
    data: Partial<Product>,
  ): Promise<Result<Product>> {
    const supabase = await createClient()
    const patch: Record<string, unknown> = {}
    if (data.nombre       !== undefined) patch.nombre        = data.nombre
    if (data.sku          !== undefined) patch.sku            = data.sku
    if (data.codigoBarras !== undefined) patch.codigo_barras  = data.codigoBarras
    if (data.categoriaId  !== undefined) patch.categoria_id   = data.categoriaId
    if (data.tipo         !== undefined) patch.tipo           = data.tipo
    if (data.unidad       !== undefined) patch.unidad         = data.unidad
    if (data.precioVenta  !== undefined) patch.precio_venta   = data.precioVenta
    if (data.costo        !== undefined) patch.costo          = data.costo
    if (data.ivaTasa      !== undefined) patch.iva_tasa       = data.ivaTasa
    if (data.stockMinimo  !== undefined) patch.stock_minimo   = data.stockMinimo
    if (data.isActive     !== undefined) patch.is_active      = data.isActive

    const { data: updated, error } = await (supabase as any)
      .from('productos')
      .update(patch)
      .eq('id', id)
      .eq('tienda_id', tiendaId)
      .select(SELECT_COLS)
      .single()

    if (error) return err(new Error(error.message))
    return ok(rowToProduct(updated as ProductRow))
  }

  async deactivate(id: string, tiendaId: TiendaId): Promise<Result<void>> {
    const supabase = await createClient()
    const { error } = await (supabase as any)
      .from('productos')
      .update({ is_active: false })
      .eq('id', id)
      .eq('tienda_id', tiendaId)

    if (error) return err(new Error(error.message))
    return ok(undefined)
  }
}
