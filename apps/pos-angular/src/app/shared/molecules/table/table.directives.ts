import { Directive, computed, input } from '@angular/core'

/**
 * Primitivas de tabla del design system (ADR 0014 §D).
 * Directivas de atributo: centralizan el estilo sin alterar la semántica HTML
 * ni la estructura de cada tabla. Uso:
 *
 * <mo-table-shell>
 *   <table moTable>
 *     <thead moThead><tr><th moTh>...</th></tr></thead>
 *     <tbody><tr moTr [hover]="true"><td moTd>...</td></tr></tbody>
 *   </table>
 * </mo-table-shell>
 */

@Directive({
  selector: 'table[moTable]',
  standalone: true,
  host: { class: 'w-full text-sm' },
})
export class TableDirective {}

@Directive({
  selector: 'thead[moThead]',
  standalone: true,
  host: {
    class: 'bg-muted/50 text-muted-foreground sticky top-0 text-left text-xs tracking-wide uppercase',
  },
})
export class TheadDirective {}

@Directive({
  selector: 'th[moTh]',
  standalone: true,
  host: { class: 'px-4 py-3 font-semibold' },
})
export class ThDirective {}

@Directive({
  selector: 'tr[moTr]',
  standalone: true,
  host: { '[class]': 'classes()' },
})
export class TrDirective {
  readonly hover = input(false)

  readonly classes = computed(() => ['border-t', this.hover() ? 'hover:bg-muted/30' : ''].join(' '))
}

@Directive({
  selector: 'td[moTd]',
  standalone: true,
  host: { class: 'px-4 py-3' },
})
export class TdDirective {}

/** Import único para las tablas: [MO_TABLE, TableShellComponent] cubre el patrón completo. */
export const MO_TABLE = [TableDirective, TheadDirective, ThDirective, TrDirective, TdDirective] as const
