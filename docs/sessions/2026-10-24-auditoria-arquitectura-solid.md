# Spec de Sesión — 2026-10-24 — Auditoría de arquitectura, componentización, SOLID y crecimiento

## Metadatos

| Campo | Valor |
|---|---|
| Fecha | 2026-10-24 |
| Sprint | Mantenimiento |
| Agente | Claude Code |
| HUs trabajadas | Ninguna (auditoría, solo lectura) |
| Estado | Completada — diagnóstico; correcciones pendientes de priorizar con el dueño |

## 1. Objetivo

Revisar el estado del proyecto contra ADR 0015 (arquitectura feature-first), ADR 0014 + `docs/standards/` (componentes y formularios), principios SOLID y las reglas de datos de CLAUDE.md §2.2, y proponer mejoras priorizadas.

## 2. Método

Métricas propias + tres auditorías de solo lectura en paralelo (fronteras de arquitectura; componentización/UI; SOLID + datos + crecimiento). Los hallazgos de severidad alta se verificaron a mano en el código y, para los de base de datos, contra el Supabase de producción con consultas de solo lectura a `pg_policies`, privilegios y triggers.

Volumen real (2026-10-24): 144 productos activos, 2.395 ventas, 3.325 movimientos de inventario, 1 tienda, 0 usuarios con más de una tienda.

## 3. Lo que está bien

- Dominio puro: ningún `features/*/domain` importa Angular, RxJS, Supabase ni `database.types`. Ninguna presentation inyecta clases de `data/`.
- 10 de 12 features con composition root registrado; `auth` y `pos` sin `data/` (coherente).
- 88 componentes: todos standalone, prefijo `mo-`, API de signals; 0 `@Input/@Output`; 0 `any`, `@ts-ignore` o `eslint-disable`.
- Los 36 use-cases tienen tests (768 tests en verde). Use-cases dependen de `Pick<Repo,…>` (buen ISP/DIP).
- RLS activo en todas las tablas; todas las funciones SECURITY DEFINER fijan `search_path`; no hay service role en el cliente.

## 4. Hallazgos priorizados

### P0 — Seguridad e integridad de datos (verificado en producción)

1. **Ventas, pagos, items, movimientos de caja y auditoría se pueden borrar o reescribir desde el cliente.** En remoto, `sales`, `sale_items`, `payments`, `cash_movements` y `audit_logs` solo tienen `tenant_isolation FOR ALL`, y `authenticated` tiene `UPDATE`/`DELETE`; ningún trigger lo impide. Cualquier cajero con la anon key y su sesión puede borrar ventas o limpiar `audit_logs` vía PostgREST. Rompe "las ventas no se borran físicamente". **Fix:** policies solo `SELECT`, `revoke insert, update, delete … from authenticated`; escrituras solo por RPC `*_atomic`; `audit_logs` insert-only desde RPC/trigger. Antes, inventariar qué flujos escriben directo (ver 2–3).
2. **Ajustes de stock insertados directo** (`inventory.repository.ts` `adjustStock`): el cliente elige `tipo`, `referencia` y `created_by`. **Fix:** RPC `adjust_stock_atomic`.
3. **Movimientos de caja insertados directo** (`cash-register.repository.ts:180-196`): RLS no exige sesión `open` → se pueden añadir a una caja cerrada y descuadrarla. **Fix:** RPC `add_cash_movement_atomic`.
4. **Borrado físico de clientes** (`customers.repository.ts:150`): arrastra en cascada el historial de fidelización. **Fix:** soft delete.

### P1 — Riesgos operativos cercanos

5. **Catálogo del POS cortado a 200 productos** (`products.repository.ts:131`, usado por `core/catalog/products-cache.store.ts:50`). Hoy hay 144 (72 %); al pasar de 200 los productos desaparecen del POS sin aviso. **Fix:** paginar el caché; el límite solo para búsqueda.
6. **Crear venta fuera del dominio**: `pos/presentation/services/pos-sale.service.ts:104-195` inyecta `SupabaseClientService`, llama `create_sale_atomic` y audita; sin use-case ni tests. **Fix:** `SaleRepository.create` + `createSale` use-case en `sales/domain`, con tests.
7. **Supabase crudo en presentation**: `pos-data.service.ts:163,175,192` (componentes, opciones, sesión de caja), sin paginar (tope 1000 de PostgREST). **Fix:** reutilizar `ProductRepository` / `CashRegisterRepository`.
8. **Recetas y opciones guardadas en varias peticiones** (`products.repository.ts:356-423`, delete+insert): un fallo a mitad deja el producto sin receta. **Fix:** RPC atómicas.
9. **Idempotencia de venta solo en memoria** (`pos-cart.store.ts:90`): si se recarga antes de la respuesta, la venta se duplica. Cierre de caja y gastos no tienen clave. **Fix:** persistir la clave en `sessionStorage`; aceptar "ya cerrada por mí" como éxito.

### P2 — Arquitectura (ADR 0015)

10. **La regla del linter es más laxa que la documentada.** CLAUDE.md y ADR 0015 dicen "ninguna feature importa de otra salvo pos→sales/domain"; `eslint.config.js` permite `domain/`, `data/repositories` y `presentation/dialogs|components` de cualquier feature. Hay **24 pares de dependencias entre features** (p. ej. pos→sales 13, reports→loyalty 7, customers↔loyalty en ciclo). **Decisión del dueño:** endurecer el lint o actualizar el ADR a la regla real. Recomendación: actualizar ADR/CLAUDE.md a la regla real y prohibir solo presentation→presentation y los ciclos, moviendo `Cliente`/`LoyaltyConfig` a `src/shared`.
11. **Use-cases sin `Result` ni Zod**: `delete-customer`, `delete-template`, `delete-product`, `deactivate-product`, `deactivate-categoria`, `save-product-components`, `expire-rewards`; con Zod pero lanzando: `adjust-stamps`, `save-receipt-settings`, `save-loyalty-settings`.
12. **42 casts `as unknown as`** con fachadas `UntypedClient`/`RpcClient` repetidas en ~9 archivos, aunque los tipos existen en `database.types.ts`. **Fix:** `TablesInsert<>` / `Database['public']['Functions']`; regenerar tipos (`storefront_contact_settings` falta).
13. **Escritura a Storage sin use-case** (`product-image-field.component.ts:156`); `core/printing/receipt-print.service.ts:87` lee `clientes` directo.

### P2 — Componentización (ADR 0014 / standards)

14. **Archivos gigantes:** `pos.page.ts` 1.639 líneas (con reglas de negocio de descuento, `canConfirm` y vista previa de sellos), `product-form.dialog.ts` 912, `sales-history.dialog.ts` 844, `caja.page.ts` 704. Propuesta de división:
    - **pos.page** → `pos-catalog`, `pos-cart-panel` (+ `pos-cart-customer-card`, `pos-cart-item-row`), `pos-checkout.dialog` sobre `mo-dialog`, y stores `pos-checkout.store`, `pos-loyalty.store`, `pos-receipt-output.service`; reglas a `sales/domain/services`.
    - **product-form** → `product-combo-components`, `product-options-editor`, `product-initial-stock-section`.
    - **sales-history** → `summary`, `filters`, `row` (reutilizando `mo-sale-detail-list`, hoy duplicado), `sales-history-actions.service`.
    - **caja.page** → `open-session-form`, `cash-session-summary`, `cash-movements-table`, `cash-turn-sales`.
15. **Catálogo del design system sin usar:** skeleton inline en 13 archivos (`mo-skeleton` solo en 2); 8 `<table>` sin `moTable`; ~39 botones crudos; 20 SVG inline aunque `lucide-angular` está instalado; modal de cobro hecho a mano (`pos.page.ts:542`).
16. **Formularios fuera del patrón** (sin factory/mapper/presenter, con `Validators` de Angular en vez de Zod): 10 diálogos de caja, inventario y POS; otros 5 sin presenter (gastos, fidelización).
17. **Lógica duplicada:** `money()` copiado 27 veces (→ `MoneyPipe`), `paymentLabel` 6, `paymentFilterClass` 3, fecha "hoy en zona de la tienda" en 5 sitios; `auditoria.page.ts:15-26` ignora la zona horaria de la tienda.

### P3 — Crecimiento (no urgente al volumen actual)

18. Reportes y desglose de pagos agregan en el navegador (`reports.repository.ts:56-137`); `loyalty-report` sin rango ni paginación (corte silencioso a 1.000 filas). → RPC de resumen.
19. `get_stock_levels` suma todo el ledger en cada lectura → saldos materializados cuando crezca.
20. Selección de tienda con `.limit(1)` sin orden (`session.service.ts:162`); hoy nadie tiene >1 tienda.
21. RPC anónima `storefront_club_progress` permite enumerar celulares y no filtra por tienda.
22. Pendientes de la auditoría DB 2026-09-04: índices en FKs, índice duplicado `ix_billing_docs_sale`, 9 RPC DEFINER sin revisión a fondo.
23. Tests: sin tests del flujo de venta, del carrito, de `session.service` ni de componentes Angular; `tests/integration/` vacío; sin pgTAP de casos de denegación RLS.

## 5. Próximos pasos sugeridos (orden)

1. **P0 #1–3** en una sola migración + RPCs, con pgTAP en local que pruebe la denegación como `authenticated` (cajero) antes de aplicar a remoto.
2. **P1 #5** (corte de 200) y **#6–7** (venta y datos del POS al dominio) — este último habilita dividir `pos.page.ts`.
3. Decidir la regla de dependencias entre features (#10) y alinear ADR/eslint.
4. Componentización incremental, empezando por `MoneyPipe`, `mo-page-skeleton`/`mo-skeleton`, `mo-segmented` y la división de `pos.page.ts`.

## 6. Notas

Sin cambios de código en esta sesión. Consultas remotas solo de lectura (`pg_policies`, `has_table_privilege`, `pg_trigger`, conteos).

## 7. Implementación P0 #1 y #3 (misma fecha, autorizada por el dueño)

- `20261024000200_cash_movement_and_expense_rpcs.sql` (paso 1, no rompe nada): RPC `add_cash_movement_atomic` (usuario activo de la tienda, sesión `open`, `created_by = auth.uid()`, motivo 3–200) y `register_expense_atomic` pasa de INVOKER a DEFINER con chequeo de admin y de pertenencia de categoría/empleado (antes lo garantizaba RLS).
- `20261024000300_lock_direct_writes_sales_cash_audit.sql` (paso 2): `tenant_isolation FOR ALL` → `<tabla>_select` (misma condición, copiada de `pg_policies`) en `sales`, `sale_items`, `payments`, `sale_counters`, `cash_movements`, `cash_sessions`, `audit_logs`; `revoke insert/update/delete/truncate` en las de ventas y `cash_movements`; `cash_sessions` solo `INSERT` de sesión abierta propia; `audit_logs` append-only con `user_id = auth.uid()`.
- Inventario previo: único INVOKER que escribía estas tablas era `register_expense_atomic`; el resto son DEFINER. El cliente solo escribía directo `cash_sessions` (apertura), `cash_movements` (→ ahora RPC) y `audit_logs` (insert, compatible).
- Frontend: `CashRegisterRepository.addMovement` usa la RPC.
- pgTAP `supabase/tests/lock-direct-writes.test.sql` (28): denegaciones como cajero (borrar/editar ventas, pagos, items, correlativo, auditoría, sesiones; insertar pagos/movimientos; sesión cerrada forjada; auditoría suplantada), RPC de movimientos (caja cerrada, suplantación, otra tienda), gasto cajero vs admin, y ciclo crear venta → corregir pago → anular vía RPC. **Control negativo:** con el estado remoto simulado en local falla 17/28; con 000200+000300 pasa 28/28.
- Pruebas pgTAP preexistentes que ya fallaban (no relacionadas): `sale*.test.sql` y `cash-session-shared` llaman `create_sale_atomic` con firma vieja; `sale-discount` compara decimales; `cashier-loyalty-adjustment` requiere `20261010…` no aplicada en local.
- `pnpm lint`, `pnpm test` (768) y typecheck OK.
- **Desplegado en producción (autorizado por el dueño):** 000200 aplicada y registrada → merge `dev→main` `42534ed` (commit-tree, sin tocar el árbol de trabajo compartido con la sesión iOS) → Netlify `moveon-client` `6adcde8af5ab53ff6233ce4e` y `moveon-catalogo-web` `6adcde8a1d03bbad975e419c` ready, bundle con `add_cash_movement_atomic` → 000300 aplicada y registrada. Verificado en remoto: las 5 tablas de ventas/caja sin INSERT/UPDATE/DELETE para `authenticated`; `cash_sessions` y `audit_logs` solo INSERT; anon REST: `GET sales` → `[]`, `DELETE` → 401. Riesgo residual: una pestaña del POS abierta con el bundle viejo falla al registrar un movimiento manual hasta recargar.
- Pendiente P0: #2 ajustes de stock (`adjust_stock_atomic`) y #4 soft delete de clientes.

## 8. Implementación P0 #2 y #4 (misma fecha)

- `20261024000400_stock_adjustment_and_customer_soft_delete_rpcs.sql` (aditiva): `adjust_stock_atomic` (admin, motivo 3–200, delta ≠ 0, no `prepared`/`combo`, `FOR UPDATE` del producto; audita el trigger existente); `clientes.deleted_at/deleted_by` + `delete_customer_atomic` (cualquier usuario activo, como antes; `activo = false`; audita `customer.deleted`); índices únicos de celular/documento parciales (`deleted_at is null`, mismos nombres); trigger `sales_enforce_customer_not_deleted`.
- `20261024000500_lock_inventory_adjustments_and_customer_delete.sql`: sin escritura directa en `inventory_movements` (se elimina `inventory_movements_admin_insert`); `clientes` sin `DELETE` y con `INSERT`/`UPDATE` solo en columnas del formulario.
- Frontend: `InventoryRepository.adjustStock` y `CustomersRepository.delete` usan las RPC; `list`/`findOne` de clientes filtran eliminados.
- pgTAP `stock-adjustment-customer-soft-delete.test.sql` (23). Control negativo: con solo el paso 1 falla 12/23; con ambos pasa 23/23. Resto de suites sin regresión (mismas 5 preexistentes fallando).
- `pnpm lint`, `pnpm test` (768), typecheck OK.
- Decisión: no se añadió bloqueo de stock negativo en ajustes (sería una regla de negocio nueva); `adjust_loyalty_stamps` no rechaza clientes eliminados, pero la UI ya no los lista.
- **Desplegado en producción (autorizado por el dueño):** 000400 aplicada y registrada (RPC DEFINER sin `anon`, columnas, índices parciales, trigger; 0 clientes eliminados) → merge `dev→main` `ffafa4d` → Netlify `moveon-client` `6adce150be2cd6add2a6e9ef` y `moveon-catalogo-web` `6adce1503f5447d33427934d` ready, bundle con `adjust_stock_atomic` y `delete_customer_atomic` → 000500 aplicada y registrada. Verificado: `inventory_movements` solo `SELECT`; `clientes` sin `DELETE`, sin `UPDATE`/`INSERT` de `deleted_at`/`activo`, con edición del formulario intacta.
- El merge incluyó 3 commits de solo documentación de la sesión iOS (`4497130`, `385d2dc`, `7970dff`: ADR 0021, plan PLAN-75..84, PLAN-77) que ya estaban en `dev`; no afectan el build web.
- Riesgo residual: una pestaña abierta con el bundle anterior falla al ajustar stock o eliminar cliente hasta recargar.
- **P0 de la auditoría completo.**

## 9. P1 #5 — corte de 200 productos (misma fecha)

- `products.repository.ts#listProducts`: sin término → `fetchAllPages` con builder nuevo por página y orden estable (`nombre`, `id`); con término → tope `PRODUCT_SEARCH_LIMIT = 200`. Ningún llamador usaba búsqueda por término; los 4 (caché del POS/productos, inventario, reportes) quedaban truncados a 200.
- Test con el repositorio real en node (`Injector.create` + `runInInjectionContext` + `@angular/compiler`, primer test de repositorio sin TestBed) y builder PostgREST falso: 250 y 2.300 productos, y búsqueda saneada con tope. Control negativo: con el código anterior fallan 2/3.
- `pnpm lint`, `pnpm test` (771), typecheck OK. Solo frontend, sin migración. Sin publicar.

## 10. P1 #6 — crear venta en el dominio (misma fecha)

- Nuevo `sales/domain/usecases/create-sale.use-case.ts` (`createSale`): valida con `createSaleSchema` (reescrito con el contrato real; el anterior estaba desactualizado y solo lo usaban sus tests), resuelve canjes `itemKey → itemIndex` y persiste por `SaleRepository.create`. Rechazo de la RPC → `Result` `remote` (es un resultado esperado del cobro, no fallo técnico).
- `SaleRepository.create` + `CreateSaleRequest` en el contrato; `SalesRepository.create` (sales/data) concentra la llamada a `create_sale_atomic` y la auditoría, con los mismos argumentos que antes.
- `PosSaleService` queda como adaptador: sin Supabase ni auditoría; mapea `PosCartItem` al DTO, inyecta la abstracción `SaleRepository` (pos → sales/domain, excepción permitida) y traduce el error con `mapSaleError`. API pública intacta: `pos.page.ts` sin cambios.
- Tests: use-case (5), contrato exacto de argumentos de la RPC + auditoría + error (3), DTO actualizado. `docs/modules/sales.md` alineado con el código real.
- `pnpm lint`, `pnpm test` (780), typecheck OK. Sin publicar (se publica junto con #5).

## 11. Prueba real en local y publicación de P1 #5 + #6 (autorizado por el dueño)

- Supabase local al día: se registraron en `schema_migrations` local las migraciones aplicadas a mano con psql y `supabase migration up --local --include-all` dejó todas las del repo registradas. Seed local: 2 productos con stock 10 (`QA-WHEY`, `QA-CREA`) y 2 clientes del club.
- POS con `pnpm dev:local` (runtime-config verificado en `127.0.0.1:54321` antes de iniciar sesión), en el navegador integrado:
  - Cajero: venta `V-000001` de $205.000 (Whey + Creatina, efectivo, con cliente) → `completed`, 2 ítems con `unit_cost`, pago correcto, stock 10→9, +2 sellos, auditoría `venta/create`. Aviso de QZ Tray esperado (sin impresora local).
  - Cajero: movimiento de caja $20.000 vía `add_cash_movement_atomic`; cuadre esperado $350.000 correcto.
  - Cajero: eliminar cliente → borrado lógico (`deleted_by` cajero, `activo=false`, `customer.deleted`), no reaparece al recargar.
  - Admin: ajuste −1 vía `adjust_stock_atomic` → stock 9→8, auditado por trigger.
  - Catálogo pedido con `offset=0&limit=1000` (paginación nueva). Consola: solo errores de QZ Tray y un 503 de arranque del servidor.
- Merge `dev→main` `d89ecf8` (incluye `e63c3e8`, solo docs iOS; el trabajo sin confirmar de la sesión iOS —`reports.repository.ts`, migración `20261024120000_owner_sales_summary.sql`— NO entró). Netlify `moveon-client` `6adce51129c2fc8fb032b77d` y `moveon-catalogo-web` `6adce5111852fc13c5e35014` ready; bundle con el schema de dominio de venta; rutas 200; runtime → Supabase POS.
- Nota: la prueba local corrió sobre el árbol de trabajo, que incluía el cambio sin confirmar de la sesión iOS en `reports.repository.ts` (no afecta los flujos probados).

## 12. P1 #7 — datos del POS por repositorio (misma fecha)

- `ProductRepository` gana `listComponentsByTienda` y `listActiveOptionsByTienda` (tipos `ProductComponentLink` / `ProductOptionLink`), implementados en `ProductsRepository` con `fetchAllPages` (antes las lecturas del POS no paginaban: tope silencioso de 1000 filas) y reutilizando los mappers existentes.
- `PosDataService` ya no inyecta `SupabaseClientService`: catálogo por `ProductsCacheStore` + `InventoryRepository` + `ProductRepository`, caja abierta por `CashRegisterRepository.getOpenSession`. Se eliminaron 3 fachadas `as unknown as` y sus tipos de fila.
- Tests: `pos-data-service.test.ts` (agrupación/orden de componentes y opciones, stock real/preparado/combo, costo oculto a cajero, caja abierta) y `tienda-wide-reads.test.ts` (paginación 1200 filas y mapeo).
- Prueba local en el navegador (runtime-config verificado en local): catálogo con batido "Bajo pedido", combo "8 disponibles" derivado (Creatina 8 / Whey 9) con sus componentes, batido agregado con su opción por defecto "Whey QA · +$3.000" (total $18.000), "Caja abierta".
- `pnpm lint`, `pnpm test` (792), typecheck OK. Sin publicar.
