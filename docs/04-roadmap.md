# 04 — Roadmap

> Estimaciones en horas-persona, asumiendo 1 desarrollador.
> **Full-time** = 8h/día efectivas.
> **Part-time** = 4h/día efectivas.

---

## Resumen de versiones

| Versión | Objetivo | Sprints | Tiempo full-time | Tiempo part-time |
|---|---|---|---|---|
| v1.0 (MVP) | Operar tienda sin Siigo (excepto FE) | S0–S5 | 6–8 semanas | 12–16 semanas |
| v1.1 | Facturación electrónica vía API | S6 | 2 semanas | 4 semanas |
| v1.2 | Recetas de batidos | S7 | 2 semanas | 4 semanas |
| v1.3 | Fidelización clientes | S8 | 2 semanas | 4 semanas |
| v1.4 | Reportes avanzados | S9 | 2 semanas | 4 semanas |
| v1.5 | Modo contingencia offline | S10 | 2 semanas | 4 semanas |
| v2.0 | UI multi-sede | Sx | TBD | TBD |

---

## Sprint 0 — Setup (1 semana full-time / 2 semanas part-time)

**Objetivo:** dejar el repo, infraestructura y documentación lista para que cualquier agente IA o humano pueda contribuir desde el día 1.

### Entregables
- [ ] Repo en GitHub con `CLAUDE.md`, `AGENTS.md`, `README.md`, `/docs`.
- [ ] Proyecto Supabase creado (dev + staging + prod).
- [ ] Proyecto Vercel conectado al repo.
- [ ] Next.js 15 + TS + Tailwind + shadcn/ui inicializado.
- [ ] ESLint + Prettier + Vitest configurados.
- [ ] GitHub Actions: typecheck + lint + test en cada PR.
- [ ] Estructura de carpetas creada (`src/modules`, `src/shared`, etc.).
- [ ] `tipos generados` desde Supabase con `pnpm db:types`.
- [ ] Migration inicial con tablas mínimas: `tiendas`, `user_tiendas`.
- [ ] Seed de desarrollo: 1 tienda, 1 admin, 1 cajero.
- [ ] Página de login funcionando.

### Salida esperada
Un repo donde corres `pnpm dev`, te logueas con un usuario seed y ves un layout vacío con sidebar.

---

## Sprint 1 — Auth + Catálogo (1 semana full-time / 2 semanas part-time)

**Módulos:** M1 (Auth), M2 (Productos).

### Entregables
- [ ] Módulo `auth`: hook `useAuth`, helpers de roles, guards de página.
- [ ] Layout protegido con sidebar.
- [ ] CRUD `categorias` (UI + Server Actions + repo).
- [ ] CRUD `productos` (UI + Server Actions + repo).
- [ ] Validación con Zod.
- [ ] Búsqueda de productos por nombre / SKU / código de barras.
- [ ] RLS configurado para `categorias` y `productos`.
- [ ] Tests unitarios del dominio de productos.

### HUs cubiertas
HU-01, HU-02, HU-03, HU-04, HU-05 (ver `/docs/user-stories/sprint-01.md`).

---

## Sprint 2 — Inventario + Caja (1.5 semanas full-time / 3 semanas part-time)

**Módulos:** M3 (Inventario), M6 (Caja).

### Entregables
- [ ] Migrations: `inventory_movements`, `cash_sessions`, `cash_movements`.
- [ ] Función SQL `get_stock(producto_id, tienda_id)`.
- [ ] CRUD inventario: entradas, ajustes manuales (con motivo).
- [ ] Vista de stock actual por producto.
- [ ] Apertura de caja con base inicial.
- [ ] Cierre de caja con cuadre (efectivo esperado vs. real).
- [ ] Ingresos/egresos manuales en caja abierta.
- [ ] Validación: una caja abierta por usuario.
- [ ] RLS configurado.
- [ ] Tests unitarios e integración.

### HUs cubiertas
HU-06 a HU-12.

---

## Sprint 3 — Pantalla de venta + Pagos (1.5 semanas full-time / 3 semanas part-time)

**Módulos:** M4 (POS), M5 (Pagos). Este es el sprint más crítico.

### Entregables
- [ ] Migrations: `sales`, `sale_items`, `payments`, `billing_documents` (tabla pero sin lógica activa).
- [ ] Pantalla `/pos` con búsqueda dual (scanner + manual).
- [ ] Carrito con productos, cantidades editables, descuentos.
- [ ] Cálculo automático de subtotal, IVA, descuento, total.
- [ ] Selector de cliente (opcional).
- [ ] Modal de pago con métodos múltiples (pagos mixtos).
- [ ] Cálculo de cambio para efectivo.
- [ ] Server Action `create-sale` con idempotency_key.
- [ ] Bloqueo si caja no está abierta.
- [ ] Descuento automático de inventario al confirmar venta.
- [ ] Anulación de venta (solo admin) con reposición de stock.
- [ ] Tests unitarios e integración del use case `CreateSale` y `VoidSale`.
- [ ] Test E2E: flujo completo de venta con efectivo.

### HUs cubiertas
HU-13 a HU-22.

---

## Sprint 4 — Tickets + Reportes básicos (1 semana full-time / 2 semanas part-time)

**Módulos:** M7 (Tickets), M8 (Reportes).

### Entregables
- [ ] Componente `TicketPrintable` con CSS para 80mm.
- [ ] Botón "Imprimir ticket" usando `window.print()`.
- [ ] Reporte ventas del día (totales, por método, por cajero).
- [ ] Reporte detalle de ventas con filtros de fecha.
- [ ] Reporte cierre de caja imprimible.
- [ ] Reporte stock con alerta de bajo stock.
- [ ] Tests.

### HUs cubiertas
HU-23 a HU-27.

---

## Sprint 5 — Migración + Polish + Pilot (1 semana full-time / 2 semanas part-time)

**Módulos:** M9 (Migración), polish general.

### Entregables
- [ ] Importador CSV de productos desde Siigo (con validación previa y reporte de errores).
- [ ] Importador CSV de clientes (opcional).
- [ ] Carga de stock inicial por CSV o ajuste masivo.
- [ ] Manual operativo básico en `/docs/manual-operativo.md`.
- [ ] Pruebas de aceptación con 50 ventas reales simuladas.
- [ ] Corrección de bugs encontrados.
- [ ] Deploy a producción.
- [ ] Operación piloto en paralelo con Siigo durante 1 semana.

### Criterio de cierre del MVP
Ver `/docs/01-mvp-scope.md` § Criterios de cierre.

---

## Sprint 6 — Facturación electrónica vía API (v1.1)

> Solo iniciar después de validar la operación piloto del MVP v1.0.

### Entregables
- [ ] Selección y contratación de proveedor de facturación.
- [ ] Configuración de resolución DIAN (numeración).
- [ ] Adapter del proveedor implementando `BillingProvider`.
- [ ] Adapter `mock` para desarrollo y tests.
- [ ] Server Action `issue-billing-document`.
- [ ] Edge Function o cron para reintentar documentos `failed`.
- [ ] UI en venta: opción "Solicitar factura electrónica" con captura de datos del cliente.
- [ ] UI admin: listado de documentos con estados, reintentos, descarga PDF/XML.
- [ ] Tests unitarios e integración con mock.
- [ ] Pruebas en sandbox del proveedor.

---

## Sprints siguientes (v1.2+)

Cada uno con su propio documento detallado cuando se vaya a iniciar:
- **v1.2 — Recetas de batidos** (`/docs/user-stories/sprint-07.md`).
- **v1.3 — Fidelización** (`/docs/user-stories/sprint-08.md`).
- **v1.4 — Reportes avanzados** (`/docs/user-stories/sprint-09.md`).
- **v1.5 — Modo contingencia** (`/docs/user-stories/sprint-10.md`).

---

## Reglas del roadmap

1. **No saltarse sprints.** El orden está calculado por dependencias.
2. **No avanzar al siguiente sprint sin cerrar el anterior.** Bugs críticos del sprint actual bloquean el siguiente.
3. **Cada sprint debe terminar con software funcional desplegado en staging.**
4. **El MVP v1.0 es la primera versión que llega a producción.** Nada antes.
