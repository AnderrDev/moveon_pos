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

## 13. Publicación de P1 #7 (autorizado por el dueño)

- Merge `dev→main` `f876689`. Incluyó `829624f` de la sesión iOS (PLAN-78): refactor web de `reports.repository.ts` hacia la función pura `buildSalesSummary` (no llama a la RPC nueva), script `test:parity` y la migración `20261024120000_owner_sales_summary.sql`, **que NO está aplicada en el remoto** (`owner_sales_summary` no existe; versión no registrada) — queda pendiente de esa sesión/dueño.
- Verificado antes del push sobre el árbol exacto de `dev`: lint, 792 tests, build de producción; diff sin secretos.
- Netlify `moveon-client` `6adce6c2cd11ef8c0a82c1e0` y `moveon-catalogo-web` `6adce6c2da6e5fd93e7d5718` ready. Bundle sin la consulta directa vieja del POS y sin llamadas web a `owner_sales_summary`; `/`, `/pos`, `/reportes`, `/inventario`, `/catalogo` → 200; runtime → Supabase POS.

## 14. P1 #8 — recetas y opciones atómicas (misma fecha)

- `20261024000600_atomic_product_components_options_rpcs.sql` (aditiva): `save_product_components_atomic` y `save_product_options_atomic` (DEFINER, solo admin, validaciones de tienda/tipo/cantidades/repetidos/autorreferencia, auditoría).
- `20261024000700_lock_direct_product_components_options_writes.sql`: elimina las policies `pc_admin_*`/`po_admin_*` de escritura y revoca INSERT/UPDATE/DELETE.
- **Bug encontrado y reproducido** con el upsert actual del cliente: marcar como predeterminada una opción que va antes en la lista que la predeterminada vigente falla con `ux_product_options_default` (el índice parcial se valida fila a fila). La RPC libera los defaults antes del upsert.
- `ProductsRepository.saveComponents/saveOptions` → una RPC cada uno; se recortaron las fachadas de escritura sin uso.
- pgTAP 28/28 (control negativo: con solo 000600 fallan únicamente las 2 de escritura directa). Test unitario del contrato de argumentos (3). `pnpm lint`, `pnpm test` (795), typecheck OK.
- UI local como admin: batido → default "Sin proteína" y de vuelta a "Whey QA" (caso del bug), ambos "Producto actualizado" vía RPC; combo intacto.
- **Desplegado en producción (autorizado por el dueño):** 000600 aplicada y registrada (RPC DEFINER, sin `anon`) → merge `dev→main` `197bfde` (solo estos cambios) → Netlify `moveon-client` `6adce91ebc196545b7c64e2f` y `moveon-catalogo-web` `6adce91e6a4eac4036b67a91` ready, bundle con ambas RPC y sin el upsert viejo → 000700 aplicada y registrada. Verificado: `product_components`/`product_options` solo `pc_read`/`po_read` y sin INSERT/UPDATE/DELETE para `authenticated`. Riesgo residual: una pestaña con el bundle anterior falla al guardar recetas/opciones hasta recargar.

## 15. P1 #9 — idempotencia de venta, cierre y gastos (misma fecha)

- Decisión: NO persistir la clave de venta tal cual. El carrito no sobrevive a una recarga; reutilizar la clave con otro carrito haría que la RPC devolviera la venta anterior sin registrar la nueva. En su lugar, "venta en curso" en `sessionStorage` + consulta por clave al volver (`pending-sale.ts`, `SaleRepository.findByIdempotencyKey`). Se descarta solo al confirmar: postgrest no lanza en caídas de red y `mapSaleError` las vuelve genéricas, así que un error no se distingue de un rechazo.
- `20261024000800_idempotent_sale_and_expense.sql`: `create_sale_atomic` (mismo cuerpo que producción, md5 verificado) con la búsqueda por clave tras la validación de identidad/tienda y antes de exigir caja abierta, y manejo de `unique_violation`; `expenses.idempotency_key` + `ux_expenses_idempotency_key`; `register_expense_atomic` con `p_idempotency_key` (se elimina la firma anterior para evitar sobrecargas ambiguas en PostgREST; las llamadas sin clave siguen funcionando).
- Cierre de caja: idempotente en el cliente (sin tocar la RPC).
- Gastos: clave regenerada en cada apertura del diálogo — detectado que los diálogos se reutilizan entre aperturas; una clave fija por instancia habría devuelto el primer gasto en el segundo.
- `generateIdempotencyKey` movido a `src/shared/lib/idempotency-key.ts`. `database.types.ts` editado a mano con `p_idempotency_key` y `expenses.idempotency_key` (regenerar tras desplegar).
- pgTAP `idempotent-sale-expense.test.sql` 12/12; resto de suites sin cambios (mismas 5 preexistentes; `sale-discount` con los mismos fallos 4 y 8). Tests unitarios: venta en curso (4), cierre idempotente (2), gasto con clave (2). `pnpm lint`, `pnpm test` (803), typecheck OK.
- UI local: aviso "Venta registrada … (V-000001). No la cobres de nuevo." con una clave existente; "Venta sin registrar …" con una inexistente; venta real `V-000002` deja la venta en curso vacía.
- **Desplegado en producción (autorizado por el dueño):** md5 de `create_sale_atomic` remoto reverificado antes de aplicar → 000800 aplicada y registrada (búsqueda tras auth, manejo de carrera, una sola firma de `register_expense_atomic` sin `anon`, columna e índice de gastos; md5 remoto = local probado `57e366f2…`) → merge `dev→main` `f013dcb` (incluye `45b749a`, solo docs iOS) tras lint, 803 tests y build → Netlify `moveon-client` `6adcec6cf61227b31d4f1106` y `moveon-catalogo-web` `6adcec6c9cc524d721cc0f69` ready; bundle con venta en curso, clave de gastos y cierre idempotente; `/`, `/pos`, `/caja`, `/finanzas` → 200.
- Pendiente: regenerar `database.types.ts` con `pnpm db:types` (ya coincide con el remoto).
- **P1 de la auditoría completo.**

## 16. P2 — decisiones del dueño y bloque 1 (use-cases)

- **Decisiones:** (a) regla de dependencias = la real del linter + prohibir presentation→presentation fuera de `dialogs|components` y los ciclos entre features; (b) orden = dominio primero (use-cases, casts, upload) y después componentización.
- **Bloque 1:** los 11 use-cases señalados ahora validan con Zod y devuelven `Result` (`code: 'validation'`): `deleteCustomer`, `deleteTemplate`, `deleteProduct`, `deactivateProduct`, `deactivateCategoria`, `saveProductComponents`, `expireRewards`, `adjustStamps`, `saveReceiptSettings`, `saveLoyaltySettings`.
  - `entityRefSchema` compartido (`src/shared/validations/common.ts`) para los de id + tienda.
  - Reglas movidas al dominio como fuente única y reutilizadas por los formularios: `loyalty/domain/dtos/adjust-stamps.dto.ts`, `loyaltyConfigSchema` (junto a `LoyaltyConfig`), `settings/domain/dtos/receipt-settings.dto.ts`.
  - Los 8 llamadores con escritura manejan `result.ok` (antes un error de validación habría pasado como éxito). `expireRewards` sigue oportunista.
- Tests actualizados al contrato nuevo + casos de rechazo; `save-settings-use-cases.test.ts` nuevo. `pnpm lint`, `pnpm test` (814), typecheck OK. Sin cambios de base de datos.

## 17. P2 — bloques 2, 3 y 4

- **Bloque 2 (casts):** `database.types.ts` regenerado desde la base local (fuente: `supabase/migrations`; el remoto está desfasado, ver abajo). Un agente desarrollador quitó los 42 `as unknown as` de 11 archivos y las fachadas `UntypedClient`/`RpcClient`; nuevo `core/supabase/rpc-args.ts` (`rpcArgs`, solo tipos) para el `null` explícito que el generador no modela. Revisión propia: comparación mecánica contra HEAD de tablas, RPC, argumentos, filtros y selects (sin cambios de comportamiento). Quedan 4 casts simples justificados (`as Json`, `as Tables*`, `as PaymentMethod`). `daf2638`.
- **Bloque 3:** `validateProductImage` (dominio) + `uploadProductImage` (Result); el adaptador de Storage ya no valida y el componente no escribe directo (`4947b6e`). `core/printing` lee el cliente por `CustomerRepository.findById` (incluye eliminados: venta pasada) manteniendo la tolerancia de imprimir sin cliente (`885a973`).
- **Bloque 4 (regla de dependencias):** grafo real de features → 3 ciclos, no 1: `customers ↔ loyalty` (loyalty usa su `LoyaltyCustomerRef`), `cash-register ↔ reports` (`day-range` → `src/shared/lib/day-range.ts`), `inventory ↔ products` (inventario lee productos de `core/catalog` `ProductsCacheStore` con `force`, tipo `CatalogProduct`). Nuevo `tests/unit/architecture/feature-cycles.test.ts` (en `pnpm test`) con control propio. CLAUDE.md, ADR 0015 (§3 y §6.6) y `docs/02-architecture.md` actualizados a la regla decidida.
- Verificación: `pnpm lint`, `pnpm lint:landing`, `pnpm test` (821), typecheck de POS y landing OK. UI local: inventario con stock correcto, diálogo del club y ajuste +1 ("Nuevo saldo: 3").
- **Hallazgo — desfase de producción (no tocado):** el remoto no tiene `correct_sale_customer_atomic`, `storefront_club_progress` ni `storefront_contact_settings`; las migraciones `20260624000100`, `20260624000200`, `20260710000100`, `20260710000200`, `20260723010000`, `20260723020000` no están registradas. En producción fallan "asociar cliente a una venta ya cobrada" (POS) y "Mi Club" (catálogo); el contacto del catálogo usa el fallback. Pendiente desde 2026-08-12; requiere decisión del dueño.
- **Publicado (autorizado por el dueño):** merge `dev→main` `a4b79c7` tras lint POS+landing, 821 tests y build de producción de ambas apps; diff sin secretos. Incluyó de la sesión iOS `5da148e` (migración `20261024130000_owner_cash_session_summary.sql` + tests de integración, sin código web; la migración NO se aplica sola en remoto) y dos commits de docs. Netlify `moveon-client` `6adcf31c4f2ed8cfc22ca819` y `moveon-catalogo-web` `6adcf31cfd7cc1d6ad68def2` ready; bundle con las reglas nuevas; `/`, `/pos`, `/inventario`, `/productos`, `/clientes`, `/configuracion`, `/catalogo` y el catálogo → 200. Sin migraciones aplicadas en este paso.

## 18. Desfase de migraciones en producción — diagnóstico y propuesta (sin aplicar)

Comparación del registro remoto (`schema_migrations`) con `supabase/migrations/` y de cada objeto contra el remoto (solo lectura):

| Migración | Estado real en remoto | Acción propuesta |
|---|---|---|
| `20260624000100_catalogo_publico` | Hecha a mano: policies anon de categorías/productos y `update_updated_at_column` existen; `combos_semana` se creó y luego se eliminó a propósito (`20260904000100`) | **Solo registrar.** Ejecutarla resucitaría `combos_semana` y su semilla |
| `20260624000200_product_image_url` | Columna existe; 78 productos con imagen | **Solo registrar.** Su `UPDATE` pisaría las imágenes actuales con URLs viejas |
| `20260710000100_storefront_contact_settings` | **Falta la tabla** | **Aplicar** (semilla = WhatsApp/Instagram oficiales, tienda de producción `a1b2c3d4-…0001`) |
| `20260710000200_storefront_productos_publicos_sin_precios` | Vista existe sin `precio_venta`; anon sin SELECT en `productos` | **Solo registrar.** Su `DROP VIEW` desharía `security_invoker` y grants de 2026-08-29 |
| `20260716000100_loyalty_expire_sweep` | Aplicada como `20260717224803` | **Solo registrar** la versión del repo |
| `20260716000200_table_grants_parity` | Aplicada como `20260717224819` | **Solo registrar.** ⚠️ Ejecutarla de nuevo re-otorgaría INSERT/UPDATE/DELETE en todas las tablas y desharía en silencio todo el P0 |
| `20260723010000_correct_sale_customer_atomic` | **Falta la función** → falla "asociar cliente a venta ya cobrada" | **Aplicar** |
| `20260723020000_storefront_club_progress` | **Falta la función** → "Mi Club" caído | **Aplicar** (RPC anon decidida en ADR 0016: devuelve primer nombre y sellos por celular) |
| `20261010004041_allow_cashier_loyalty_adjustments` | Aplicada como `20261010005039` | **Solo registrar** |
| `20261024120000/130000/140000_owner_*` | No aplicadas | Fuera de alcance: sesión iOS |

**Riesgo actual:** un `supabase db push` hoy ejecutaría las 6 "solo registrar" y sería destructivo (permisos del P0, imágenes, vista, `combos_semana`).

**Prueba en local (dentro de una transacción con ROLLBACK, estado local intacto):** sobre un estado que imita producción (sin los 3 objetos), las 3 migraciones a aplicar corren limpias; anon lee el contacto; `storefront_club_progress('310 555 6677')` devuelve el progreso y un celular inexistente 0 filas; admin asocia cliente a una venta sin cliente (cajero recibe "Solo el admin…", diseño de la migración).

**Propuesta (dos pasos, cada uno en una transacción con su verificación):**
1. **Registrar sin ejecutar** las 6 versiones ya satisfechas (`20260624000100`, `20260624000200`, `20260710000200`, `20260716000100`, `20260716000200`, `20261010004041`). Solo inserta filas en `supabase_migrations.schema_migrations`; las filas remotas con otro timestamp se conservan. Efecto: `migration list` alineado y `db push` deja de ser destructivo.
2. **Aplicar y registrar** `20260710000100`, `20260723010000`, `20260723020000` (aditivas; el frontend publicado ya las espera). Verificar: objetos y grants, REST anon de contacto y de `storefront_club_progress` con un celular inexistente (`[]`), y "Mi Club"/contacto en el catálogo publicado.

**Ejecutado (autorizado por el dueño):**
- **Paso 1:** registradas sin ejecutar `20260624000100`, `20260624000200`, `20260710000200`, `20260716000100`, `20260716000200`, `20261010004041`. Verificado: 6/6 registradas; `combos_semana` sigue sin existir; 78 productos con imagen; `authenticated` sigue sin DELETE en `sales` ni INSERT en `inventory_movements` (P0 intacto).
- **Paso 2:** aplicadas y registradas en una transacción `20260710000100`, `20260723010000`, `20260723020000`. Verificado: `storefront_contact_settings` con RLS, 4 policies y 1 fila (contacto oficial); `correct_sale_customer_atomic` DEFINER, authenticated sí / anon no; `storefront_club_progress` DEFINER, anon sí, PUBLIC revocado. REST anon: contacto devuelve WhatsApp/Instagram oficiales; club con celular inexistente → `[]`; `correct_sale_customer_atomic` como anon → 404. Catálogo publicado: `storefront_contact_settings` → 200 (antes PGRST205 y fallback).
- Estado final del registro: solo quedan pendientes en remoto `20261024120000/130000/140000_owner_*` (sesión iOS). Sin `db push`; el registro ya refleja el estado real, pero `db push` aplicaría esas tres.

**Reversión de la parte de landing (decisión del dueño: el alcance es solo el POS):**
- En producción, en una transacción: `drop function storefront_club_progress(text)`, `drop table storefront_contact_settings` (sin CASCADE; solo dependían sus constraints/policies; la única fila era la semilla de contacto), y se eliminaron del registro `20260710000100` y `20260723020000`.
- Verificado: ambos objetos ya no existen y sus versiones no están registradas; `correct_sale_customer_atomic` (POS) sigue existiendo y registrada; bloqueos P0 intactos; `storefront_productos_publicos` sin cambios.
- Efecto: el catálogo vuelve al estado de esta mañana (contacto por defecto, "Mi Club" sin RPC).
- Pendientes en remoto: `20260710000100`, `20260723020000` (landing, a propósito) y `20261024120000/130000/140000` (iOS). Un `db push` aplicaría las cinco: no usarlo sin revisar `migration list --linked`.
- No se revirtió código de la landing (`daf2638` solo tocó tipos en `catalogo.service.ts` y `club-progress.service.ts`; `0322fde` venía del trabajo pendiente de `dev`).

## 19. P2 #14 — división de pos.page.ts

- Paso 1 (`ecf895d`): reglas puras `canConfirmSale`/`discretionaryDiscount` (sales/domain) y `filterCatalog`/`productStockLabel`/`preferredOption`; `mo-pos-catalog`.
- Paso 2 (`e182c98`): `mo-pos-cart-panel` (host `contents`, usa el `PosCartStore` de la página).
- Paso 3 (`53a8d99`): `PosCheckoutStore` + `mo-pos-checkout-dialog`; limpieza de miembros/imports sin uso. `pos.page.ts`: 1.699 → 655 líneas.
- Tests nuevos: `pos-catalog` (4), `checkout-rules` (5), `pos-checkout-store` (6, con `PosCartStore` real). Total 836.
- Verificado en el POS local tras cada paso (runtime-config confirmado en local; el typecheck lo vuelve a apuntar a producción y hay que regenerarlo): catálogo (render, búsqueda, escaneo, ficha), carrito (cantidades, eliminar, cliente/club, descuento de línea, opción), cobro (descuento $/% y motivo, pagos mixtos con referencia, quitar pago, monto exacto, venta `V-000003` correcta, reinicio tras vender y al cancelar).
- Sin publicar.

## 20. P2 — resto de la componentización y design system

Commits en `dev`, en orden:
- `e18bd97` (antes de esta sección): pipes `| money` y `| paymentLabel` (ADR 0023).
- **Historial y filtros:** `mo-sale-detail-body` (detalle de UNA venta, compartido por `mo-sale-detail-list` y el historial del POS; `canCorrectPayment` + `(correctPayment)`) y `mo-segmented` (filas de filtros de selección única) con `PAYMENT_FILTER_OPTIONS`. Reemplaza los `paymentFilterClass`/`salesFilterClass`/`presetClass` copiados en caja, historial y reportes. `sales-history.dialog.ts`: 840 → 655 líneas.
- **caja.page:** `mo-cash-open-session-form`, `mo-cash-turn-summary`, `mo-cash-movements-table` (con `MO_TABLE`) y `cash-movement-labels.ts`. 683 → 461 líneas.
- **product-form.dialog:** `mo-product-initial-stock-section` (se enlaza al FormGroup padre), `mo-product-components-editor` (emite `added`/`removed`; el diálogo recalcula el costo del combo), `mo-product-options-editor` (`[(options)]`, `[(grupo)]`, `[(error)]`) y funciones puras `product-option-list.ts` con 5 tests. 913 → 561 líneas.
- **Design system:** 11 skeletons inline → `mo-skeleton`; 7 tablas de reportes → `MO_TABLE`; 20 SVG inline → `lucide-angular`; el cobro del POS usa `mo-dialog`; botones primarios crudos (cobro, ficha de producto, login/recuperar/restablecer) → `mo-button`.
- **Bug corregido en `mo-dialog`:** Escape cerraba todos los diálogos abiertos (selector de cliente sobre el cobro descartaba los pagos; "Corregir pago" sobre el historial). Ahora hay una pila de diálogos abiertos: Escape cierra solo el de arriba y marca el evento con `preventDefault` (zone.js corre detección de cambios entre listeners, así que el de abajo ya no veía la pila original).

Se dejó a propósito: el esqueleto con layout del POS, el tono del carrito durante la carga del club, la barra de "ocupado" de `mo-dialog`, y los botones que no son botones de acción (chips de método de pago/descuento/tirilla, tarjetas del catálogo, botones de ícono). `mo-segmented` no se usa para las pestañas principales de reportes (otro estilo).

Verificado en local (runtime-config en local): historial (detalle, filtro por transferencia 3/7, "Corregir" abre su diálogo), reportes (periodos, estado y método 7 → 1 → 3, tablas con alineación y padding del sistema), caja (resumen con los mismos valores, Corregir/Anular movimiento), productos (editar batido: agregar/quitar componente, opción repetida rechazada, cambiar predeterminada; combo con ahorro; nuevo producto con inventario inicial y combo sin stock), POS (íconos 16/20/12 px, cobro en `mo-dialog`, Escape con selector encima, venta completada con toast), login con `mo-button`. `pnpm lint`, typecheck y 843 tests en verde.

Sin publicar hasta que el dueño lo confirme (merge `dev` → `main`).

## 21. P2 #16 y #17 — formularios al patrón Zod y fechas de la tienda

- **Zona horaria (#17):** `storeDateIso` y `shiftIsoDate` en `src/shared/lib/day-range.ts` son la única fuente de "hoy en la tienda"; reportes (`isoDate`/`addDays` delegan), `sales-trend`, historial de caja y nombre de exportaciones la reutilizan. `/auditoria` ya no usa `setHours` del dispositivo: `auditRangeStart` (audit/presentation/services) calcula medianoche de la tienda de hoy / −7 / −30 días con la zona de `TiendaInfoService`. 5 tests.
- **Formularios (#16):** los 8 que validaban con `Validators` de Angular pasan a factory + mapper + presenter:
  - Caja: abrir caja (en `caja.page` + `mo-cash-open-session-form`), agregar movimiento, corregir movimiento, corregir apertura.
  - Inventario: entrada de mercancía, ajuste, traslado.
  - POS: descuento por producto (schema armado con el precio unitario; conversión $↔% en el mapper).
  - Los schemas se derivan del DTO del dominio (`omit`, `extend` + `z.string().trim().pipe(dto.shape.x)`), así que la regla vive en un solo lugar. `inventory.dto.ts` expone `transferStockFieldsSchema` + `transferLocationsDiffer`/`TRANSFER_LOCATIONS_ERROR` para que DTO y formulario compartan "origen ≠ destino".
  - Comportamiento visible: los errores ahora salen en cada campo (antes el formulario solo no enviaba). El stock insuficiente del traslado sigue como error general (depende del producto).
  - 13 tests nuevos (caja 6, inventario 5, descuento 3 — más los 5 de fechas). Total 861.
- **Verificado en local:** descuento (100 % → 150 % rechazado → 20 % = $38.000), ajuste (errores en campo; PV 9→10), traslado (origen = destino, stock insuficiente, 2 und bodega→PV), entrada (costo prellenado, total $141.000, bodega 3→6), movimiento de caja (motivo recortado rechazado, gasto registrado), corregir movimiento y apertura (motivo mínimo), cierre y reapertura con la sugerencia del último cierre, `/auditoria` "Hoy".
- `tsc --noEmit` falla solo en `tests/integration/ios-payloads.contract.test.ts`, trabajo sin commitear de la sesión iOS; el build de Angular y lint pasan.
- Commits: ed9b811 6fd3dad (+ docs). Sin publicar.
- **Queda del #16:** 5 diálogos con Zod en línea pero sin presenter (gastos: nómina, plantilla, fondo, empleado; fidelización: ajuste de sellos del cliente).

## 22. Publicación de §21 y regresión del stock inicial (pendiente de aplicar)

- **Publicado (autorizado por el dueño):** merge `dev→main` `9e5c6ee` tras lint POS+landing, 861 tests, build de producción y diff sin secretos. Netlify `moveon-client` y `moveon-catalogo-web` ready en `9e5c6ee`; `/login` y `/catalogo` → 200. Incluyó de la sesión iOS `6fb3e7c` (archivo de migración `20261024150000`, no aplicada) y `b1e6035` (tests de contrato).
- **Regresión en producción causada por el P0 (`20261024000500`):** crear un producto con stock inicial > 0 falla con "permission denied for table inventory_movements" porque `create_product_with_initial_stock` es SECURITY INVOKER y `authenticated` ya no tiene INSERT directo. Verificado en remoto (solo lectura): `prosecdef = false`, INSERT de `authenticated` = false. La corrige `20261024150000_create_product_initial_stock_definer.sql` (DEFINER + revoke a public/anon), aplicada solo en local. **Pendiente: OK del dueño para aplicarla en remoto.**
- `pnpm typecheck` (y por tanto el job de CI) falla en `tests/integration/ios-payloads.contract.test.ts:180-181` (`code`/`message` sobre `{}`), de la sesión iOS. No afecta a Netlify.
