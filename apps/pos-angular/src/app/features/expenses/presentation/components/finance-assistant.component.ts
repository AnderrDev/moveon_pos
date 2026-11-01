import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core'
import { ButtonComponent } from '@angular-app/shared/atoms/button.component'
import { BadgeComponent } from '@angular-app/shared/atoms/badge.component'
import { StatCardComponent } from '@angular-app/shared/molecules/stat-card.component'
import { ShareBarChartComponent, type ShareSegment } from '@angular-app/shared/molecules/charts/share-bar-chart.component'
import { LowerCasePipe } from '@angular/common'
import { MoneyPipe } from '@angular-app/shared/pipes/money.pipe'
import { LocalDatePipe } from '@angular-app/shared/pipes/local-date.pipe'
import { formatCurrency } from '@/shared/lib/format'
import type { Envelope, EnvelopeKey, MoneyEnvelopes } from '@angular-app/features/expenses/domain/services/money-envelopes'
import type { FinanceAdvice, FinanceAdviceResult, InventoryLevel } from '@angular-app/features/expenses/domain/services/finance-advice'
import type { OwnerWithdrawal } from '@angular-app/features/expenses/domain/entities/expense.entity'

const ENVELOPE_LABEL: Record<EnvelopeKey, string> = {
  mercancia: 'Mercancía',
  fijos: 'Arriendo y nómina',
  diaADia: 'Día a día',
  utilidad: 'Utilidad',
}

const ENVELOPE_HINT: Record<EnvelopeKey, string> = {
  mercancia: 'Lo que costó lo vendido: es para volver a surtir',
  fijos: 'Se aparta día a día para pagarlos a tiempo',
  diaADia: 'Hielo, insumos, transporte… lo que ya se gastó',
  utilidad: 'Lo que sobra: de aquí salen tus retiros',
}

const LEVEL_BADGE: Record<InventoryLevel, 'success' | 'warning' | 'destructive' | 'default'> = {
  verde: 'success',
  ambar: 'warning',
  rojo: 'destructive',
  sin_datos: 'default',
}

/**
 * "Tu plata este mes" (ADR 0025): las tres frases del asistente, el semáforo
 * de inventario, a dónde va lo que vendiste y los retiros del mes.
 * Presentacional — los consejos llegan tipados del dominio y aquí se vuelven frases.
 */
@Component({
  selector: 'mo-finance-assistant',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, BadgeComponent, StatCardComponent, ShareBarChartComponent, MoneyPipe, LocalDatePipe, LowerCasePipe],
  template: `
    <div class="bg-card rounded-xl border p-4 sm:p-5">
      <div class="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 class="text-sm font-semibold">Tu plata este mes</h3>
          <p class="text-muted-foreground mt-1 text-xs">
            Cada peso que entra se reparte en cuatro sobres: mercancía, arriendo y nómina, día a día y utilidad.
          </p>
        </div>
        <div class="flex gap-2">
          @if (envelopes()) {
            <mo-button size="sm" (click)="withdrawRequested.emit()">Registrar retiro</mo-button>
          }
          <mo-button variant="outline" size="sm" (click)="configureRequested.emit()">
            {{ envelopes() ? 'Editar sobres' : 'Configurar sobres' }}
          </mo-button>
        </div>
      </div>

      @if (!envelopes() || !advice()) {
        <p class="text-muted-foreground mt-3 text-sm">
          Configura los sobres con la fecha desde la que quieres llevar las cuentas (por ejemplo el 1 de
          noviembre). Desde ahí el asistente te dirá cuánto puedes comprar y cuánto puedes retirar.
        </p>
      } @else {
        <div class="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <mo-stat-card
            [label]="comprar().label"
            [value]="comprar().value"
            [hint]="comprar().hint"
            [tone]="comprar().tone"
          />
          <mo-stat-card
            [label]="retirar().label"
            [value]="retirar().value"
            [hint]="retirar().hint"
            [tone]="retirar().tone"
          />
          <mo-stat-card
            [label]="fijos().label"
            [value]="fijos().value"
            [hint]="fijos().hint"
            [tone]="fijos().tone"
          />
        </div>

        <div class="mt-4 flex flex-wrap items-center gap-2 text-sm">
          <mo-badge [variant]="inventoryBadge()">{{ inventoryTitle() }}</mo-badge>
          <span>{{ inventoryText() }}</span>
          @if (advice()!.inventario.nivel !== 'sin_datos' && advice()!.inventario.nivel !== 'verde') {
            <button type="button" class="text-primary text-xs font-semibold underline" (click)="purchaseListRequested.emit()">
              Ver lista de compras
            </button>
          }
        </div>

        @for (aviso of avisos(); track aviso) {
          <p class="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{{ aviso }}</p>
        }

        @if (envelopes()!.entradasMes > 0) {
          <div class="mt-4">
            <p class="text-muted-foreground mb-2 text-xs">A dónde va lo que vendiste en {{ monthLabel() | lowercase }}</p>
            <mo-share-bar-chart [segments]="segments()" ariaLabel="Reparto de lo vendido en el mes" />
          </div>
        } @else {
          <p class="text-muted-foreground mt-3 text-sm">Todavía no hay ventas este mes.</p>
        }

        <details class="mt-4 text-xs">
          <summary class="text-muted-foreground hover:text-foreground cursor-pointer select-none">
            Ver las cuentas de cada sobre (desde el {{ fechaInicioLabel() }})
          </summary>
          <div class="mt-2 overflow-x-auto">
            <table class="w-full text-left text-xs">
              <thead class="text-muted-foreground">
                <tr>
                  <th class="py-1 pr-2 font-medium">Sobre</th>
                  <th class="py-1 pr-2 text-right font-medium">Arrancó con</th>
                  <th class="py-1 pr-2 text-right font-medium">+ Apartado</th>
                  <th class="py-1 pr-2 text-right font-medium">− Usado</th>
                  <th class="py-1 text-right font-medium">= Queda</th>
                </tr>
              </thead>
              <tbody>
                @for (row of rows(); track row.key) {
                  <tr class="border-t">
                    <td class="py-1.5 pr-2">
                      <p class="font-semibold">{{ row.label }}</p>
                      <p class="text-muted-foreground">{{ row.hint }}</p>
                    </td>
                    <td class="py-1.5 pr-2 text-right tabular-nums">{{ (row.saldoInicial | money) }}</td>
                    <td class="py-1.5 pr-2 text-right tabular-nums">{{ (row.apartadoAcumulado | money) }}</td>
                    <td class="py-1.5 pr-2 text-right tabular-nums">{{ (row.usadoAcumulado | money) }}</td>
                    <td
                      class="py-1.5 text-right font-semibold tabular-nums"
                      [class.text-emerald-600]="row.disponible > 0"
                      [class.text-amber-700]="row.disponible < 0"
                    >
                      {{ (row.disponible | money) }}
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <p class="text-muted-foreground mt-2">
            Mercancía usada = compras de mercancía (entradas con costo). Arriendo y nómina usados = esos pagos
            registrados. Utilidad usada = tus retiros. Las compras no restan de la ganancia: su costo se descuenta cuando vendes.
          </p>
        </details>

        <div class="mt-4 border-t pt-3">
          <h4 class="text-xs font-semibold">Retiros de {{ monthLabel() | lowercase }}</h4>
          @if (withdrawals().length === 0) {
            <p class="text-muted-foreground mt-1 text-xs">
              Sin retiros registrados este mes. Si te llevaste plata, regístrala para que el sobre de utilidad cuadre.
            </p>
          } @else {
            <ul class="mt-1 divide-y text-sm">
              @for (w of withdrawals(); track w.id) {
                <li class="flex items-center justify-between gap-3 py-1.5" [class.opacity-60]="w.status === 'voided'">
                  <div class="min-w-0">
                    <p class="truncate">
                      <span class="font-medium">{{ (w.monto | money) }}</span>
                      <span class="text-muted-foreground"> · {{ w.origen === 'caja' ? 'de la caja' : 'del banco' }} · {{ w.fecha | localDate }}</span>
                    </p>
                    @if (w.nota) {
                      <p class="text-muted-foreground truncate text-xs">{{ w.nota }}</p>
                    }
                    @if (w.status === 'voided') {
                      <p class="text-muted-foreground text-xs">Anulado: {{ w.voidedReason }}</p>
                    }
                  </div>
                  @if (w.status === 'active') {
                    <mo-button variant="ghost" size="sm" (click)="voidWithdrawalRequested.emit(w)">Anular</mo-button>
                  }
                </li>
              }
            </ul>
          }
        </div>
      }
    </div>
  `,
})
export class FinanceAssistantComponent {
  readonly envelopes = input.required<MoneyEnvelopes | null>()
  readonly advice = input.required<FinanceAdviceResult | null>()
  readonly withdrawals = input<OwnerWithdrawal[]>([])
  /** "noviembre de 2026" */
  readonly monthLabel = input('este mes')
  /** `YYYY-MM-DD`; `null` sin configurar. */
  readonly fechaInicio = input<string | null>(null)

  readonly configureRequested = output<void>()
  readonly withdrawRequested = output<void>()
  readonly voidWithdrawalRequested = output<OwnerWithdrawal>()
  readonly purchaseListRequested = output<void>()

  private find<C extends FinanceAdvice['code']>(code: C): Extract<FinanceAdvice, { code: C }> | undefined {
    return this.advice()?.consejos.find((c): c is Extract<FinanceAdvice, { code: C }> => c.code === code)
  }

  readonly comprar = computed(() => {
    const ok = this.find('comprar')
    if (ok) {
      return {
        label: 'Puedes comprar hasta',
        value: formatCurrency(ok.disponible),
        hint: 'Mercancía: lo vendido al costo menos lo que ya compraste',
        tone: ok.disponible > 0 ? ('success' as const) : ('default' as const),
      }
    }
    const exceso = this.find('comprar_exceso')
    return {
      label: 'Compraste de más',
      value: formatCurrency(exceso?.exceso ?? 0),
      hint: 'Más mercancía que lo vendido al costo: no compres hasta recuperarlo',
      tone: 'warning' as const,
    }
  })

  readonly retirar = computed(() => {
    const ok = this.find('retirar')
    if (ok) {
      return {
        label: 'Puedes retirar hasta',
        value: formatCurrency(ok.disponible),
        hint: 'Utilidad que sobra después de mercancía, fijos y gastos',
        tone: ok.disponible > 0 ? ('success' as const) : ('default' as const),
      }
    }
    const sinUtilidad = this.find('sin_utilidad')
    if (sinUtilidad) {
      return {
        label: 'Aún no hay utilidad',
        value: formatCurrency(sinUtilidad.faltante),
        hint: 'Lo vendido todavía no cubre lo apartado para arriendo y nómina: falta esto para empezar a retirar',
        tone: 'default' as const,
      }
    }
    const exceso = this.find('retirar_exceso')
    return {
      label: 'Retiraste de más',
      value: formatCurrency(exceso?.exceso ?? 0),
      hint: 'Esa plata era de mercancía o del arriendo: no retires hasta recuperarla',
      tone: 'warning' as const,
    }
  })

  readonly fijos = computed(() => {
    const f = this.find('guardar_fijos')
    if (!f) {
      return {
        label: 'Arriendo y nómina',
        value: '—',
        hint: 'Configura una plantilla de arriendo y los empleados para apartarlos',
        tone: 'warning' as const,
      }
    }
    return {
      label: f.disponible >= 0 ? 'Guardado para arriendo y nómina' : 'Faltó apartar para fijos',
      value: formatCurrency(Math.abs(f.disponible)),
      hint: `Apartado ${formatCurrency(f.apartado)} · pagado ${formatCurrency(f.pagado)}`,
      tone: f.disponible < 0 ? ('warning' as const) : ('default' as const),
    }
  })

  readonly inventoryBadge = computed(() => LEVEL_BADGE[this.advice()?.inventario.nivel ?? 'sin_datos'])

  readonly inventoryTitle = computed(() => {
    switch (this.advice()?.inventario.nivel) {
      case 'verde':
        return 'Inventario al día'
      case 'ambar':
        return 'Inventario alto'
      case 'rojo':
        return 'Inventario de sobra'
      default:
        return 'Inventario'
    }
  })

  readonly inventoryText = computed(() => {
    const inv = this.advice()?.inventario
    if (!inv) return ''
    if (inv.nivel === 'sin_datos') return 'Aún no hay ventas suficientes para medir cuántos días de mercancía tienes.'
    const base = `Tienes mercancía para ${inv.dias} días de venta (meta ${inv.metaDias}).`
    if (inv.nivel === 'verde') return `${base} Repón lo que vendes.`
    if (inv.nivel === 'ambar') return `${base} Compra solo lo que la lista de compras marque como faltante.`
    return `${base} Este mes no compres: deja que el sobre de mercancía acumule.`
  })

  readonly avisos = computed<string[]>(() => {
    const out: string[] = []
    for (const c of this.advice()?.consejos ?? []) {
      if (c.code === 'sin_fijos') {
        out.push('No hay fijos configurados: crea la plantilla del arriendo en "Gastos del mes" y registra a tus empleados con su salario.')
      } else if (c.code === 'ventas_sin_costo') {
        out.push(`${c.lineas} ${c.lineas === 1 ? 'línea vendida' : 'líneas vendidas'} sin costo del producto: el sobre de mercancía se queda corto. Registra el costo con una entrada de inventario.`)
      } else if (c.code === 'entradas_sin_costo') {
        out.push(`${c.entradas} ${c.entradas === 1 ? 'compra de mercancía' : 'compras de mercancía'} sin costo: no descuentan del sobre. Pon el costo unitario al surtir.`)
      } else if (c.code === 'sin_retiros') {
        out.push('No has registrado ningún retiro. Si te has llevado plata, regístrala: si no, el asistente creerá que sigue aquí.')
      }
    }
    return out
  })

  readonly segments = computed<ShareSegment[]>(() => {
    const e = this.envelopes()
    if (!e) return []
    return (['mercancia', 'fijos', 'diaADia', 'utilidad'] as const).map((key) => ({
      key,
      label: ENVELOPE_LABEL[key],
      value: Math.max(e.sobres[key].apartadoMes, 0),
      hint: ENVELOPE_HINT[key],
    }))
  })

  readonly rows = computed(() => {
    const e = this.envelopes()
    if (!e) return []
    return (['mercancia', 'fijos', 'diaADia', 'utilidad'] as const).map((key) => {
      const s: Envelope = e.sobres[key]
      return { ...s, label: ENVELOPE_LABEL[key], hint: ENVELOPE_HINT[key] }
    })
  })

  readonly fechaInicioLabel = computed(() => {
    const f = this.fechaInicio()
    if (!f) return 'inicio'
    const [y, m, d] = f.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })
  })
}
