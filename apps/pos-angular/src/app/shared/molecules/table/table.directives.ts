import { Directive, computed, inject, input } from '@angular/core'

/**
 * Primitivas de tabla del design system (ADR 0014 §D).
 * Directivas de atributo: centralizan el estilo sin alterar la semántica HTML
 * ni la estructura de cada tabla. Las celdas heredan la densidad del
 * `table[moTable]` padre vía DI. Uso:
 *
 * <mo-table-shell>
 *   <table moTable>                              <!-- density="compact" para tablas embebidas -->
 *     <thead moThead><tr><th moTh>...</th></tr></thead>
 *     <tbody><tr moTr [hover]="true"><td moTd>...</td></tr></tbody>
 *   </table>
 * </mo-table-shell>
 *
 * - default: páginas de listado (px-4 py-3, header sticky, tracking-wide).
 * - compact: tablas dentro de cards de reportes (px-3 py-2, sin sticky).
 */

export type TableDensity = 'default' | 'compact'

@Directive({
  selector: 'table[moTable]',
  standalone: true,
  host: { class: 'w-full text-sm' },
})
export class TableDirective {
  readonly density = input<TableDensity>('default')
}

const THEAD_DENSITY_CLASSES: Record<TableDensity, string> = {
  default: 'sticky top-0 text-left tracking-wide',
  compact: '',
}

@Directive({
  selector: 'thead[moThead]',
  standalone: true,
  host: { '[class]': 'classes()' },
})
export class TheadDirective {
  private readonly table = inject(TableDirective, { optional: true })

  readonly classes = computed(() =>
    [
      'bg-muted/50 text-muted-foreground text-xs uppercase',
      THEAD_DENSITY_CLASSES[this.table?.density() ?? 'default'],
    ].join(' '),
  )
}

// default no fija peso: los th de las páginas confían en el bold del navegador
const TH_DENSITY_CLASSES: Record<TableDensity, string> = {
  default: 'px-4 py-3',
  compact: 'px-3 py-2 font-bold',
}

@Directive({
  selector: 'th[moTh]',
  standalone: true,
  host: { '[class]': 'classes()' },
})
export class ThDirective {
  private readonly table = inject(TableDirective, { optional: true })

  readonly classes = computed(() => TH_DENSITY_CLASSES[this.table?.density() ?? 'default'])
}

@Directive({
  selector: 'tr[moTr]',
  standalone: true,
  host: { '[class]': 'classes()' },
})
export class TrDirective {
  readonly hover = input(false)

  readonly classes = computed(() => ['border-t', this.hover() ? 'hover:bg-muted/30' : ''].join(' '))
}

const TD_DENSITY_CLASSES: Record<TableDensity, string> = {
  default: 'px-4 py-3',
  compact: 'px-3 py-2',
}

@Directive({
  selector: 'td[moTd]',
  standalone: true,
  host: { '[class]': 'classes()' },
})
export class TdDirective {
  private readonly table = inject(TableDirective, { optional: true })

  readonly classes = computed(() => TD_DENSITY_CLASSES[this.table?.density() ?? 'default'])
}

/** Import único para las tablas: [MO_TABLE, TableShellComponent] cubre el patrón completo. */
export const MO_TABLE = [TableDirective, TheadDirective, ThDirective, TrDirective, TdDirective] as const
