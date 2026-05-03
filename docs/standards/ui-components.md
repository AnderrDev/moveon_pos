# Estándar: Componentes UI Centralizados (Angular)

> Fuente de verdad para cómo crear, organizar y usar componentes UI en MOVEONAPP POS.
> Cualquier desviación requiere un ADR.
>
> Estado 2026-05-02: la app es Angular 21 standalone + Tailwind CSS 4. shadcn/ui, React, RHF y Vercel ya no forman parte del stack (cleanup `2026-05-02-cleanup-next-vercel`).

---

## 1. Principio rector

**Un componente UI = un lugar.**

- Componentes Angular reutilizables → `apps/pos-angular/src/app/shared/`.
- Componentes específicos de un módulo → `apps/pos-angular/src/app/features/<modulo>/`.
- Todos los componentes son standalone (`standalone: true`).
- Inputs/outputs tipados; **nunca** se exponen tipos de Supabase a templates ni a `@Input()`.

---

## 2. Estructura de carpetas

```
apps/pos-angular/src/app/shared/
├── ui/                    # Primitivos base (Button, Card, Badge, Dialog, Table, ...)
│   ├── button.component.ts
│   ├── card.component.ts
│   └── ...
├── forms/                 # Componentes de formulario reutilizables
│   ├── form-field.component.ts
│   ├── form-input.component.ts
│   ├── form-select.component.ts
│   ├── form-currency-input.component.ts
│   └── submit-button.component.ts
├── layout/                # Estructura de página
│   ├── page-header.component.ts
│   └── data-table.component.ts
└── feedback/              # Estados de UI
    ├── loading-spinner.component.ts
    ├── empty-state.component.ts
    └── confirm-dialog.component.ts
```

> Esta carpeta se construirá a medida que se porten módulos. Hoy está vacía a propósito; el primer componente compartido nace cuando un patrón se repita en 2+ features.

---

## 3. Reglas de creación

### 3.1 Cuándo crear un componente compartido

- Se usará en **2 o más features distintas**.
- Encapsula lógica de presentación que se repetiría.
- Tiene API estable (no es un experimento de un día).

### 3.2 Cuándo NO crearlo en shared

- Solo lo usa una feature → vive en `apps/pos-angular/src/app/features/<feature>/`.
- Es demasiado específico del negocio (ej: `CartItemRow`, `CashSessionCard`).

### 3.3 Estructura obligatoria de cada componente

```typescript
// apps/pos-angular/src/app/shared/ui/button.component.ts
import { ChangeDetectionStrategy, Component, Input } from '@angular/core'

export type ButtonVariant = 'default' | 'destructive' | 'outline' | 'ghost'
export type ButtonSize = 'default' | 'sm' | 'lg' | 'icon'

@Component({
  selector: 'mo-button',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      [type]="type"
      [disabled]="disabled || isLoading"
      [class]="classes"
    >
      @if (isLoading) {
        <span class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"></span>
      } @else {
        <ng-content />
      }
    </button>
  `,
})
export class ButtonComponent {
  @Input() variant: ButtonVariant = 'default'
  @Input() size: ButtonSize = 'default'
  @Input() isLoading = false
  @Input() disabled = false
  @Input() type: 'button' | 'submit' | 'reset' = 'button'

  private readonly base =
    'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:opacity-50 disabled:cursor-not-allowed'

  private readonly variantClasses: Record<ButtonVariant, string> = {
    default: 'bg-primary text-primary-foreground hover:bg-primary/90',
    destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
    outline: 'border border-input bg-background hover:bg-accent',
    ghost: 'hover:bg-accent hover:text-accent-foreground',
  }

  private readonly sizeClasses: Record<ButtonSize, string> = {
    default: 'h-10 px-4 py-2',
    sm: 'h-9 px-3',
    lg: 'h-11 px-8',
    icon: 'h-10 w-10',
  }

  get classes(): string {
    return [this.base, this.variantClasses[this.variant], this.sizeClasses[this.size]].join(' ')
  }
}
```

**Reglas:**
- Selector con prefijo `mo-` (registrado en `angular.json`).
- `standalone: true` siempre.
- `ChangeDetectionStrategy.OnPush` por defecto.
- Inputs tipados con sus uniones; nada de `string` genéricos.
- Sin `subscribe` manual: usar signals o `async` pipe.
- Lógica de variantes en TS, no en strings sueltos en el template.

---

## 4. Estilos

- **Solo Tailwind v4.** Tokens HSL en `apps/pos-angular/src/styles.css` bajo `@theme`.
- **Sin CSS modules**, **sin styled-components**, **sin shadcn/Radix**.
- Para combinar clases dinámicas usa `[class]` con un getter o método; si crece, extrae a un `helpers.ts` de la propia feature.
- Nunca usar clases arbitrarias (`text-[#ff0000]`) salvo justificación documentada.
- Iconos: SVG inline o una librería compatible Angular (`lucide-angular`, `ng-icons`). **No** `lucide-react`.

---

## 5. Componentes con datos remotos

- Los componentes en `shared/` **no** llaman Supabase. Reciben datos por `@Input()`.
- Las features sí pueden tener componentes que consumen un servicio Angular (`@Injectable`) que habla con Supabase.
- Estado interno con `signal()`/`computed()`. Si necesitas streams (búsqueda con debounce, polling), usa `rxjs` y conviértelo a signal con `toSignal()`.

---

## 6. Checklist antes de crear un componente nuevo

- [ ] ¿Ya existe algo similar en `apps/pos-angular/src/app/shared/`?
- [ ] ¿Realmente se usa en más de una feature?
- [ ] ¿Selector con prefijo `mo-`?
- [ ] ¿`standalone: true` y `ChangeDetectionStrategy.OnPush`?
- [ ] ¿Inputs tipados con unión literal cuando aplica?
- [ ] ¿No se importa nada de React, RHF, Zustand ni shadcn?
- [ ] ¿No se exponen tipos de Supabase en `@Input()`?
- [ ] ¿El nombre del archivo es `kebab-case.component.ts` y la clase `PascalCase`?
