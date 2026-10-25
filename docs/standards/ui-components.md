# Estándar: Componentes UI Centralizados (Angular)

> Fuente de verdad para cómo crear, organizar y usar componentes UI en MOVEONAPP POS.
> Cualquier desviación requiere un ADR.
>
> Estado 2026-07-22: design system propio con **atomic design** (ADR 0014, sigue vigente tras el ADR 0015). Angular 21 standalone + Tailwind CSS 4. Los componentes propios de una feature viven en `apps/pos-angular/src/app/features/<feature>/presentation/components/` (ADR 0015). shadcn/ui, React, RHF y Vercel no forman parte del stack.

---

## 1. Principio rector

**Un componente UI = un lugar.**

- Componentes reutilizables → design system en `apps/pos-angular/src/app/shared/` (estructura atómica, §2).
- Componentes específicos de un módulo → `apps/pos-angular/src/app/features/<modulo>/presentation/components/`.
- Todos los componentes son standalone (`standalone: true`).
- Inputs/outputs tipados; **nunca** se exponen tipos de Supabase a templates ni a inputs.
- **Prohibido recrear inline** los patrones ya extraídos: card, tabla, skeleton, stat-card, dialog-footer, badge/pill, spinner, botón. Si una pantalla necesita uno de estos, consume el componente del design system.

---

## 2. Estructura atómica (ADR 0014 §C)

```
apps/pos-angular/src/app/shared/
├── atoms/          # Un solo elemento HTML estilizado, sin composición
│   ├── button.component.ts        (mo-button)
│   ├── badge.component.ts         (mo-badge)
│   ├── spinner.component.ts       (mo-spinner)
│   ├── skeleton.component.ts      (mo-skeleton)
│   └── card.component.ts          (mo-card)
├── molecules/      # Composición pequeña con API propia
│   ├── field-wrapper.component.ts (mo-field-wrapper: label + error)
│   ├── form-input.component.ts    (y form-select, form-textarea, form-number-input,
│   │                               form-currency-input, form-checkbox, form-error)
│   ├── empty-state.component.ts   (mo-empty-state)
│   ├── page-header.component.ts   (mo-page-header)
│   ├── stat-card.component.ts     (mo-stat-card)
│   ├── dialog-footer.component.ts (mo-dialog-footer)
│   ├── segmented.component.ts     (mo-segmented: filtro de selección única)
│   ├── menu.component.ts          (mo-menu + moMenuItem: acciones secundarias "⋯")
│   ├── page-skeleton.component.ts (mo-page-skeleton: carga con la forma de la página)
│   └── table/
│       ├── table-shell.component.ts  (mo-table-shell)
│       └── table.directives.ts       (moTable, moThead, moTh, moTr, moTd — export MO_TABLE)
├── organisms/      # Overlay/estado global o composición con servicio
│   ├── dialog.component.ts        (mo-dialog)
│   ├── toast/                     (mo-toast-host + ToastService)
│   ├── void-reason/               (mo-void-reason-dialog + constantes)
│   ├── sale-detail-list.component.ts (mo-sale-detail-list)
│   └── sale-detail-body.component.ts (mo-sale-detail-body: detalle de UNA venta)
├── pipes/          # Transformaciones de presentación puras (ADR 0023)
│   ├── money.pipe.ts              (| money → formatCurrency)
│   └── payment-label.pipe.ts      (| paymentLabel → getPaymentMethodLabel)
└── services/       # Utilidades no visuales compartidas
    └── export/                    (ExcelExportService, export-filename)
```

Criterio de nivel: **atom** = un elemento estilizado; **molecule** = composición pequeña reutilizable; **organism** = overlay, estado global o composición mayor.

---

## 3. Catálogo (API resumida)

| Componente | API principal |
|---|---|
| `mo-button` | `variant: default\|secondary\|destructive\|outline\|ghost` · `size: xs\|sm\|default\|lg\|icon` · `loading`, `loadingText`, `disabled`, `fullWidth`, `type` |
| `mo-badge` | `variant: default\|success\|warning\|destructive\|outline` · `dot` (punto de color) |
| `mo-spinner` | `size: xs\|sm\|md` |
| `mo-skeleton` | `variant: block\|line\|circle` · `heightClass` (clase Tailwind, ej. `'h-72'`) |
| `mo-card` | `padding: none\|sm\|md` · `tone: default\|muted\|warning` · ng-content |
| `mo-stat-card` | `label`*, `value`* (string YA formateado), `hint`, `tone: default\|warning\|success\|muted` · ng-content para pie |
| `mo-dialog-footer` | `align: end\|between` · ng-content (mo-buttons) |
| `mo-table-shell` + `MO_TABLE` | `<table moTable [density]>` (`default` px-4 py-3 + header sticky; `compact` px-3 py-2 sin sticky) · `thead moThead`, `th moTh`, `td moTd`, `tr moTr [hover]`. Alineación (`text-right`, `tabular-nums`, `min-w-*`) va como clase del elemento |
| `mo-dialog` | `open`, `title`*, `description`, `busy`, `width: sm\|md\|lg\|xl` · `(closed)`. Escape cierra solo el diálogo de arriba (pila de abiertos) |
| `mo-field-wrapper` y `mo-form-*` | `controlName`* + `label`/`error`/`required` — enlazan al FormGroup padre vía `viewProviders` (ver forms.md) |
| `mo-segmented` | `options`* (`{ value, label }[]`), `[(value)]`* (string) — filas de filtros (método de pago, estado, periodo). No usar para pestañas principales |
| `mo-menu` + `moMenuItem` (`MO_MENU`) | `label` (aria-label, def. "Más acciones"), `showLabel`, `size: default\|sm`, `busy` (spinner en ⋯ mientras corre una acción del menú) · ng-content de `<button moMenuItem>` / `<a moMenuItem>`. Panel `fixed` (no se recorta en tablas), cierra al elegir, clic fuera, Escape o scroll. Úsalo cuando una cabecera o fila tenga más de 2 acciones: 1–2 visibles + el resto aquí |
| `mo-page-skeleton` | `variant: table\|stats\|summary\|form` · `rows`, `cards`, `thumb: none\|square\|circle`, `label` (lectores de pantalla). Úsalo en el `@if (loading())` de cada página; no un `mo-skeleton` suelto sobre el fondo gris (casi no se ve) |
| `mo-sale-detail-body` | `sale`*, `canCorrectPayment` · `(correctPayment)` → `{ paymentId, metodo }` |
| `mo-empty-state` | `title`*, `description` + slot de acción |
| `mo-page-header` | `title`*, `subtitle` + slot de acciones |
| `mo-stat-card`, `mo-sale-detail-list`, `mo-toast-host` | ver archivo fuente |
| `| money`, `| paymentLabel` | Pipes puros (ADR 0023). En plantillas usar el pipe, no un método `money()` local |

---

## 4. Reglas de creación

### 4.1 Cuándo crear un componente compartido

- Se usará en **2 o más features distintas**.
- Encapsula presentación que se repetiría.
- Tiene API estable (no es un experimento de un día).

### 4.2 Cuándo NO crearlo en shared

- Solo lo usa una feature → vive en `features/<feature>/presentation/components/`.
- Es demasiado específico del negocio (ej: card de producto del POS, teclado de cobro).

### 4.3 Estructura obligatoria de cada componente

```typescript
// apps/pos-angular/src/app/shared/atoms/badge.component.ts (patrón real)
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core'

export type BadgeVariant = 'default' | 'success' | 'warning' | 'destructive' | 'outline'

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  default: 'bg-secondary text-secondary-foreground',
  success: 'bg-emerald-500/15 text-emerald-700 ring-1 ring-inset ring-emerald-600/20',
  warning: 'bg-amber-500/15 text-amber-700 ring-1 ring-inset ring-amber-600/20',
  destructive: 'bg-red-500/15 text-red-700 ring-1 ring-inset ring-red-600/20',
  outline: 'border border-border text-muted-foreground',
}

@Component({
  selector: 'mo-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span [class]="classes()"><ng-content /></span>`,
})
export class BadgeComponent {
  readonly variant = input<BadgeVariant>('default')

  readonly classes = computed(() =>
    ['inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold', VARIANT_CLASSES[this.variant()]].join(' '),
  )
}
```

**Reglas:**
- Selector con prefijo `mo-` (registrado en `angular.json`).
- `standalone: true` siempre; `ChangeDetectionStrategy.OnPush` por defecto.
- **API de signals**: `input()` / `input.required()` / `output()` / `computed()` — no decoradores `@Input()`/`@Output()`.
- Inputs tipados con uniones literales; nada de `string` genérico para variantes.
- Variantes en `Record<Variant, string>` en TS, no strings sueltos en el template.
- Sin `subscribe` manual: signals o `async` pipe.

---

## 5. Estilos

- **Solo Tailwind v4.** Tokens HSL en `apps/pos-angular/src/styles.css` bajo `@theme`.
- **Sin CSS modules**, **sin styled-components**, **sin shadcn/Radix**.
- Clases dinámicas con `[class]` + `computed()`; si crece, extrae a un `helpers.ts` de la propia feature.
- Nunca clases arbitrarias (`text-[#ff0000]`) salvo justificación documentada.
- Iconos: SVG inline o librería Angular (`lucide-angular`, `ng-icons`). **No** `lucide-react`.
- **Iconos `lucide-angular`: posiciona un `<span>` envoltorio, no el `<lucide-angular>`.** Las clases del host se copian al `<svg>` interno, así que `absolute left-3 -translate-y-1/2` en el host desplaza el ícono dos veces (bug visto en buscadores). Patrón: `<span class="absolute inset-y-0 left-3 flex items-center"><lucide-angular [img]="…" class="h-4 w-4" /></span>`.

### 5.1 Identidad de marca (2026-10-24)

El POS usa la identidad MOVE ON (la misma del catálogo/landing):

| Token | Valor | Uso |
|---|---|---|
| `primary` | amarillo de marca `#F9D128` | **Solo relleno**: botón primario, ítem de nav activo, "+" de agregar, progreso. Texto encima siempre negro (`primary-foreground`). |
| `foreground` / `sidebar` | negro `#000` | Texto, sidebar, bloque de cobro, filtros activos (`bg-foreground text-background`). |
| `ring` | negro | Foco visible (el amarillo no se ve sobre blanco). |
| `font-display` | Montserrat 600–900 (Google Fonts en `index.html`) | Títulos, nombres de producto, precios y totales. El cuerpo sigue en la fuente del sistema. |

- **Prohibido `text-primary` sobre fondo claro**: el amarillo como texto es ilegible (~1.4:1). Para énfasis usa `text-foreground` + peso. No crear tonos derivados del amarillo (decisión del dueño): un solo amarillo, sin "dorados".
- **Sin etiquetas en MAYÚSCULAS** (`uppercase`/`tracking-wide`): etiquetas en tamaño oración, `text-sm font-medium text-muted-foreground`; cifras en `font-display font-extrabold tabular-nums`.
- **Espaciado de página:** toda página es `<section class="flex flex-col gap-4">` (más `h-full min-h-0` si tiene tabla que llena). `mo-page-header` NO tiene margen propio: el `gap-4` separa cabecera, pestañas, filtros y contenido. No agregar `mb-*`/`-mt-*` a los hijos directos.
- **Filtros en móvil:** buscador a ancho completo; selects en `grid-cols-[minmax(0,1fr)_minmax(0,1fr)]` con `w-full min-w-0` (con `grid-cols-2` se desbordan). `mo-segmented` es una sola fila que se desplaza en horizontal.
- **Listas en móvil:** una tabla con más de ~3 columnas se muestra como tarjetas bajo `md` (ejemplo: Productos).
- **Estados de carga:** (1) arranque: pantalla negra con logo y barra amarilla (`index.html` + `AppComponent` hasta la primera navegación); (2) navegación: barra amarilla de 3px arriba (shell) mientras corren guards y carga diferida; (3) datos: `mo-page-skeleton` con la forma de la página; (4) acciones: `loading` en `mo-button` o `busy` en `mo-menu`. El sidebar muestra un placeholder hasta conocer el rol (no mostrar el menú de cajero y luego el de admin).
- **Pestañas principales** (Reportes, Productos/Categorías): barra con `border-b` y subrayado amarillo de 3px en la activa. Sub-vistas y filtros: píldoras negras (`mo-segmented` o equivalente).
- `amber-*` queda reservado para avisos (warning), no como color de marca.
- Logo oficial (blanco + amarillo, para fondo negro): `apps/pos-angular/public/assets/brand/moveon-logo.png`.

---

### 5.2 Gráficas (2026-10-24)

Componentes en `shared/molecules/charts/`, hechos con HTML/CSS (sin librería de gráficas):

| Componente | Para qué |
|---|---|
| `mo-column-chart` | Una serie en el tiempo (ventas por día, por hora). Eje con números redondos, tooltip por columna (mouse, toque y teclado), "Ver como tabla". |
| `mo-bar-list-chart` | Ranking de una serie (top productos, métodos de pago, gastos por categoría). Valor en la punta y `%` opcional; `shareOf` cuando los puntos son parte de un total mayor. |
| `mo-grouped-column-chart` | 2–3 series en el mismo eje (ventas vs. gastos por mes). Leyenda siempre visible, tooltip con todas las series. |
| `mo-share-bar-chart` | Reparto de un total en 2–3 partes (a dónde se fue lo vendido). Leyenda con valor y `%`. |

Reglas (guía de visualización): colores de `chart-palette.ts` — **paleta aparte de la marca** (decisión del dueño): azul `#2a78d6`, naranja `#eb6834`, verde `#1baf7a`, validados para daltonismo y contraste; el amarillo y el negro de marca no pasan para barras sobre fondo claro. Orden fijo (la serie 1 siempre es azul). Un solo eje Y (nunca dos escalas). Columnas ≤ 24 px con punta redondeada de 4 px y 2 px de separación. El texto usa colores de texto, nunca el de la serie. Las gráficas muestran los huecos (día u hora sin ventas = 0). Un `%` que redondea a 0 se muestra `<1%`. Escalas y formatos: `src/shared/lib/chart-scale.ts`.

## 6. Componentes con datos remotos

- Los componentes del design system (`shared/`) **no** llaman Supabase. Reciben datos por inputs.
- Las features sí pueden tener componentes que consumen un servicio Angular que habla con Supabase (vía su repositorio en `features/<mod>/data/`).
- Estado interno con `signal()`/`computed()`; streams con `rxjs` → `toSignal()`.

---

## 7. Checklist antes de crear un componente nuevo

- [ ] ¿Ya existe algo en el catálogo (§3) que lo cubre o casi?
- [ ] ¿Realmente se usa en más de una feature? (si no → `presentation/components/` de la feature)
- [ ] ¿Nivel correcto: atom / molecule / organism?
- [ ] ¿Selector `mo-`, `standalone: true`, `OnPush`, API de signals?
- [ ] ¿Inputs tipados con unión literal y variantes en `Record<>`?
- [ ] ¿No se importa nada de React, RHF, Zustand ni shadcn?
- [ ] ¿No se exponen tipos de Supabase en inputs?
- [ ] ¿Archivo `kebab-case.component.ts`, clase `PascalCase`?
