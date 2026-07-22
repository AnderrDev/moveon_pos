import { inject, Injectable } from '@angular/core'
import { SupabaseClientService } from '@angular-app/core/supabase/supabase-client.service'
import { AuditLogRepository } from '@angular-app/features/audit/domain/repositories/audit-log.repository'
import {
  rowToInventoryMovement,
  type InventoryMovementRow,
} from '@angular-app/features/inventory/data/models/inventory.mapper'
import type { InventoryMovement, StockLevel } from '@angular-app/features/inventory/domain/entities/inventory.entity'
import { isLowStock } from '@angular-app/features/inventory/domain/services/low-stock'
import {
  InventoryRepository as InventoryRepositoryContract,
  type AdjustStockInput,
  type RegisterEntryInput,
  type TransferStockInput,
} from '@angular-app/features/inventory/domain/repositories/inventory.repository'
import type { InventoryLocation, ProductType } from '@/shared/types'

const MOV_COLS =
  'id, tienda_id, producto_id, tipo, ubicacion, cantidad, costo_unitario, motivo, referencia_tipo, referencia_id, created_by, created_at'

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

@Injectable({ providedIn: 'root' })
export class InventoryRepository extends InventoryRepositoryContract {
  private readonly supabaseClient = inject(SupabaseClientService)
  private readonly audit = inject(AuditLogRepository)

  async getStock(
    productId: string,
    tiendaId: string,
    ubicacion: InventoryLocation = 'punto_venta',
  ): Promise<number> {
    const client = this.supabaseClient.supabase as unknown as RpcClient
    const { data, error } = await client.rpc<number>('get_stock', {
      p_producto_id: productId,
      p_tienda_id: tiendaId,
      p_ubicacion: ubicacion,
    })
    if (error) throw new Error(error.message)
    return Number(data ?? 0)
  }

  async getStockLevels(tiendaId: string): Promise<StockLevel[]> {
    const supabase = this.supabaseClient.supabase

    const { data: productos, error: pErr } = await supabase
      .from('productos')
      .select('id, tipo, stock_minimo')
      .eq('tienda_id', tiendaId)
      .eq('is_active', true)
      .returns<{ id: string; tipo: ProductType; stock_minimo: number }[]>()

    if (pErr) throw new Error(pErr.message)
    if (!productos || productos.length === 0) return []

    // Suma agregada en el servidor: sumar movimientos en el cliente rompía
    // al superar el límite de 1000 filas por consulta de PostgREST.
    const client = this.supabaseClient.supabase as unknown as RpcClient
    const { data: levels, error: mErr } = await client.rpc<
      { producto_id: string; punto_venta_stock: number; bodega_stock: number }[]
    >('get_stock_levels', { p_tienda_id: tiendaId })

    if (mErr) throw new Error(mErr.message)

    const stockMap: Record<string, { puntoVenta: number; bodega: number }> = {}
    for (const row of levels ?? []) {
      stockMap[row.producto_id] = {
        puntoVenta: Number(row.punto_venta_stock),
        bodega: Number(row.bodega_stock),
      }
    }

    return productos.map((p) => {
      const current = stockMap[p.id] ?? { puntoVenta: 0, bodega: 0 }
      const puntoVentaStock = current.puntoVenta
      const bodegaStock = current.bodega
      const totalStock = puntoVentaStock + bodegaStock
      const minimum = Number(p.stock_minimo)
      return {
        productId: p.id,
        tiendaId,
        puntoVentaStock,
        bodegaStock,
        totalStock,
        minimumStock: minimum,
        isLow: isLowStock({ tipo: p.tipo, currentStock: puntoVentaStock, minimumStock: minimum }),
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
        ubicacion: input.ubicacion,
        cantidad: input.cantidad,
        costo_unitario: input.costoUnitario ?? null,
        motivo: input.motivo ?? null,
        created_by: input.createdBy,
      })
      .select(MOV_COLS)
      .single<InventoryMovementRow>()

    if (error) throw new Error(error.message)
    if (!data) throw new Error('Movimiento creado sin respuesta')
    const movement = rowToInventoryMovement(data)
    void this.audit.log({
      tiendaId: input.tiendaId,
      entityType: 'movimiento_inventario',
      entityId: movement.id,
      entityLabel: input.productName ?? input.productId,
      action: 'entry',
      changes: { cantidad: input.cantidad, ubicacion: input.ubicacion, motivo: input.motivo ?? null },
    })
    return movement
  }

  async adjustStock(input: AdjustStockInput): Promise<InventoryMovement> {
    const client = this.supabaseClient.supabase as unknown as UntypedClient
    const { data, error } = await client
      .from('inventory_movements')
      .insert({
        tienda_id: input.tiendaId,
        producto_id: input.productId,
        tipo: 'adjustment',
        ubicacion: input.ubicacion,
        cantidad: input.cantidadDelta,
        motivo: input.motivo,
        created_by: input.createdBy,
      })
      .select(MOV_COLS)
      .single<InventoryMovementRow>()

    if (error) throw new Error(error.message)
    if (!data) throw new Error('Ajuste creado sin respuesta')
    const movement = rowToInventoryMovement(data)
    void this.audit.log({
      tiendaId: input.tiendaId,
      entityType: 'movimiento_inventario',
      entityId: movement.id,
      entityLabel: input.productName ?? input.productId,
      action: 'adjust',
      changes: { cantidadDelta: input.cantidadDelta, ubicacion: input.ubicacion, motivo: input.motivo },
    })
    return movement
  }

  async transferStock(input: TransferStockInput): Promise<string> {
    const client = this.supabaseClient.supabase as unknown as RpcClient
    const { data, error } = await client.rpc<string>('transfer_stock_atomic', {
      p_tienda_id: input.tiendaId,
      p_producto_id: input.productId,
      p_from_ubicacion: input.fromUbicacion,
      p_to_ubicacion: input.toUbicacion,
      p_cantidad: input.cantidad,
      p_motivo: input.motivo,
      p_created_by: input.createdBy,
    })
    if (error) throw new Error(error.message)
    if (!data) throw new Error('Traslado creado sin respuesta')
    void this.audit.log({
      tiendaId: input.tiendaId,
      entityType: 'movimiento_inventario',
      entityId: data,
      entityLabel: input.productName ?? input.productId,
      action: 'transfer',
      changes: { from: input.fromUbicacion, to: input.toUbicacion, cantidad: input.cantidad, motivo: input.motivo },
    })
    return data
  }
}
