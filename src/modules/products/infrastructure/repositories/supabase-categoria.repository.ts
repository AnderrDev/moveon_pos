import { createClient } from '@/infrastructure/supabase/server'
import { ok, err } from '@/shared/result'
import type { Result } from '@/shared/result'
import type { TiendaId } from '@/shared/types'
import type { Categoria } from '../../domain/entities/product.entity'
import type { CategoriaRepository } from '../../domain/repositories/product.repository'
import { rowToCategoria, type CategoriaRow } from '../mappers/product.mapper'

// @supabase/ssr v0.5 no resuelve los tipos Insert/Update a través de createServerClient.
/* eslint-disable @typescript-eslint/no-explicit-any */

const SELECT_COLS = 'id, tienda_id, nombre, orden, is_active, created_at, updated_at'

export class SupabaseCategoriaRepository implements CategoriaRepository {
  async findAll(tiendaId: TiendaId): Promise<Result<Categoria[]>> {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('categorias')
      .select(SELECT_COLS)
      .eq('tienda_id', tiendaId)
      .order('orden', { ascending: true })
      .order('nombre', { ascending: true })
      .returns<CategoriaRow[]>()

    if (error) return err(new Error(error.message))
    return ok((data ?? []).map(rowToCategoria))
  }

  async findById(id: string, tiendaId: TiendaId): Promise<Result<Categoria | null>> {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('categorias')
      .select(SELECT_COLS)
      .eq('id', id)
      .eq('tienda_id', tiendaId)
      .maybeSingle()
      .returns<CategoriaRow>()

    if (error) return err(new Error(error.message))
    return ok(data ? rowToCategoria(data) : null)
  }

  async create(
    data: Omit<Categoria, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Result<Categoria>> {
    const supabase = await createClient()
    const { data: inserted, error } = await (supabase as any)
      .from('categorias')
      .insert({
        tienda_id: data.tiendaId,
        nombre:    data.nombre,
        orden:     data.orden,
        is_active: data.isActive,
      })
      .select(SELECT_COLS)
      .single()

    if (error) return err(new Error(error.message))
    return ok(rowToCategoria(inserted as CategoriaRow))
  }

  async update(
    id: string,
    tiendaId: TiendaId,
    data: Partial<Categoria>,
  ): Promise<Result<Categoria>> {
    const supabase = await createClient()
    const patch: Record<string, unknown> = {}
    if (data.nombre    !== undefined) patch.nombre    = data.nombre
    if (data.orden     !== undefined) patch.orden     = data.orden
    if (data.isActive  !== undefined) patch.is_active = data.isActive

    const { data: updated, error } = await (supabase as any)
      .from('categorias')
      .update(patch)
      .eq('id', id)
      .eq('tienda_id', tiendaId)
      .select(SELECT_COLS)
      .single()

    if (error) return err(new Error(error.message))
    return ok(rowToCategoria(updated as CategoriaRow))
  }

  async deactivate(id: string, tiendaId: TiendaId): Promise<Result<void>> {
    const supabase = await createClient()
    const { error } = await (supabase as any)
      .from('categorias')
      .update({ is_active: false })
      .eq('id', id)
      .eq('tienda_id', tiendaId)

    if (error) return err(new Error(error.message))
    return ok(undefined)
  }
}
