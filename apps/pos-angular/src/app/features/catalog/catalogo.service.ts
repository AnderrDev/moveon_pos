import { inject, Injectable } from '@angular/core'
import { SupabaseClientService } from '../../core/supabase/supabase-client.service'

export interface CatalogoProducto {
  id: string
  nombre: string
  precioVenta: number
  tipo: string
  paraQueSirve: string | null
  imageUrl: string | null
  categoriaId: string | null
  categoriaNombre: string | null
  categoriaOrden: number
}

export interface CatalogoCategoria {
  id: string
  nombre: string
  orden: number
  productos: CatalogoProducto[]
}

export interface ComboSemana {
  id: string
  nombre: string
  descripcion: string | null
  precio: number
  precioOriginal: number | null
  etiqueta: string | null
  items: string[]
}

@Injectable({ providedIn: 'root' })
export class CatalogoService {
  private readonly db = inject(SupabaseClientService)

  async getCatalogo(): Promise<CatalogoCategoria[]> {
    const db = this.db.supabase as any
    const { data, error } = await db
      .from('productos')
      .select(
        'id, nombre, precio_venta, tipo, para_que_sirve, image_url, categoria_id, categorias(id, nombre, orden)',
      )
      .eq('is_active', true)
      .is('deleted_at', null)
      .neq('tipo', 'ingredient')
      .order('nombre', { ascending: true })

    if (error) throw new Error(error.message)

    interface ProductRow {
      id: string
      nombre: string
      precio_venta: number
      tipo: string
      para_que_sirve: string | null
      image_url: string | null
      categoria_id: string | null
      categorias: { id: string; nombre: string; orden: number } | null
    }
    const rows: ProductRow[] = data ?? []

    const categoriaMap = new Map<string, CatalogoCategoria>()
    const sinCategoria: CatalogoProducto[] = []

    for (const row of rows) {
      const producto: CatalogoProducto = {
        id: row.id,
        nombre: row.nombre,
        precioVenta: row.precio_venta,
        tipo: row.tipo,
        paraQueSirve: row.para_que_sirve,
        imageUrl: row.image_url,
        categoriaId: row.categoria_id,
        categoriaNombre: row.categorias?.nombre ?? null,
        categoriaOrden: row.categorias?.orden ?? 999,
      }

      if (!row.categorias) {
        sinCategoria.push(producto)
        continue
      }

      const catId = row.categorias.id
      if (!categoriaMap.has(catId)) {
        categoriaMap.set(catId, {
          id: catId,
          nombre: row.categorias.nombre,
          orden: row.categorias.orden,
          productos: [],
        })
      }
      categoriaMap.get(catId)!.productos.push(producto)
    }

    const categorias = Array.from(categoriaMap.values()).sort((a, b) => a.orden - b.orden)

    if (sinCategoria.length > 0) {
      categorias.push({ id: 'sin-categoria', nombre: 'Otros', orden: 999, productos: sinCategoria })
    }

    return categorias
  }

  async getCombos(tiendaId?: string): Promise<ComboSemana[]> {
    const db = this.db.supabase as any
    let query = db
      .from('combos_semana')
      .select('id, nombre, descripcion, precio, precio_original, etiqueta, items')
      .eq('is_active', true)
      .order('orden', { ascending: true })

    if (tiendaId) query = query.eq('tienda_id', tiendaId)

    const { data, error } = await query

    if (error) throw new Error(error.message)

    return (data ?? []).map((row: any) => ({
      id: row.id,
      nombre: row.nombre,
      descripcion: row.descripcion,
      precio: row.precio,
      precioOriginal: row.precio_original,
      etiqueta: row.etiqueta,
      items: row.items ?? [],
    }))
  }
}
