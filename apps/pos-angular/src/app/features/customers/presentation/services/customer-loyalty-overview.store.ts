import { Injectable, inject, signal } from '@angular/core'
import type { Cliente } from '@angular-app/features/customers/domain/entities/cliente.entity'
import { TiendaInfoService } from '@angular-app/core/tienda/tienda-info.service'
import { DEFAULT_LOYALTY_CONFIG } from '@angular-app/features/loyalty/domain/loyalty-config'
import {
  LoyaltyRepository,
  type LoyaltyCustomerProgress,
} from '@angular-app/features/loyalty/domain/repositories/loyalty.repository'
import { selectFeaturedLoyaltyProgress } from '@angular-app/features/loyalty/domain/services/customer-progress'

export type LoyaltyOverviewState = 'loading' | 'ready' | 'error'

export interface FeaturedLoyaltyCustomer {
  cliente: Cliente
  progress: LoyaltyCustomerProgress
}

@Injectable()
export class CustomerLoyaltyOverviewStore {
  private readonly repository = inject(LoyaltyRepository)
  private readonly tiendaInfo = inject(TiendaInfoService)

  readonly state = signal<LoyaltyOverviewState>('loading')
  readonly stampsPerReward = signal(DEFAULT_LOYALTY_CONFIG.sellosParaRecompensa)
  private readonly progress = signal<ReadonlyMap<string, LoyaltyCustomerProgress>>(new Map())

  async load(tiendaId: string): Promise<void> {
    this.state.set('loading')
    try {
      const [info, progress] = await Promise.all([
        this.tiendaInfo.get(tiendaId),
        this.repository.listCustomerProgress(tiendaId),
      ])
      this.stampsPerReward.set(info.fidelizacion.sellosParaRecompensa)
      this.progress.set(new Map(progress.map((item) => [item.clienteId, item])))
      this.state.set('ready')
    } catch {
      this.state.set('error')
    }
  }

  progressFor(clienteId: string): LoyaltyCustomerProgress {
    return (
      this.progress().get(clienteId) ?? {
        clienteId,
        stampsBalance: 0,
        availableRewards: 0,
      }
    )
  }

  featured(clientes: readonly Cliente[]): FeaturedLoyaltyCustomer | null {
    if (this.state() !== 'ready') return null
    const progress = selectFeaturedLoyaltyProgress(
      clientes
        .filter((cliente) => cliente.autorizaFidelizacion)
        .map((cliente) => this.progressFor(cliente.id))
    )
    if (!progress) return null
    const cliente = clientes.find((candidate) => candidate.id === progress.clienteId)
    return cliente ? { cliente, progress } : null
  }
}
