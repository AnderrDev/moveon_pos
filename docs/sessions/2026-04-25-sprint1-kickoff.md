# Spec de Sesión — 2026-04-25 — Sprint 1 kickoff (HU-01 + HU-03 + HU-04 + UX)

---

## Metadatos

| Campo | Valor |
|---|---|
| Fecha | 2026-04-25 |
| Sprint | Sprint 1 |
| Agente | Claude Code |
| HUs trabajadas | HU-01, HU-03, HU-04 |
| Estado | Completada |

---

## 1. Objetivo de la sesión

Implementar HU-01 (Login), HU-03 (CRUD Categorías) y HU-04 (CRUD Productos), más mejoras completas de UX/UI.

---

## 2. Lo que se implementó

### 2.1 Archivos creados — Auth (HU-01)

- `src/modules/auth/forms/login-form.factory.ts` — schema Zod + tipo + defaults
- `src/modules/auth/forms/login-form.mapper.ts` — toSignInPayload()
- `src/modules/auth/application/actions/sign-in.action.ts` — Server Action auth + user_tiendas + redirect por rol
- `src/modules/auth/application/actions/sign-out.action.ts` — signOut + redirect /login
- `src/modules/auth/hooks/use-login-form.ts` — useActionState + useForm + zodResolver
- `src/modules/auth/LoginForm.tsx` — componente cliente
- `src/middleware.ts` — protección de rutas
- `src/shared/lib/auth-context.ts` — helper getAuthContext() para Server Actions

### 2.2 Archivos creados — UI/UX

- `src/shared/components/layout/Sidebar.tsx` — sidebar oscuro con iconos Lucide + active state
- `src/shared/components/layout/PageHeader.tsx` — título + descripción + slot de acciones
- `src/shared/components/layout/ComingSoon.tsx` — empty state con sprint + features
- `src/shared/components/ui/Button.tsx` — botón general con variantes CVA
- `src/shared/components/ui/Badge.tsx` — badge de estado (success/warning/destructive/outline)
- `src/shared/components/ui/Dialog.tsx` — modal accesible (Escape + scroll lock + backdrop)

### 2.3 Archivos creados — Categorías (HU-03)

- `src/modules/products/application/dtos/categoria.dto.ts` — schemas Zod
- `src/modules/products/application/actions/categoria.actions.ts` — create, update, deactivate, activate
- `src/modules/products/forms/categoria-form.factory.ts`
- `src/modules/products/forms/categoria-form.mapper.ts`
- `src/modules/products/hooks/use-categoria-form.ts`
- `src/modules/products/components/CategoriaFormDialog.tsx`
- `src/modules/products/components/CategoriaActions.tsx`
- `src/modules/products/components/AddCategoriaButton.tsx`

### 2.4 Archivos creados — Productos (HU-04)

- `src/modules/products/application/actions/product.actions.ts` — create, update, toggleActive + audit_logs
- `src/modules/products/components/ProductFormDialog.tsx` — formulario completo (grid 2-3 cols)
- `src/modules/products/components/ProductoActions.tsx`
- `src/modules/products/components/AddProductoButton.tsx`

### 2.5 Archivos modificados

- `src/app/(auth)/layout.tsx` — split layout con panel de marca + formulario
- `src/app/(auth)/login/page.tsx` — usa LoginForm, texto sin placeholder
- `src/app/(app)/layout.tsx` — usa Sidebar, auth check server-side
- `src/app/globals.css` — paleta naranja, sidebar tokens, radius mejorado
- `src/infrastructure/supabase/server.ts` — usa `Omit<Database, '__InternalSupabase'>` para resolver tipos correctamente
- `src/modules/products/hooks/use-product-form.ts` — conecta Server Actions reales
- `src/shared/components/forms/FormInput.tsx` — h-11, rounded-lg, shadow-sm
- `src/shared/components/forms/FormSelect.tsx` — mismo estilo que FormInput
- `src/shared/components/forms/SubmitButton.tsx` — rounded-lg, font-semibold, brightness hover
- `src/shared/components/forms/FieldWrapper.tsx` — font-semibold label
- Todas las páginas placeholder — usan PageHeader + ComingSoon con features reales

---

## 3. Decisiones técnicas

| Decisión | Razón |
|---|---|
| `(supabase as any)` en mutations de Server Actions | Bug conocido de @supabase/ssr v0.5 — Insert/Update inferidos como `never`. Datos validados con Zod, seguridad por RLS |
| `Omit<Database, '__InternalSupabase'>` en server.ts | La key `__InternalSupabase` en el tipo Database confunde la resolución del schema en @supabase/ssr |
| `.returns<T[]>()` en todos los SELECT | Mismo problema de inferencia — se resuelve con el tipo explícito |
| Sidebar como cliente ('use client') | Necesita usePathname() para el active state |
| Server Components para páginas de lista | Los datos se cargan en servidor; solo dialogs/actions son cliente |

---

## 5. Tests

- [x] `pnpm typecheck` — 0 errores
- [x] `npx next build` — build limpio, todas las rutas compilan

---

## 7. Próximos pasos

1. **Probar en browser**: Login → /productos → crear categoría → crear producto
2. **HU-05**: Componente `<ProductSearch>` reutilizable con debounce 200ms (necesario para Sprint 3 POS)
3. **Filtros en /productos**: buscar por nombre/SKU, filtrar por categoría y estado
4. **Paginación** en /productos (actualmente carga todo)
5. **Regenerar tipos**: `pnpm db:types` cuando la DB local esté levantada, para eliminar el workaround `as any`

---

## 8. Notas adicionales

- El workaround `as any` en Server Actions se puede eliminar cuando se actualice `@supabase/ssr` a ≥v0.6 o cuando se regeneren los tipos con la nueva versión del CLI.
- La auditoría de cambio de precio (RN-P02) está implementada en create y update de productos.
- El sidebar activo detecta rutas con `startsWith`, por lo que /productos/categorias activa el item "Productos".
