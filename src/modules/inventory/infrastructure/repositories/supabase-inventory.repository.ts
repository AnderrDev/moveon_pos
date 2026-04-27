import { createClient } from '@/infrastructure/supabase/server'
import { ok, err } from '@/shared/result'
import type { Result } from '@/shared/result'
import type { TiendaId } from '@/shared/types'
import type { InventoryMovement, StockLevel } from '../../domain/entities/inventory.entity'
import type {
  InventoryRepository,
  RegisterEntryParams,
  AdjustStockParams,
} from '../../domain/repositories/inventory.repository'
import { rowToInventoryMovement, type InventoryMovementRow } from '../mappers/inventory.mapper'

// @supabase/ssr v0.5 no resuelve los tipos Insert a través de createServerClient.
/* eslint-disable @typescript-eslint/no-explicit-any */

const MOV_COLS = 'id, tienda_id, producto_id, tipo, cantidad, costo_unitario, motivo, referencia_tipo, referencia_id, created_by, created_at'

export class SupabaseInventoryRepository implements InventoryRepository {
  async getStock(productId: string, tiendaId: TiendaId): Promise<Result<number>> {
    const supabase = await createClient()
    const { data, error } = await (supabase as any)
      .rpc('get_stock', { p_producto_id: productId, p_tienda_id: tiendaId })

    if (error) return err(new Error(error.message))
    return ok(Number(data ?? 0))
  }

  async getStockLevels(tiendaId: TiendaId): Promise<Result<StockLevel[]>> {
    const supabase = await createClient()

    // Trae todos los productos activos con su stock calculado via función
    const { data: productos, error: pErr } = await supabase
      .from('productos')
      .select('id, stock_minimo')
      .eq('tienda_id', tiendaId)
      .eq('is_active', true)
      .returns<Array<{ id: string; stock_minimo: number }>>()

    if (pErr) return err(new Error(pErr.message))
    if (!productos || productos.length === 0) return ok([])

    // Agrega movimientos para calcular stock en una sola query
    const { data: movs, error: mErr } = await supabase
      .from('inventory_movements')
      .select('producto_id, cantidad')
      .eq('tienda_id', tiendaId)
      .returns<Array<{ producto_id: string; cantidad: number }>>()

    if (mErr) return err(new Error(mErr.message))

    const stockMap: Record<string, number> = {}
    for (const m of movs ?? []) {
      stockMap[m.producto_id] = (stockMap[m.producto_id] ?? 0) + Number(m.cantidad)
    }

    const levels: StockLevel[] = productos.map((p) => {
      const current = stockMap[p.id] ?? 0
      return {
        productId:    p.id,
        tiendaId,
        currentStock: current,
        minimumStock: Number(p.stock_minimo),
        isLow:        current <= Number(p.stock_minimo),
      }
    })

    return ok(levels)
  }

  async getKardex(
    productId: string,
    tiendaId: TiendaId,
    limit = 100,
  ): Promise<Result<InventoryMovement[]>> {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('inventory_movements')
      .select(MOV_COLS)
      .eq('producto_id', productId)
      .eq('tienda_id', tiendaId)
      .order('created_at', { ascending: false })
      .limit(limit)
      .returns<InventoryMovementRow[]>()

    if (error) return err(new Error(error.message))
    return ok((data ?? []).map(rowToInventoryMovement))
  }

  async registerEntry(params: RegisterEntryParams): Promise<Result<InventoryMovement>> {
    const supabase = await createClient()
    const { data, error } = await (supabase as any)
      .from('inventory_movements')
      .insert({
        tienda_id:      params.tiendaId,
        producto_id:    params.productId,
        tipo:           'entry',
        cantidad:       params.cantidad,
        costo_unitario: params.costoUnitario ?? null,
        motivo:         params.motivo ?? null,
        created_by:     params.createdBy,
      })
      .select(MOV_COLS)
      .single()

    if (error) return err(new Error(error.message))
    return ok(rowToInventoryMovement(data as InventoryMovementRow))
  }

  async adjustStock(params: AdjustStockParams): Promise<Result<InventoryMovement>> {
    const supabase = await createClient()
    const { data, error } = await (supabase as any)
      .from('inventory_movements')
      .insert({
        tienda_id:   params.tiendaId,
        producto_id: params.productId,
        tipo:        'adjustment',
        cantidad:    params.cantidadDelta,
        motivo:      params.motivo,
        created_by:  params.createdBy,
      })
      .select(MOV_COLS)
      .single()

    if (error) return err(new Error(error.message))
    return ok(rowToInventoryMovement(data as InventoryMovementRow))
  }
}
