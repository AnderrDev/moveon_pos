# Auditoria integral — Arquitectura, patrones y calidad

Fecha: 2026-05-30  
Alcance: auditoria documental y estatica del repo completo MOVEONAPP POS. No se corrigio codigo en esta entrega.

---

## Resumen ejecutivo

El proyecto compila y pasa la bateria principal:

- `corepack pnpm typecheck` — pasa.
- `corepack pnpm lint` — pasa.
- `corepack pnpm test` — pasa, 34 archivos / 299 tests.
- `corepack pnpm test:e2e` — falla por ausencia de specs Playwright (`tests/e2e/.gitkeep` solamente).

La base general esta bien encaminada: Angular standalone con `OnPush`, dominio TS puro sin Angular/Supabase, Supabase aislado principalmente en servicios/repositorios Angular, escrituras de venta/anulacion/cierre/traslado por RPC, `.codex/` y runtime config local ignorados, y sin stack legacy activo en `package.json`.

Los riesgos principales no son de compilacion sino de arquitectura y seguridad:

1. **Critico:** las mutaciones admin-only de productos/inventario dependen demasiado de guards/UI; las politicas RLS actuales son tenant-only (`for all to authenticated`) y no distinguen `admin` vs `cajero`.
2. **Critico:** la regla de autorizacion de descuentos por rol esta documentada como pendiente en el flujo POS real; el use-case puro la valida, pero la UI usa `PosSaleService` -> RPC directo y no pasa por ese use-case.
3. **Alto:** varios repositorios Angular no siguen el contrato Repository + `Result`, sino que devuelven entidades directas y hacen `throw new Error`.
4. **Alto:** `pos.page.ts` es un componente monolitico de 859 lineas y concentra template, estado, checkout, pagos, side effects e impresion.
5. **Alto:** no hay E2E automatizado aunque Playwright esta configurado.

---

## Hallazgos criticos

### C1 — Mutaciones admin-only protegidas por UI, no por RLS/servicio

**Evidencia**

- Rutas admin-only existen para Productos/Inventario/Reportes: `apps/pos-angular/src/app/app.routes.ts:32`, `apps/pos-angular/src/app/app.routes.ts:44`, `apps/pos-angular/src/app/app.routes.ts:60`.
- El menu tambien oculta items admin-only: `apps/pos-angular/src/app/core/layout/shell.component.ts:113`.
- Pero RLS de `productos` e `inventory_movements` permite `for all to authenticated` por tienda, sin rol: `supabase/migrations/20260508_001_security_hardening.sql:103`, `supabase/migrations/20260508_001_security_hardening.sql:109`, `supabase/migrations/20260508_001_security_hardening.sql:115`.
- `product-form.dialog.ts` solo verifica autenticacion antes de crear/editar producto, no rol: `apps/pos-angular/src/app/features/products/product-form.dialog.ts:193`.
- `products.repository.ts` ejecuta `insert/update` directo sobre `productos`: `apps/pos-angular/src/app/features/products/products.repository.ts:76`, `apps/pos-angular/src/app/features/products/products.repository.ts:120`.
- `inventory.repository.ts` ejecuta inserts directos para `entry` y `adjustment`: `apps/pos-angular/src/app/features/inventory/inventory.repository.ts:143`, `apps/pos-angular/src/app/features/inventory/inventory.repository.ts:165`.
- El traslado si tiene doble control: UI admin `apps/pos-angular/src/app/features/inventory/transfer-stock.dialog.ts:170` y RPC admin `supabase/migrations/20260529_002_inventory_location_rpcs.sql:303`.

**Riesgo**

Un usuario autenticado con rol `cajero` no ve las pantallas, pero si obtiene el anon key y la sesion del navegador puede intentar mutar tablas de su tienda directamente. La RLS actual parece aislar por tienda, no por rol operativo.

**Recomendacion**

Crear PLAN de seguridad P0: endurecer RLS/RPC para operaciones admin-only (`productos`, `categorias`, `inventory_movements` entry/adjustment) con politicas `with check` por rol o RPCs admin-only. Reforzar servicios Angular sensibles con `SessionService.getRole()` antes de mutar, como defensa en profundidad.

### C2 — Autorizacion de descuentos por rol no se aplica en el flujo POS real

**Evidencia**

- El TODO sigue en el flujo POS: `apps/pos-angular/src/app/features/pos/pos.page.ts:814`.
- `PosSaleService.createSale` valida estructura con Zod y llama `create_sale_atomic`, pero no valida rol/descuento: `apps/pos-angular/src/app/features/pos/pos-sale.service.ts:84`, `apps/pos-angular/src/app/features/pos/pos-sale.service.ts:99`.
- El use-case puro si contiene la regla: `src/modules/sales/application/use-cases/create-sale.use-case.ts:98`, pero este no es el camino usado por POS Angular.
- `docs/plan-de-trabajo.md:24` marca PLAN-02 como hecho con RN-S09 pendiente como TODO.

**Riesgo**

Un cajero podria aplicar descuentos por encima del umbral sin aprobacion de admin si la UI se lo permite. Como el RPC no recibe rol ni valida el umbral, el servidor tampoco lo bloquea.

**Recomendacion**

Crear PLAN P0: mover la regla al servidor o a un RPC de autorizacion transaccional. Minimo: validar en `PosSaleService` con rol cargado antes del RPC y bloquear en UI; ideal: `create_sale_atomic` debe validar rol/umbral consultando `user_tiendas` o recibir un approval token auditado.

---

## Hallazgos altos

### H1 — `pos.page.ts` supera ampliamente el limite de 300 lineas

**Evidencia**

- 859 lineas.
- Template inline inicia en `apps/pos-angular/src/app/features/pos/pos.page.ts:27`.
- Catalogo/carrito/check-out viven dentro del mismo template: `apps/pos-angular/src/app/features/pos/pos.page.ts:140`, `apps/pos-angular/src/app/features/pos/pos.page.ts:183`.
- Estado, carga, pagos, descuentos, confirmacion e impresion viven en la misma clase: `apps/pos-angular/src/app/features/pos/pos.page.ts:573`, `apps/pos-angular/src/app/features/pos/pos.page.ts:642`, `apps/pos-angular/src/app/features/pos/pos.page.ts:780`, `apps/pos-angular/src/app/features/pos/pos.page.ts:810`.

**Recomendacion**

Dividir en fase P1:

- `pos-catalog.component.ts` para busqueda/categorias/product grid.
- `pos-cart-panel.component.ts` para carrito y totales.
- `pos-checkout.dialog.ts` para pagos/descuentos.
- `pos-page.presenter.ts` o `pos-checkout.presenter.ts` para estado de checkout.
- Mantener `PosCartStore`, `PosSaleService` y helpers puros.

### H2 — Repositories Angular no implementan consistentemente Repository + Result

**Evidencia**

- El contrato de dominio `ProductRepository` devuelve `Promise<Result<...>>`: `src/modules/products/domain/repositories/product.repository.ts:14`.
- `ProductsRepository` Angular devuelve entidades directas y lanza errores tecnicos: `apps/pos-angular/src/app/features/products/products.repository.ts:41`, `apps/pos-angular/src/app/features/products/products.repository.ts:59`, `apps/pos-angular/src/app/features/products/products.repository.ts:76`.
- `InventoryRepository` de dominio tambien exige `Result`: `src/modules/inventory/domain/repositories/inventory.repository.ts:34`.
- `InventoryRepository` Angular devuelve numeros/entidades directas y hace `throw`: `apps/pos-angular/src/app/features/inventory/inventory.repository.ts:64`, `apps/pos-angular/src/app/features/inventory/inventory.repository.ts:75`, `apps/pos-angular/src/app/features/inventory/inventory.repository.ts:143`.

**Riesgo**

La capa Angular queda acoplada a errores tecnicos y no puede sustituirse facilmente por implementaciones in-memory o mocks con el mismo contrato.

**Recomendacion**

PLAN P1: adaptar repositorios Angular para implementar interfaces de dominio o crear adapters que conviertan Supabase -> `Result<T,E>` y errores tipados. Mantener `throw` solo para fallos tecnicos inesperados, no para errores de negocio.

### H3 — Falta cobertura E2E automatizada

**Evidencia**

- `tests/e2e` solo contiene `.gitkeep`.
- `corepack pnpm test:e2e` devuelve `Error: No tests found`.
- Playwright esta configurado con server local reutilizable: `playwright.config.ts:7`, `playwright.config.ts:15`.

**Recomendacion**

PLAN P1: crear specs Playwright minimos para login, caja abierta, venta, anulacion, inventario PV/Bodega y reportes stock. El flujo manual ya probado debe convertirse en E2E estable con datos semilla controlados.

### H4 — Importador Siigo concentra parser, validacion, unicidad y mappers

**Evidencia**

- 604 lineas en `src/modules/products/import/siigo-csv.ts`.
- El propio header enumera multiples responsabilidades: `src/modules/products/import/siigo-csv.ts:4`.
- Validacion de fila extensa: `src/modules/products/import/siigo-csv.ts:334`.
- Validacion cross-row: `src/modules/products/import/siigo-csv.ts:484`.
- Mappers a payloads: `src/modules/products/import/siigo-csv.ts:562`, `src/modules/products/import/siigo-csv.ts:587`.

**Recomendacion**

Dividir en P1:

- `csv-parser.ts`.
- `siigo-header.ts`.
- `siigo-row.parser.ts`.
- `siigo-duplicates.validator.ts`.
- `siigo-import.mapper.ts`.

Mantener el modulo puro sin Node/Supabase.

### H5 — Reportes y caja estan cerca del limite operativo de mantenibilidad

**Evidencia**

- `reportes.page.ts` tiene 409 lineas y combina tabs, reporte diario, stock, tablas y carga: `apps/pos-angular/src/app/features/reports/reportes.page.ts:37`, `apps/pos-angular/src/app/features/reports/reportes.page.ts:318`.
- `caja.page.ts` tiene 338 lineas y combina apertura, resumen, movimientos, breakdown y orquestacion: `apps/pos-angular/src/app/features/cash-register/caja.page.ts:22`, `apps/pos-angular/src/app/features/cash-register/caja.page.ts:267`.
- `close-session.dialog.ts` tiene 312 lineas y combina formulario, calculos de diferencias y persistencia: `apps/pos-angular/src/app/features/cash-register/close-session.dialog.ts:79`, `apps/pos-angular/src/app/features/cash-register/close-session.dialog.ts:255`.

**Recomendacion**

PLAN P2: dividir visualmente antes de que crezcan mas:

- Reportes: `daily-report-panel`, `stock-report-table`, `cash-closures-table`.
- Caja: `open-cash-session-form`, `cash-summary-panel`, `cash-movements-list`.
- Cierre: extraer presenter y helper de filas de cierre.

---

## Hallazgos medios

### M1 — Formularios de negocio no usan siempre el patron factory/mapper/presenter

**Evidencia**

- Producto si sigue el patron con presenter y Zod: `apps/pos-angular/src/app/features/products/product-form.presenter.ts:1`.
- Entrada de inventario define `FormGroup` inline y mapea en el dialogo: `apps/pos-angular/src/app/features/inventory/register-entry.dialog.ts:104`, `apps/pos-angular/src/app/features/inventory/register-entry.dialog.ts:138`.
- Ajuste de inventario igual: `apps/pos-angular/src/app/features/inventory/adjust-stock.dialog.ts:114`, `apps/pos-angular/src/app/features/inventory/adjust-stock.dialog.ts:157`.
- Movimiento de caja no usa DTO Zod; solo validadores Angular y cast: `apps/pos-angular/src/app/features/cash-register/add-movement.dialog.ts:95`, `apps/pos-angular/src/app/features/cash-register/add-movement.dialog.ts:132`.

**Recomendacion**

PLAN P2: estandarizar formularios de inventario/caja con factory + mapper + presenter. Prioridad: `add-movement`, `register-entry`, `adjust-stock`, `transfer-stock`, `close-session`.

### M2 — `Result` existe, pero los errores de dominio siguen siendo `Error` generico

**Evidencia**

- `Result<T,E = Error>` default: `src/shared/result.ts:1`.
- `createSaleUseCase` retorna `Promise<Result<Sale>>`: `src/modules/sales/application/use-cases/create-sale.use-case.ts:38`.
- Errores de negocio se modelan como `new Error(...)` dentro de `err(...)`: `src/modules/sales/application/use-cases/create-sale.use-case.ts:41`, `src/modules/sales/application/use-cases/create-sale.use-case.ts:54`, `src/modules/sales/application/use-cases/create-sale.use-case.ts:96`.

**Recomendacion**

PLAN P2: definir errores discriminados por modulo (`SaleError`, `InventoryError`, `CashRegisterError`) y retornar `Result<T, ModuleError>`.

### M3 — Hay muchas carpetas placeholder vacias

**Evidencia**

`find src/modules apps/pos-angular/src/app -type d -empty` encontro carpetas vacias como `src/modules/auth/application/dtos`, `src/modules/billing/application/use-cases`, `src/modules/payments/domain/entities`, `src/modules/products/infrastructure/adapters`, `src/modules/reports/domain/entities` y `src/modules/sales/infrastructure/adapters`.

**Riesgo**

La estructura parece mas completa de lo que esta realmente y aumenta ruido para agentes/maintainers.

**Recomendacion**

PLAN P3: eliminar placeholders sin uso o agregar `README.md`/convencion que explique que son slots intencionales. Preferible crear carpetas cuando exista el primer archivo real.

### M4 — Documentacion fuente y documentacion historica aun se mezclan

**Evidencia**

- `README.md` declara Next.js 15, Vercel y shadcn: `README.md:11`, `README.md:12`, `README.md:13`.
- `docs/standards/solid-principles.md` aun dice "Next.js + Supabase": `docs/standards/solid-principles.md:3`.
- `docs/04-roadmap.md` todavia lista Vercel/Next/shadcn como pendientes: `docs/04-roadmap.md:30`.
- ADR historicos mantienen referencias legacy, lo cual esta bien si quedan como historico; ejemplo `docs/adr/0001-stack-supabase.md:1`.

**Recomendacion**

PLAN P2 documental: actualizar README, solid-principles, roadmap y glosario a Angular. Mantener docs historicas en `docs/sessions/` y ADRs viejos sin reescribir hechos pasados, pero marcar "superseded by ADR 0006" donde aplique.

### M5 — La estructura documentada aun menciona `environments/`, pero la app usa runtime config

**Evidencia**

- `docs/02-architecture.md` lista `apps/pos-angular/src/environments/`: `docs/02-architecture.md:158`, `docs/02-architecture.md:202`, `docs/02-architecture.md:264`.
- En el repo no existe `apps/pos-angular/src/environments`.
- Config actual carga `/runtime-config.json`: `apps/pos-angular/src/app/core/config/app-config.service.ts:18`.
- `.gitignore` protege `apps/pos-angular/public/runtime-config.json`: `.gitignore:22`.

**Recomendacion**

Actualizar `docs/02-architecture.md` para declarar runtime config como patron oficial, o reintroducir `environments/` si se decide volver a ese modelo.

---

## Hallazgos bajos

### B1 — TODOs de codigo pendientes

**Evidencia**

- `apps/pos-angular/src/app/features/pos/sale-error-mapper.ts:5`.
- `apps/pos-angular/src/app/features/pos/pos.page.ts:814`.

**Recomendacion**

Convertir TODOs en tickets PLAN con criterio de cierre y dueño.

### B2 — `tests/unit/modules/products/siigo-csv.test.ts` supera 300 lineas

**Evidencia**

- 312 lineas.

**Recomendacion**

Excepcion aceptable por ser test de matriz amplia. Aun asi, al dividir `siigo-csv.ts`, considerar mover fixtures/cases a helpers.

---

## Matriz de cumplimiento por estandar

| Estandar | Estado | Evidencia |
|---|---|---|
| Stack activo Angular/Supabase | Cumple | `package.json` no contiene Next/React/RHF/Zustand/shadcn; Angular 21 y Supabase JS activos. |
| Dominio TS puro | Cumple | Busqueda de imports Angular/Supabase en `src/modules` no encontro dependencias runtime prohibidas; solo comentarios y tipos puros. |
| `application` no depende de `infrastructure` | Cumple | Imports de use-cases revisados apuntan a `domain`, `dtos`, `shared`; ejemplo `src/modules/sales/application/use-cases/create-sale.use-case.ts:1`. |
| Repository Pattern | Parcial | Interfaces devuelven `Result`, pero repos Angular devuelven entidades directas y lanzan errores. |
| Adapter/Mapper Pattern | Parcial | Mappers existen en `src/modules/*/infrastructure/mappers`; adapters aun son placeholders vacios en varios modulos. |
| Result Pattern | Parcial | Existe `src/shared/result.ts`, use-cases lo usan; faltan errores discriminados por modulo. |
| Zod en bordes | Parcial | DTOs y varios presenters validan con Zod; algunos dialogs usan solo Angular Validators/casts. |
| Angular standalone + OnPush | Cumple | Scan encontro `standalone: true` y `ChangeDetectionStrategy.OnPush` en paginas, dialogs y shared UI principales. |
| Supabase directo fuera de componentes | Cumple con observacion | Supabase directo esta en core/services/repos; no se detectaron componentes page hablando directo con Supabase. |
| Escrituras criticas por RPC | Cumple parcial | Venta/anulacion/cierre/traslado por RPC; productos/inventario entry/adjust siguen directos y requieren rol/RLS mas fuerte. |
| Seguridad de secretos | Cumple parcial | `.codex/`, `.mcp.json`, `.env*.local` y runtime config local ignorados; service role solo aparece en scripts/docs. Falta rol en RLS de mutaciones admin. |
| Legacy stack activo | Cumple | No hay deps activas Next/React/RHF/Zustand/shadcn; quedan referencias documentales. |

---

## Archivos mayores a 300 lineas

| Archivo | Lineas | Clasificacion | Accion recomendada |
|---|---:|---|---|
| `src/infrastructure/supabase/database.types.ts` | 1069 | Excepcion aceptada | Generado por Supabase; no dividir manualmente. |
| `apps/pos-angular/src/app/features/pos/pos.page.ts` | 859 | Deuda P1 | Dividir en catalogo, carrito, checkout dialog/presenter y shell de pagina. |
| `src/modules/products/import/siigo-csv.ts` | 604 | Deuda P1 | Dividir parser, header, row parser, duplicates validator y mapper. |
| `apps/pos-angular/src/app/features/reports/reportes.page.ts` | 409 | Deuda P2 | Extraer paneles/tablas y presenter de carga. |
| `supabase/migrations/20260528_001_shared_cash_session_per_store.sql` | 404 | Excepcion aceptada | Migracion historica versionada; no reescribir. |
| `supabase/migrations/20260529_002_inventory_location_rpcs.sql` | 374 | Excepcion aceptada | Migracion historica versionada; no reescribir. |
| `apps/pos-angular/src/app/features/cash-register/caja.page.ts` | 338 | Deuda P2 | Extraer apertura, resumen y movimientos. |
| `tests/unit/modules/products/siigo-csv.test.ts` | 312 | Excepcion relativa | Test extenso aceptable; extraer fixtures si crece. |
| `apps/pos-angular/src/app/features/cash-register/close-session.dialog.ts` | 312 | Deuda P2 | Extraer presenter/helper de filas de cierre. |

---

## Deuda de arquitectura y desacoplamiento

- La direccion de dependencias en `src/modules` se conserva bien.
- La capa Angular actua como infraestructura real, pero sus repositories no estan alineados a los contratos de dominio.
- Hay logica de orquestacion importante en paginas/dialogos Angular, especialmente POS, reportes y caja.
- Falta una politica consistente para convertir errores Supabase a errores de dominio/aplicacion.
- Los formularios estan a medio camino entre el patron recomendado y forms inline.

---

## Riesgos de seguridad y datos

| Riesgo | Severidad | Estado |
|---|---|---|
| Cajero autenticado podria mutar productos/inventario si invoca APIs directas tenant-only | Critica | Requiere RLS/RPC por rol. |
| Descuento por rol no aplicado en POS real | Critica | Requiere validacion server-side o approval token. |
| Service role en bundle Angular | Baja | No detectado. Service role aparece solo en scripts/docs. |
| Secretos locales trackeados | Baja | `.codex/`, `.mcp.json`, `.env*.local` y runtime-config local ignorados. |
| Transferencias de inventario no admin | Baja | Controladas en UI y RPC admin-only. |
| Venta/anulacion/cierre no transaccionales | Baja | Cubiertas por RPCs. |

---

## Plan de remediacion por fases

### P0 — Seguridad y reglas de negocio

1. Endurecer RLS/RPC para mutaciones admin-only de productos, categorias e inventario.
2. Mover autorizacion de descuentos a servidor o token de aprobacion auditado.
3. Agregar tests SQL/pgTAP de rol `cajero` contra productos/inventario/descuentos.

### P1 — Arquitectura base y E2E

1. Dividir `pos.page.ts`.
2. Alinear repositorios Angular con interfaces de dominio y `Result`.
3. Crear E2E Playwright minimo de flujo caja -> venta -> anulacion -> inventario -> reportes.
4. Dividir `siigo-csv.ts`.

### P2 — Consistencia UI/forms y docs

1. Refactor de `reportes.page.ts`, `caja.page.ts`, `close-session.dialog.ts`.
2. Migrar dialogs de inventario/caja al patron factory/mapper/presenter.
3. Tipar errores de dominio por modulo.
4. Actualizar README, `solid-principles`, roadmap/glosario y estructura runtime config.

### P3 — Limpieza y ergonomia

1. Quitar o documentar carpetas placeholder vacias.
2. Extraer fixtures de tests Siigo si crecen.
3. Convertir TODOs restantes en PLANs auditables.

---

## Checks ejecutados

```bash
bash scripts/session-start.sh
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm test
corepack pnpm test:e2e
```

Resultados:

- `typecheck`: OK. Build development genero `dist/pos-angular`.
- `lint`: OK.
- `test`: OK, 299 tests.
- `test:e2e`: NOK, no hay specs Playwright.

Checks no mutantes:

- Conteo de lineas por archivo.
- Busqueda de imports prohibidos Angular/Supabase en `src/modules`.
- Busqueda de Supabase directo fuera de services/repos/core.
- Busqueda de `any`, `TODO`, `FIXME`, `throw new Error`.
- Busqueda de stack legacy activo en `package.json`, lockfile y codigo.

Resultado notable:

- No se encontraron `any` en `src`, `apps` o `tests` TypeScript.
- No se encontro stack legacy activo en dependencias/codigo.
- La deuda legacy restante es documental.
