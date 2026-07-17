import { ChangeDetectionStrategy, Component, input } from '@angular/core'
import { StatCardComponent } from '../../shared/molecules/stat-card.component'
import { TableShellComponent } from '../../shared/molecules/table/table-shell.component'
import type { LoyaltyProgramReport } from '@/modules/loyalty/domain/services/program-report'

/** Tab "Fidelización" de /reportes (PLAN-60): KPIs del período + clientes activos. */
@Component({
  selector: 'mo-loyalty-report',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StatCardComponent, TableShellComponent],
  template: `
    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <mo-stat-card label="Sellos otorgados" [value]="'' + report().sellosOtorgados">
        @if (report().sellosRevertidos > 0) {
          <p class="text-muted-foreground text-xs">
            −{{ report().sellosRevertidos }} por anulaciones
          </p>
        }
        @if (report().ajusteNeto !== 0) {
          <p class="text-muted-foreground text-xs">
            Ajustes manuales: {{ report().ajusteNeto > 0 ? '+' : '' }}{{ report().ajusteNeto }}
          </p>
        }
      </mo-stat-card>
      <div class="border-primary/30 bg-primary/8 rounded-xl border p-5">
        <p class="text-xs font-semibold uppercase">Recompensas generadas</p>
        <p class="font-display mt-2 text-2xl font-bold tabular-nums">
          {{ report().recompensasGeneradas }}
        </p>
        <p class="text-muted-foreground text-xs">
          {{ report().recompensasDisponiblesAhora }} disponibles hoy
        </p>
      </div>
      <div class="rounded-xl border border-emerald-500/30 bg-emerald-500/8 p-5">
        <p class="text-xs font-semibold text-emerald-800 uppercase">Batidos canjeados</p>
        <p class="font-display mt-2 text-2xl font-bold tabular-nums">
          {{ report().recompensasCanjeadas }}
        </p>
        @if (report().recompensasVencidas > 0) {
          <p class="text-muted-foreground text-xs">
            {{ report().recompensasVencidas }}
            {{ report().recompensasVencidas === 1 ? 'venció' : 'vencieron' }} sin canjear
          </p>
        }
      </div>
      <mo-stat-card
        label="Clientes activos"
        [value]="'' + report().clientesActivos"
        hint="con movimientos en el período"
      />
    </div>

    @if (report().topClientes.length > 0) {
      <mo-table-shell>
        <div class="border-b px-4 py-3">
          <p class="font-display text-sm font-bold">Clientes del período</p>
          <p class="text-muted-foreground text-xs">Ordenados por sellos ganados</p>
        </div>
        <table class="w-full text-sm">
          <thead
            class="bg-muted/50 text-muted-foreground text-left text-xs tracking-wide uppercase"
          >
            <tr>
              <th class="px-4 py-2">Cliente</th>
              <th class="px-4 py-2 text-right">Sellos ganados</th>
              <th class="px-4 py-2 text-right">Recompensas desbloqueadas</th>
            </tr>
          </thead>
          <tbody class="divide-y">
            @for (c of report().topClientes; track c.clienteId) {
              <tr>
                <td class="px-4 py-2.5 font-semibold">{{ c.nombre }}</td>
                <td class="px-4 py-2.5 text-right tabular-nums">{{ c.sellosGanados }}</td>
                <td class="px-4 py-2.5 text-right tabular-nums">
                  {{ c.recompensasDesbloqueadas }}
                </td>
              </tr>
            }
          </tbody>
        </table>
      </mo-table-shell>
    } @else {
      <div class="text-muted-foreground rounded-xl border border-dashed p-8 text-center text-sm">
        Sin actividad de fidelización en el período. Los sellos aparecen cuando se venden
        batidos del club a clientes registrados.
      </div>
    }
  `,
  host: { class: 'flex flex-col gap-4' },
})
export class LoyaltyReportComponent {
  readonly report = input.required<LoyaltyProgramReport>()
}
