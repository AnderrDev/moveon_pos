import { inject, Injectable, signal } from '@angular/core'
import { SessionService } from '@angular-app/core/auth/session.service'
import { SupabaseClientService } from '@angular-app/core/supabase/supabase-client.service'
import { TiendaInfoService } from '@angular-app/core/tienda/tienda-info.service'
import { SaleRepository } from '@angular-app/features/sales/domain/repositories/sale.repository'
import type { EscPosReceiptCustomer } from '@angular-app/features/pos/data/datasources/esc-pos-receipt.builder'
import { QzReceiptPrinterService } from '@angular-app/features/pos/data/datasources/qz-receipt-printer.service'

interface PrintOptions {
  change?: number
  openCashDrawer?: boolean
}

interface ClienteRow {
  nombre: string
  tipo_documento: string | null
  numero_documento: string | null
}

@Injectable({ providedIn: 'root' })
export class ReceiptPrintService {
  private readonly salesRepo = inject(SaleRepository)
  private readonly tiendaInfo = inject(TiendaInfoService)
  private readonly session = inject(SessionService)
  private readonly supabase = inject(SupabaseClientService)
  private readonly qzPrinter = inject(QzReceiptPrinterService)

  readonly busy = signal(false)

  async printSale(saleId: string, options: PrintOptions = {}): Promise<void> {
    if (this.busy()) throw new Error('Ya hay una impresión en proceso. Espera a que termine.')
    this.busy.set(true)
    try {
      const auth = await this.session.getAuthContext()
      if (!auth) throw new Error('No autenticado')

      const [sale, tienda] = await Promise.all([
        this.salesRepo.findById(saleId, auth.tiendaId),
        this.tiendaInfo.get(auth.tiendaId),
      ])
      if (!sale) throw new Error('Venta no encontrada')

      const customer = await this.loadCliente(sale.clienteId)
      await this.qzPrinter.print(
        {
          sale,
          store: {
            titulo: tienda.receipt.titulo,
            nit: tienda.receipt.nit,
            direccion: tienda.receipt.direccion,
            ciudad: tienda.receipt.ciudad,
            telefono: tienda.receipt.telefono,
            mensajePie: tienda.receipt.mensajePie,
            mostrarNit: tienda.receipt.mostrarNit,
            mostrarDireccion: tienda.receipt.mostrarDireccion,
            mostrarTelefono: tienda.receipt.mostrarTelefono,
            mostrarIva: tienda.receipt.mostrarIva,
          },
          customer,
          cashierEmail: auth.email,
          change: options.change ?? sale.change,
        },
        tienda.receipt.printerName,
        { openCashDrawer: options.openCashDrawer },
      )
    } finally {
      this.busy.set(false)
    }
  }

  async openCashDrawer(): Promise<void> {
    if (this.busy()) throw new Error('Ya hay una operación de impresión en proceso.')
    this.busy.set(true)
    try {
      const auth = await this.session.getAuthContext()
      if (!auth) throw new Error('No autenticado')
      const tienda = await this.tiendaInfo.get(auth.tiendaId)
      await this.qzPrinter.openCashDrawer(tienda.receipt.printerName)
    } finally {
      this.busy.set(false)
    }
  }

  private async loadCliente(clienteId: string | null): Promise<EscPosReceiptCustomer | null> {
    if (!clienteId) return null
    const { data } = await this.supabase.supabase
      .from('clientes')
      .select('nombre, tipo_documento, numero_documento')
      .eq('id', clienteId)
      .maybeSingle<ClienteRow>()
    if (!data) return null
    return {
      nombre: data.nombre,
      tipoDocumento: data.tipo_documento,
      numeroDocumento: data.numero_documento,
    }
  }
}
