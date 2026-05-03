# Plan de Migración a Angular

## Objetivo

Reemplazar Next.js/React por Angular sin cambiar el negocio: mismas reglas, datos, permisos, diseño operativo y flujos críticos.

## Estado inicial

- App Angular creada en `apps/pos-angular`.
- Scripts principales apuntan a Angular:
  - `pnpm dev` → `ng serve pos-angular`
  - `pnpm build` → `ng build pos-angular`
- Next queda como puente temporal:
  - `pnpm dev:next`
  - `pnpm build:next`
- POS Angular inicial:
  - Login con Reactive Forms + Zod factory/mapper existente.
  - Shell responsive.
  - Catálogo POS desde Supabase.
  - Carrito con Angular signals.
  - Cobro con pagos.
  - Creación de venta vía RPC `create_sale_atomic`.

## Fases

### Fase 1 — Base Angular y POS

- [x] Crear workspace Angular.
- [x] Portar login.
- [x] Portar shell responsive.
- [x] Portar POS base.
- [x] Reusar `sale-calculator.ts`.
- [x] Usar `create_sale_atomic` para venta.
- [ ] Configurar variables reales de Supabase para Angular.
- [ ] Probar venta real con caja abierta.
- [ ] Portar ticket imprimible post-venta.
- [ ] Portar historial/anulación.

### Fase 2 — Productos y categorías

- [ ] Portar listado de productos.
- [ ] Portar formulario producto con `product-form.factory.ts` y mapper existente.
- [ ] Portar CRUD categorías.
- [ ] Reemplazar Server Actions por servicios Angular + RLS/RPC.

### Fase 3 — Inventario y caja

- [ ] Portar stock table.
- [ ] Portar ajustes y entradas.
- [ ] Portar apertura/cierre de caja.
- [ ] Portar reporte imprimible de cierre.

### Fase 4 — Clientes y reportes

- [ ] Portar clientes.
- [ ] Portar reporte diario.
- [ ] Portar reporte stock bajo.

### Fase 5 — Retiro de Next

- [ ] Eliminar rutas `src/app`.
- [ ] Eliminar componentes React.
- [ ] Eliminar dependencias Next/React/RHF/Zustand.
- [ ] Reemplazar lint Next por ESLint Angular.
- [ ] Actualizar CI/CD y hosting.

## Mapa de reemplazos

| Next/React actual         | Angular destino                              |
| ------------------------- | -------------------------------------------- |
| Server Component          | Route/page component + service               |
| Server Action             | Angular service + Supabase RPC/Edge Function |
| React Hook Form           | Angular Reactive Forms                       |
| `use-*-form.ts`           | `*-form.presenter.ts`                        |
| Zustand store             | Injectable store con signals                 |
| shadcn/Radix dialog       | Angular standalone component/dialog propio   |
| `next/navigation`         | Angular Router                               |
| `next/cache` revalidation | Refetch explícito / invalidación de store    |

## Riesgos

- Crear ventas desde browser exige que las funciones SQL y RLS sean correctas. La regla es usar RPC transaccional para escrituras críticas.
- Los tipos generados de Supabase aún no incluyen todas las RPC actuales; donde falte tipado se debe aislar el cast en infraestructura.
- Mientras convivan frameworks, no mezclar imports React en Angular ni imports Angular en dominio.
