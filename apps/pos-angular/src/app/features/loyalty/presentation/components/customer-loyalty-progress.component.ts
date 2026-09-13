import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core'
import { Gift, LucideAngularModule } from 'lucide-angular'
import { BadgeComponent } from '@angular-app/shared/atoms/badge.component'
import { SkeletonComponent } from '@angular-app/shared/atoms/skeleton.component'
import type { LoyaltyCustomerProgress } from '@angular-app/features/loyalty/domain/repositories/loyalty.repository'
import { getStampsRemaining } from '@angular-app/features/loyalty/domain/services/customer-progress'

type LoyaltyOverviewState = 'loading' | 'ready' | 'error'

@Component({
  selector: 'mo-customer-loyalty-progress',
  standalone: true,
  imports: [BadgeComponent, SkeletonComponent, LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!participates()) {
      <span
        class="text-muted-foreground"
        [class.text-xs]="!compact()"
        [class.text-[10px]]="compact()"
      >
        No participa
      </span>
    } @else if (state() === 'loading') {
      <mo-skeleton variant="line" [class]="compact() ? 'block w-20' : 'block w-28'" />
    } @else if (state() === 'error') {
      <span
        class="text-muted-foreground"
        [class.text-xs]="!compact()"
        [class.text-[10px]]="compact()"
      >
        {{ compact() ? 'Club no disponible' : 'No disponible' }}
      </span>
    } @else if (progress().availableRewards > 0) {
      @if (compact()) {
        <span class="text-[10px] font-black text-emerald-700">
          Premio listo · {{ progress().stampsBalance }}/{{ stampsPerReward() }}
        </span>
      } @else {
        <div class="space-y-1">
          <mo-badge variant="success">
            <lucide-angular [img]="giftIcon" class="h-3 w-3" aria-hidden="true" />
            Premio listo
          </mo-badge>
          <p class="text-muted-foreground text-[10px]">
            {{ progress().stampsBalance }}/{{ stampsPerReward() }} hacia el siguiente
          </p>
        </div>
      }
    } @else if (compact()) {
      <span class="text-primary text-[10px] font-black tabular-nums">
        {{ progress().stampsBalance }}/{{ stampsPerReward() }} · faltan {{ remaining() }}
      </span>
    } @else {
      <div class="w-32 space-y-1.5">
        <div class="flex items-center justify-between gap-2 text-[10px]">
          <span class="font-black tabular-nums">
            {{ progress().stampsBalance }}/{{ stampsPerReward() }}
          </span>
          <span class="text-muted-foreground">Faltan {{ remaining() }}</span>
        </div>
        <div
          class="bg-muted h-1.5 overflow-hidden rounded-full"
          role="progressbar"
          [attr.aria-label]="'Progreso de ' + customerName()"
          [attr.aria-valuemin]="0"
          [attr.aria-valuemax]="stampsPerReward()"
          [attr.aria-valuenow]="progress().stampsBalance"
        >
          <span
            class="bg-primary block h-full rounded-full transition-[width] duration-300"
            [style.width.%]="percent()"
          ></span>
        </div>
      </div>
    }
  `,
})
export class CustomerLoyaltyProgressComponent {
  readonly participates = input.required<boolean>()
  readonly state = input.required<LoyaltyOverviewState>()
  readonly progress = input.required<LoyaltyCustomerProgress>()
  readonly stampsPerReward = input.required<number>()
  readonly customerName = input.required<string>()
  readonly compact = input(false)
  readonly remaining = computed(() =>
    getStampsRemaining(this.progress().stampsBalance, this.stampsPerReward())
  )
  readonly percent = computed(() =>
    Math.min(100, (this.progress().stampsBalance / this.stampsPerReward()) * 100)
  )
  readonly giftIcon = Gift
}
