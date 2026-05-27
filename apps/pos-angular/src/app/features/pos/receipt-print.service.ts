import { inject, Injectable, signal } from '@angular/core'
import type { Sale } from '@/modules/sales/domain/entities/sale.entity'
import { SessionService } from '../../core/auth/session.service'
import { SupabaseClientService } from '../../core/supabase/supabase-client.service'
import {
  TiendaInfoService,
  type TiendaInfo,
} from '../../core/tienda/tienda-info.service'
import { SalesRepository } from '../sales/sales.repository'
import type { ReceiptCliente } from './receipt-ticket.component'

interface PrintOptions {
  change?: number
}

interface ClienteRow {
  nombre: string
  tipo_documento: string | null
  numero_documento: string | null
}

@Injectable({ providedIn: 'root' })
export class ReceiptPrintService {
  private readonly salesRepo = inject(SalesRepository)
  private readonly tiendaInfo = inject(TiendaInfoService)
  private readonly session = inject(SessionService)
  private readonly supabase = inject(SupabaseClientService)

  readonly sale = signal<Sale | null>(null)
  readonly tienda = signal<TiendaInfo | null>(null)
  readonly cliente = signal<ReceiptCliente | null>(null)
  readonly cashierEmail = signal<string | null>(null)
  readonly change = signal<number | null>(null)
  readonly visible = signal(false)
  readonly busy = signal(false)

  async printSale(saleId: string, options: PrintOptions = {}): Promise<void> {
    if (this.busy()) return
    this.busy.set(true)
    try {
      const auth = await this.session.getAuthContext()
      if (!auth) throw new Error('No autenticado')

      const [sale, tienda] = await Promise.all([
        this.salesRepo.findById(saleId, auth.tiendaId),
        this.tiendaInfo.get(auth.tiendaId),
      ])
      if (!sale) throw new Error('Venta no encontrada')

      const cliente = await this.loadCliente(sale.clienteId)

      this.sale.set(sale)
      this.tienda.set(tienda)
      this.cliente.set(cliente)
      this.cashierEmail.set(auth.email)
      this.change.set(options.change ?? null)
      this.visible.set(true)

      await this.waitForRender()
      this.openPrintDialog()
    } finally {
      this.busy.set(false)
    }
  }

  private async loadCliente(clienteId: string | null): Promise<ReceiptCliente | null> {
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

  private waitForRender(): Promise<void> {
    return new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    })
  }

  private openPrintDialog(): void {
    const cleanup = () => {
      document.body.classList.remove('printing-receipt')
      this.visible.set(false)
      this.sale.set(null)
      this.cliente.set(null)
      this.change.set(null)
      window.removeEventListener('afterprint', cleanup)
    }

    document.body.classList.add('printing-receipt')
    window.addEventListener('afterprint', cleanup, { once: true })
    window.print()
    setTimeout(() => {
      if (this.visible()) cleanup()
    }, 3000)
  }
}
