import { inject, Injectable } from '@angular/core'
import { SupabaseClientService } from '../../core/supabase/supabase-client.service'

export interface CatalogoProducto {
  id: string
  nombre: string
  tipo: string
  paraQueSirve: string | null
  imageUrl: string | null
  marca: string | null
  etiqueta: string | null
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

export interface CatalogoContactSettings {
  whatsappNumber: string
  whatsappDisplay: string
  instagramUrl: string
  instagramHandle: string
}

interface StorefrontContactSettingsRow {
  whatsapp_number: string
  whatsapp_display: string
  instagram_url: string
  instagram_handle: string
}

@Injectable({ providedIn: 'root' })
export class CatalogoService {
  private readonly db = inject(SupabaseClientService)

  async getCatalogo(): Promise<CatalogoCategoria[]> {
    const { data, error } = await this.db.supabase
      .from('storefront_productos_publicos')
      .select(
        'id, nombre, tipo, para_que_sirve, image_url, marca, etiqueta, categoria_id, categoria_nombre, categoria_orden',
      )
      .order('nombre', { ascending: true })

    if (error) throw new Error(error.message)

    interface ProductRow {
      id: string
      nombre: string
      tipo: string
      para_que_sirve: string | null
      image_url: string | null
      marca: string | null
      etiqueta: string | null
      categoria_id: string | null
      categoria_nombre: string | null
      categoria_orden: number | null
    }
    const rows: ProductRow[] = data ?? []

    const categoriaMap = new Map<string, CatalogoCategoria>()
    const sinCategoria: CatalogoProducto[] = []

    for (const row of rows) {
      const producto: CatalogoProducto = {
        id: row.id,
        nombre: row.nombre,
        tipo: row.tipo,
        paraQueSirve: row.para_que_sirve,
        imageUrl: row.image_url,
        marca: row.marca,
        etiqueta: row.etiqueta,
        categoriaId: row.categoria_id,
        categoriaNombre: row.categoria_nombre,
        categoriaOrden: row.categoria_orden ?? 999,
      }

      if (!row.categoria_id || !row.categoria_nombre) {
        sinCategoria.push(producto)
        continue
      }

      const catId = row.categoria_id
      if (!categoriaMap.has(catId)) {
        categoriaMap.set(catId, {
          id: catId,
          nombre: row.categoria_nombre,
          orden: row.categoria_orden ?? 999,
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

  async getContactSettings(): Promise<CatalogoContactSettings | null> {
    const { data, error } = await this.db.supabase
      .from('storefront_contact_settings')
      .select('whatsapp_number, whatsapp_display, instagram_url, instagram_handle')
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle<StorefrontContactSettingsRow>()

    if (error) throw new Error(error.message)
    if (!data) return null

    return {
      whatsappNumber: data.whatsapp_number,
      whatsappDisplay: data.whatsapp_display,
      instagramUrl: data.instagram_url,
      instagramHandle: data.instagram_handle,
    }
  }
}
