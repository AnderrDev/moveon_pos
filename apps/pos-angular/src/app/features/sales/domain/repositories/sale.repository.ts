import type { Sale } from '@angular-app/features/sales/domain/entities/sale.entity'
import type { CreateSaleDto } from '@angular-app/features/sales/domain/dtos/sale.dto'

/** Venta validada lista para persistir; los canjes ya apuntan al índice de su línea. */
export interface CreateSaleRequest extends Omit<CreateSaleDto, 'loyaltyRedemptions'> {
  tiendaId: string
  cashierId: string
  loyaltyRedemptions: { rewardId: string; itemIndex: number }[]
}

/**
 * Contrato de persistencia de ventas. Abstract class (ADR 0015 §6.1).
 * Desde 2026-10-24 la creación también pasa por aquí (`create` →
 * `create_sale_atomic`, orquestada por el use-case `createSale`); antes
 * `PosSaleService` llamaba la RPC directo desde presentation.
 */
export abstract class SaleRepository {
  /**
   * Persiste la venta de forma atómica (ventas, ítems, pagos, inventario,
   * canjes) y devuelve su id. Idempotente por `idempotencyKey`. Lanza con el
   * mensaje crudo de la RPC (p. ej. 'Stock insuficiente').
   */
  abstract create(request: CreateSaleRequest): Promise<string>
  abstract findById(id: string, tiendaId: string): Promise<Sale | null>
  abstract listBySession(cashSessionId: string, tiendaId: string): Promise<Sale[]>
  abstract listByDate(tiendaId: string, start: Date, end: Date): Promise<Sale[]>
  abstract voidSale(saleId: string, tiendaId: string, reason: string): Promise<void>
  abstract correctPayment(
    paymentId: string,
    tiendaId: string,
    newMetodo: string,
    reason: string,
  ): Promise<void>
  /**
   * Asocia retroactivamente un cliente a una venta completada sin cliente
   * (se olvidó en el cobro). Solo funciona si la venta no tiene ya un
   * cliente asociado — reasignar de un cliente a otro no está soportado.
   */
  abstract correctSaleCustomer(
    saleId: string,
    tiendaId: string,
    clienteId: string,
    reason: string,
  ): Promise<void>
}
