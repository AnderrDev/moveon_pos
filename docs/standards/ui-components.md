# Estándar: Componentes UI Centralizados (Angular)

> Fuente de verdad para cómo crear, organizar y usar componentes UI en MOVEONAPP POS.
> Cualquier desviación requiere un ADR.
>
> Estado 2026-07-17: design system propio con **atomic design** (ADR 0014). Angular 21 standalone + Tailwind CSS 4. shadcn/ui, React, RHF y Vercel no forman parte del stack.

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
│   └── table/
│       ├── table-shell.component.ts  (mo-table-shell)
│       └── table.directives.ts       (moTable, moThead, moTh, moTr, moTd — export MO_TABLE)
├── organisms/      # Overlay/estado global o composición con servicio
│   ├── dialog.component.ts        (mo-dialog)
│   ├── toast/                     (mo-toast-host + ToastService)
│   ├── void-reason/               (mo-void-reason-dialog + constantes)
│   └── sale-detail-list.component.ts (mo-sale-detail-list)
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
| `mo-dialog` | `open`, `title`*, `description`, `busy`, `width: sm\|md\|lg\|xl` · `(closed)` |
| `mo-field-wrapper` y `mo-form-*` | `controlName`* + `label`/`error`/`required` — enlazan al FormGroup padre vía `viewProviders` (ver forms.md) |
| `mo-empty-state` | `title`*, `description` + slot de acción |
| `mo-page-header` | `title`*, `subtitle` + slot de acciones |
| `mo-stat-card`, `mo-sale-detail-list`, `mo-toast-host` | ver archivo fuente |

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

---

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
