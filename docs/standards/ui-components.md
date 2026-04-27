# Estándar: Componentes UI Centralizados

> Fuente de verdad para cómo crear, organizar y usar componentes UI en MOVEONAPP POS.
> Cualquier desviación requiere un ADR.

---

## 1. Principio rector

**Un componente UI = un lugar.** Todo componente reutilizable vive en `src/shared/components/`. Los componentes específicos de un módulo viven en `src/modules/<modulo>/`. Nunca al revés.

---

## 2. Estructura de carpetas

```
src/shared/components/
├── ui/                    # Primitivos base (wraps de shadcn/ui)
│   ├── Button.tsx
│   ├── Input.tsx
│   ├── Badge.tsx
│   ├── Card.tsx
│   ├── Dialog.tsx
│   ├── Table.tsx
│   └── ...
├── forms/                 # Componentes de formulario reutilizables
│   ├── FormField.tsx      # Wrapper: label + input + error message
│   ├── FormInput.tsx
│   ├── FormSelect.tsx
│   ├── FormTextarea.tsx
│   ├── FormCurrencyInput.tsx
│   └── SubmitButton.tsx
├── layout/                # Estructura de página
│   ├── PageHeader.tsx     # Título + acciones de cabecera
│   ├── PageContainer.tsx  # Padding y max-width estándar
│   ├── Sidebar.tsx
│   └── DataTable.tsx      # Tabla con paginación y filtros
├── feedback/              # Estados de UI
│   ├── LoadingSpinner.tsx
│   ├── EmptyState.tsx
│   ├── ErrorState.tsx
│   └── ConfirmDialog.tsx
└── index.ts               # Re-exporta todo (barrel file)
```

---

## 3. Reglas de creación

### 3.1 Cuándo crear un componente compartido
- Se usará en **2 o más módulos distintos**.
- Encapsula lógica de presentación que se repetiría.
- Es una extensión/composición de shadcn/ui.

### 3.2 Cuándo NO crearlo en shared
- Solo lo usa un módulo → va en `src/modules/<modulo>/` (sin subcarpeta `components/` a menos que el módulo tenga varios).
- Es demasiado específico del negocio (ej: `CartItemRow`, `CashSessionCard`).

### 3.3 Estructura obligatoria de cada componente

```typescript
// src/shared/components/ui/Button.tsx

import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/shared/lib/utils';

// 1. Definir variantes con CVA
const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border border-input bg-background hover:bg-accent',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 px-3',
        lg: 'h-11 px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

// 2. Props interface exportada
export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  isLoading?: boolean;
}

// 3. Componente con forwardRef si necesita ref
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, isLoading, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={isLoading || props.disabled}
        {...props}
      >
        {isLoading ? <LoadingSpinner size="sm" /> : children}
      </button>
    );
  }
);
Button.displayName = 'Button';
```

---

## 4. Extensión de shadcn/ui

**Regla:** no modificar los archivos de `src/components/ui/` generados por shadcn. En su lugar:

1. Importar el primitivo de shadcn.
2. Crear wrapper en `src/shared/components/ui/` con la lógica extra.
3. Usar el wrapper en la app.

```typescript
// MAL: modificar shadcn directamente
// src/components/ui/button.tsx  ← no tocar

// BIEN: extender en shared
// src/shared/components/ui/Button.tsx
import { Button as ShadcnButton } from '@/components/ui/button';

export const Button = ({ isLoading, ...props }) => (
  <ShadcnButton disabled={isLoading || props.disabled} {...props}>
    {isLoading ? <Spinner /> : props.children}
  </ShadcnButton>
);
```

---

## 5. Barrel file

Exportar todo desde `src/shared/components/index.ts`:

```typescript
// src/shared/components/index.ts
export * from './ui/Button';
export * from './ui/Input';
export * from './ui/Badge';
export * from './forms/FormField';
export * from './forms/FormInput';
export * from './layout/PageHeader';
export * from './layout/PageContainer';
export * from './layout/DataTable';
export * from './feedback/LoadingSpinner';
export * from './feedback/EmptyState';
export * from './feedback/ErrorState';
export * from './feedback/ConfirmDialog';
```

Importación siempre así:
```typescript
import { Button, FormInput, PageHeader } from '@/shared/components';
```

---

## 6. Componentes con estado de servidor

Los componentes en `src/shared/components/` son **React Client Components** (tienen interactividad). Los layouts y contenedores de datos van en `src/app/` como Server Components.

Regla: si un componente compartido necesita datos de Supabase, recibe esos datos como props (no hace fetch interno).

---

## 7. Estilos

- **Solo Tailwind.** No CSS modules, no styled-components.
- **CVA** para variantes de componentes.
- **`cn()`** (`clsx` + `tailwind-merge`) para combinar clases condicionalmente.
- Los colores y espaciados siguen el design token en `tailwind.config.ts`.
- Nunca usar clases arbitrarias de Tailwind (`text-[#ff0000]`) salvo justificación.

---

## 8. Checklist antes de crear un componente nuevo

- [ ] ¿Ya existe algo similar en shadcn/ui que puedo extender?
- [ ] ¿Ya existe en `src/shared/components/`?
- [ ] ¿Realmente se usará en más de un módulo?
- [ ] ¿Tiene props interface exportada?
- [ ] ¿Usa CVA para variantes (si aplica)?
- [ ] ¿Está exportado en el barrel file?
- [ ] ¿El nombre es descriptivo y en PascalCase?
