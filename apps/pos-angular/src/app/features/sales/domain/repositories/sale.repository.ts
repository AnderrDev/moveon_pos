import type { Sale } from '@angular-app/features/sales/domain/entities/sale.entity'

/**
 * Contrato de persistencia de ventas. Abstract class (ADR 0015 §6.1).
 * Reescrito desde el uso real (2026-07-17): la creación de venta NO pasa por
 * este repositorio — usa la RPC transaccional `create_sale_atomic` directo
 * desde `PosSaleService` (ver `docs/modules/sales.md`), así que no hay
 * método `create` aquí. La interfaz previa lo declaraba sin implementación
 * real, y usaba `Result<T>`/`void()` (nombre reservado) que no coincidían
 * con la implementación (`voidSale`, `throw`).
 */
export abstract class SaleRepository {
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
