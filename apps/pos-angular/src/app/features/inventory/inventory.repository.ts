import { inject, Injectable } from '@angular/core'
import { SupabaseClientService } from '../../core/supabase/supabase-client.service'
import {
  rowToInventoryMovement,
  type InventoryMovementRow,
} from '@/modules/inventory/infrastructure/mappers/inventory.mapper'
import type { InventoryMovement, StockLevel } from '@/modules/inventory/domain/entities/inventory.entity'

const MOV_COLS =
  'id, tienda_id, producto_id, tipo, cantidad, costo_unitario, motivo, referencia_tipo, referencia_id, created_by, created_at'

interface RpcClient {
  rpc<T>(
    fn: string,
    args: Record<string, unknown>,
  ): Promise<{ data: T | null; error: { message: string } | null }>
}

interface UntypedClient {
  from(table: string): {
    insert(values: Record<string, unknown>): {
      select(cols: string): {
        single<T>(): Promise<{ data: T | null; error: { message: string } | null }>
      }
    }
  }
}

export interface RegisterEntryInput {
  tiendaId: string
  productId: string
  cantidad: number
  costoUnitario?: number
  motivo?: string
  createdBy: string
}

export interface AdjustStockInput {
  tiendaId: string
  productId: string
  cantidadDelta: number
  motivo: string
  createdBy: string
}

@Injectable({ providedIn: 'root' })
export class InventoryRepository {
  private readonly supabaseClient = inject(SupabaseClientService)

  async getStock(productId: string, tiendaId: string): Promise<number> {
    const client = this.supabaseClient.supabase as unknown as RpcClient
    const { data, error } = await client.rpc<number>('get_stock', {
      p_producto_id: productId,
      p_tienda_id: tiendaId,
    })
    if (error) throw new Error(error.message)
    return Number(data ?? 0)
  }

  async getStockLevels(tiendaId: string): Promise<StockLevel[]> {
    const supabase = this.supabaseClient.supabase

    const { data: productos, error: pErr } = await supabase
      .from('productos')
      .select('id, stock_minimo')
      .eq('tienda_id', tiendaId)
      .eq('is_active', true)
      .returns<{ id: string; stock_minimo: number }[]>()

    if (pErr) throw new Error(pErr.message)
    if (!productos || productos.length === 0) return []

    const { data: movs, error: mErr } = await supabase
      .from('inventory_movements')
      .select('producto_id, cantidad')
      .eq('tienda_id', tiendaId)
      .returns<{ producto_id: string; cantidad: number }[]>()

    if (mErr) throw new Error(mErr.message)

    const stockMap: Record<string, number> = {}
    for (const m of movs ?? []) {
      stockMap[m.producto_id] = (stockMap[m.producto_id] ?? 0) + Number(m.cantidad)
    }

    return productos.map((p) => {
      const current = stockMap[p.id] ?? 0
      return {
        productId: p.id,
        tiendaId,
        currentStock: current,
        minimumStock: Number(p.stock_minimo),
        isLow: current <= Number(p.stock_minimo),
      }
    })
  }

  async getKardex(productId: string, tiendaId: string, limit = 100): Promise<InventoryMovement[]> {
    const { data, error } = await this.supabaseClient.supabase
      .from('inventory_movements')
      .select(MOV_COLS)
      .eq('producto_id', productId)
      .eq('tienda_id', tiendaId)
      .order('created_at', { ascending: false })
      .limit(limit)
      .returns<InventoryMovementRow[]>()

    if (error) throw new Error(error.message)
    return (data ?? []).map(rowToInventoryMovement)
  }

  async registerEntry(input: RegisterEntryInput): Promise<InventoryMovement> {
    const client = this.supabaseClient.supabase as unknown as UntypedClient
    const { data, error } = await client
      .from('inventory_movements')
      .insert({
        tienda_id: input.tiendaId,
        producto_id: input.productId,
        tipo: 'entry',
        cantidad: input.cantidad,
        costo_unitario: input.costoUnitario ?? null,
        motivo: input.motivo ?? null,
        created_by: input.createdBy,
      })
      .select(MOV_COLS)
      .single<InventoryMovementRow>()

    if (error) throw new Error(error.message)
    if (!data) throw new Error('Movimiento creado sin respuesta')
    return rowToInventoryMovement(data)
  }

  async adjustStock(input: AdjustStockInput): Promise<InventoryMovement> {
    const client = this.supabaseClient.supabase as unknown as UntypedClient
    const { data, error } = await client
      .from('inventory_movements')
      .insert({
        tienda_id: input.tiendaId,
        producto_id: input.productId,
        tipo: 'adjustment',
        cantidad: input.cantidadDelta,
        motivo: input.motivo,
        created_by: input.createdBy,
      })
      .select(MOV_COLS)
      .single<InventoryMovementRow>()

    if (error) throw new Error(error.message)
    if (!data) throw new Error('Ajuste creado sin respuesta')
    return rowToInventoryMovement(data)
  }
}
