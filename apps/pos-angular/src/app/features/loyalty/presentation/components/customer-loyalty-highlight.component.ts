import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core'
import { Gift, LucideAngularModule, Medal } from 'lucide-angular'
import type { Cliente } from '@angular-app/features/customers/domain/entities/cliente.entity'
import type { LoyaltyCustomerProgress } from '@angular-app/features/loyalty/domain/repositories/loyalty.repository'
import { getStampsRemaining } from '@angular-app/features/loyalty/domain/services/customer-progress'

interface FeaturedLoyaltyCustomer {
  cliente: Cliente
  progress: LoyaltyCustomerProgress
}

@Component({
  selector: 'mo-customer-loyalty-highlight',
  standalone: true,
  imports: [LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="border-primary/20 bg-primary/5 mb-3 flex items-center gap-3 rounded-xl border px-4 py-3"
      role="status"
      aria-live="polite"
    >
      <span
        class="bg-primary text-primary-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
      >
        <lucide-angular
          [img]="item().progress.availableRewards > 0 ? giftIcon : medalIcon"
          class="h-4 w-4"
          aria-hidden="true"
        />
      </span>
      <div class="min-w-0">
        <p class="text-primary text-[10px] font-black tracking-[0.12em] uppercase">
          {{
            item().progress.availableRewards > 0
              ? 'Premio disponible'
              : 'Más cerca del próximo batido'
          }}
        </p>
        <p class="truncate text-sm">
          <strong>{{ item().cliente.nombre }}</strong>
          @if (item().progress.availableRewards > 0) {
            · {{ item().progress.availableRewards }}
            {{
              item().progress.availableRewards === 1
                ? 'batido gratis listo'
                : 'batidos gratis listos'
            }}
          } @else {
            · {{ item().progress.stampsBalance }}/{{ stampsPerReward() }} sellos ·
            {{ remaining() === 1 ? 'falta' : 'faltan' }} {{ remaining() }}
          }
        </p>
      </div>
    </div>
  `,
})
export class CustomerLoyaltyHighlightComponent {
  readonly item = input.required<FeaturedLoyaltyCustomer>()
  readonly stampsPerReward = input.required<number>()
  readonly remaining = computed(() =>
    getStampsRemaining(this.item().progress.stampsBalance, this.stampsPerReward())
  )
  readonly giftIcon = Gift
  readonly medalIcon = Medal
}
