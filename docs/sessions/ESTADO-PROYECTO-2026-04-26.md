# Estado del Proyecto — MOVEONAPP POS — 2026-04-26

> Documento de entrega para el próximo agente (Claude Code o Codex).
> Lee este archivo PRIMERO antes de cualquier tarea.

---

## Resumen ejecutivo

El proyecto tiene las 3 capas del MVP v1.0 completamente scaffoldeadas y funcionales:
- **Sprint 0** ✅ — Infraestructura, DB, RLS
- **Sprint 1** ✅ — Auth, productos, categorías
- **Sprint 2** ✅ — Inventario (stock, entradas, ajustes, kardex), Caja (apertura, movimientos, cierre)
- **Sprint 3** ✅ (90%) — POS completo: búsqueda, carrito, pago múltiple, confirmación de venta, anulación

**Typecheck:** 0 errores. **Lint:** 0 warnings. **Tests:** 22/22 pasan.

---

## Acceso al sistema

| Credencial | Valor |
|---|---|
| URL local | `http://localhost:3000` |
| Usuario de prueba | `admin@moveonpos.co` |
| Contraseña | `Admin1234!` |
| Rol | `admin` |
| Tienda ID | `a1b2c3d4-0000-0000-0000-000000000001` |
| Supabase proyecto | `rmaieqyscchtxxkgxgik` (us-west-2) |

Para arrancar: `npm run dev` (o `pnpm dev`)

---

## Arquitectura de módulos — Estado actual

```
src/modules/
├── auth/           ✅ domain · application · infrastructure · components
├── products/       ✅ domain · application · infrastructure · components
├── inventory/      ✅ domain · application · infrastructure · components
├── cash-register/  ✅ domain · application · infrastructure · components
├── sales/          ✅ domain · application · infrastructure · store · components
├── billing/        ⬜ scaffold vacío (Sprint 5)
├── customers/      ⬜ scaffold vacío (Sprint 4)
├── reports/        ⬜ scaffold vacío (Sprint 4)
└── payments/       ⬜ scaffold vacío (integrado en sales)
```

---

## Páginas y su estado

| Ruta | Estado | Componentes clave |
|---|---|---|
| `/login` | ✅ funcional | `LoginForm`, Server Action `signInWithPassword` |
| `/pos` | ✅ funcional | `PosScreen`, `CartPanel`, `PaymentModal`, `ProductSearch` |
| `/productos` | ✅ funcional | tabla + CRUD completo (dialog, server actions) |
| `/productos/categorias` | ✅ funcional | tabla + CRUD completo |
| `/inventario` | ✅ funcional | `StockTable`, `RegisterEntryDialog`, `AdjustStockDialog`, `KardexDialog` |
| `/caja` | ✅ funcional | `OpenSessionForm`, `SessionSummary`, `AddMovementDialog`, `CloseSessionDialog` |
| `/reportes` | ⬜ ComingSoon | Sprint 4 |
| `/clientes` | ⬜ no existe aún | Sprint 4 |

---

## Flujo de venta completo (cómo probarlo)

1. Login → `admin@moveonpos.co` / `Admin1234!`
2. Ir a **Caja** → Abrir caja con monto inicial (ej. $50.000)
3. Ir a **Productos** → Crear categoría + crear producto con precio y stock mínimo
4. Ir a **Inventario** → Registrar entrada del producto (stock inicial)
5. Ir a **POS** → Buscar producto → agregar al carrito → Cobrar → seleccionar método → Confirmar
6. Ver que el stock bajó en Inventario

---

## Decisiones arquitectónicas clave

### Clean Architecture por módulos
```
Domain (entidades, interfaces de repo, servicios puros)
  ↑ Application (use-cases, DTOs Zod, Server Actions)
    ↑ Infrastructure (Supabase repos, mappers)
      ↑ UI (páginas Next.js, componentes React)
```

### Patrón de formularios
- **Forms complejos** (productos, categorías): React Hook Form + Zod + shared `FormInput`/`FormCurrencyInput` con `control`
- **Forms simples en diálogos** (inventario, caja): `useActionState` + inputs HTML nativos + `SubmitButton`
- **No mezclar** — los shared form components requieren el `control` prop de RHF

### Supabase y tipos
- `@supabase/ssr v0.5` tiene bug: `.insert()` y `.update()` tipan el argumento como `never` en algunos casos
- Workaround documentado: `(supabase as any).from(...)` con `/* eslint-disable @typescript-eslint/no-explicit-any */`
- `get_stock` RPC no está en `database.types.ts` — usar `(supabase as any).rpc(...)`
- Para regenerar tipos: `pnpm db:types` (usa el proyecto remoto `rmaieqyscchtxxkgxgik`)

### Tailwind v4
- Usa `@import "tailwindcss"` + `@theme {}` en `globals.css` (NO `@tailwind base/utilities`)
- Plugin PostCSS: `@tailwindcss/postcss` (no `tailwindcss`)
- Tokens de color definidos en `@theme` referencian CSS vars de `:root`/`.dark`
- `next/font` variables: `--body-font` y `--heading-font` (no `--font-sans`/`--font-display`)

---

## Pendientes Sprint 3 (pequeños)

- [ ] **UI descuento por ítem** en `CartPanel` — botón inline que permite setear `discountAmount` por producto
- [ ] **Historial de ventas del turno** — tabla de ventas en `/pos` o sidebar colapsable
- [ ] **Anulación de venta UI** — acción visible desde historial (solo admin)
- [ ] **Selección de cliente** en `PaymentModal` — campo opcional de `clienteId`
- [ ] **Número de venta correcto** en `SaleSuccessModal` — actualmente muestra `'...'` porque necesita refetch

---

## Sprint 4 — Reportes + Clientes (próximo)

Ver `docs/user-stories/sprint-04.md`. Módulos a implementar:

1. **Clientes** — CRUD básico (`nombre`, `documento`, `telefono`, `email`)
2. **Reportes diarios** — resumen de ventas del día: total, por método de pago, IVA, productos más vendidos
3. **Reporte de caja** — cuadre del turno imprimible (HTML `window.print()`)

---

## Comandos útiles

```bash
npm run dev           # Servidor local
npm run typecheck     # Verificar tipos TS
npm run lint          # ESLint
npm test              # Tests (22 pasan)
npm run test:watch    # Tests en modo watch
npm run db:types      # Regenerar tipos desde Supabase remoto
```

---

## Archivos críticos de referencia

| Archivo | Qué contiene |
|---|---|
| `CLAUDE.md` | Reglas operativas para Claude Code |
| `docs/02-architecture.md` | Principios arquitectónicos no negociables |
| `docs/standards/ui-components.md` | Cómo crear/extender componentes UI |
| `docs/standards/forms.md` | Patrón de formularios RHF + Zod |
| `src/app/globals.css` | Tokens de tema Tailwind v4 |
| `src/shared/result.ts` | Tipo `Result<T,E>` con `ok()`, `err()` |
| `src/shared/lib/auth-context.ts` | `getAuthContext()` para Server Actions |
| `supabase/migrations/` | Schema completo de la DB |
