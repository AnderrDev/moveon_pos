import { inject, Injectable } from '@angular/core'
import { SupabaseClientService } from '../../core/supabase/supabase-client.service'
import type { OpenCashSession, PosCategory, PosProduct } from './pos.types'
import type { IvaRate } from '@/shared/types'

interface ProductRow {
  id: string
  nombre: string
  sku: string | null
  codigo_barras: string | null
  precio_venta: number
  iva_tasa: number
  categoria_id: string | null
}

interface CategoryRow {
  id: string
  nombre: string
  is_active: boolean
}

interface CashSessionRow {
  id: string
  opening_amount: number
}

@Injectable({ providedIn: 'root' })
export class PosDataService {
  private readonly supabaseClient = inject(SupabaseClientService)

  async listProducts(): Promise<PosProduct[]> {
    const { data, error } = await this.supabaseClient.supabase
      .from('productos')
      .select('id, nombre, sku, codigo_barras, precio_venta, iva_tasa, categoria_id')
      .eq('is_active', true)
      .order('nombre', { ascending: true })
      .limit(200)
      .returns<ProductRow[]>()

    if (error) throw new Error(error.message)

    return (data ?? []).map((row) => ({
      id: row.id,
      nombre: row.nombre,
      sku: row.sku,
      codigoBarras: row.codigo_barras,
      precioVenta: row.precio_venta,
      ivaTasa: row.iva_tasa as IvaRate,
      categoriaId: row.categoria_id,
    }))
  }

  async listCategories(): Promise<PosCategory[]> {
    const { data, error } = await this.supabaseClient.supabase
      .from('categorias')
      .select('id, nombre, is_active')
      .eq('is_active', true)
      .order('nombre', { ascending: true })
      .returns<CategoryRow[]>()

    if (error) throw new Error(error.message)

    return (data ?? []).map((row) => ({
      id: row.id,
      nombre: row.nombre,
    }))
  }

  async getOpenCashSession(tiendaId: string): Promise<OpenCashSession | null> {
    const { data, error } = await this.supabaseClient.supabase
      .from('cash_sessions')
      .select('id, opening_amount')
      .eq('tienda_id', tiendaId)
      .eq('status', 'open')
      .maybeSingle()
      .returns<CashSessionRow>()

    if (error) throw new Error(error.message)
    if (!data) return null

    return {
      id: data.id,
      openingAmount: data.opening_amount,
    }
  }
}
