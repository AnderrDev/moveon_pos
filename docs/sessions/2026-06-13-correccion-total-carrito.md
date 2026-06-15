# Spec de Sesión — 2026-06-13 — Corrección total del carrito

## Metadatos

| Campo          | Valor                                                                    |
| -------------- | ------------------------------------------------------------------------ |
| Fecha          | 2026-06-13                                                               |
| Sprint         | Corrección operativa POS                                                 |
| Agente         | Codex                                                                    |
| HUs trabajadas | M4 Pantalla de venta: totales, cards responsivas, información comercial y catálogo |
| Estado         | Completada                                                               |

## 1. Objetivo de la sesión

Corregir el carrito del POS para que un producto con precio de venta final de $79.000 e IVA 19%
se cobre por $79.000 y no por $94.010, conservando la discriminación del IVA incluido.

## 2. Lo que se implementó

- `src/modules/sales/domain/services/sale-calculator.ts` trata `precioVenta` como precio final con IVA incluido.
- `apps/pos-angular/src/app/features/pos/pos.page.ts` muestra que el IVA está incluido.
- Se actualizaron las pruebas de cálculo y creación de venta, incluyendo el caso exacto de $79.000.
- `docs/modules/sales.md` documenta la semántica del precio final.
- Las cards del catálogo usan menos columnas en pantallas estrechas, muestran el nombre completo y ubican stock/SKU en una fila secundaria.
- El diálogo de información muestra costo y precio de venta a administradores; el servicio POS omite el costo para otros roles.
- Las cards del POS se rediseñaron con jerarquía retail: disponibilidad, nombre completo, precio etiquetado, acción de agregar visible y acceso secundario a la ficha.
- Se auditó el catálogo de 61 productos, se definió una taxonomía operativa de 11 categorías y se preparó una migración para reclasificar cada producto.
- Los suplementos y alimentos proteicos reciben textos prudentes de finalidad y recomendación; batidos, frutas y toppings quedan sin esos textos.
- Cada venta queda atribuida al usuario autenticado mediante `cashier_id` y un snapshot de correo visible en Ventas del turno; un trigger impide atribuir ventas a otro usuario.
- “Ventas del turno” se rediseñó como historial expandible con resumen operativo, productos, descuentos, IVA, pagos, referencias, cambio, cliente, usuario y datos de anulación.
- La creación de productos admite inventario inicial opcional por ubicación; producto y movimiento de entrada se registran atómicamente mediante RPC.

## 3. Decisiones tomadas

`precioVenta` representa el precio final al consumidor. El IVA se discrimina internamente sin sumarlo otra vez.

Las categorías del catálogo se diseñan por intención de compra y recomendación en el POS. Productos de una misma familia comparten orientación general, con advertencias específicas para estimulantes, ashwagandha, omega-3 y magnesio.

## 4. ADRs creados o actualizados

No se requirió ADR; se corrigió la interpretación de RN-S10.

## 5. Tests

- `pnpm exec tsc --noEmit`: pasó.
- `pnpm lint`: pasó.
- `pnpm test`: 309 tests pasaron.
- `pnpm typecheck`: TypeScript pasó, pero `ng build --configuration development` terminó con `Abort trap: 6` sin diagnóstico.
- Verificación en navegador: administrador ve precio de venta y costo en “Ver información”; consola sin errores.
- Verificación SQL del catálogo: 61 productos, 11 categorías, 0 productos sin categoría, 41 productos con información y 20 batidos/ingredientes sin información.
- La migración `20260613_001_reclassify_product_catalog.sql` se aplicó correctamente a la base configurada.
- El POS local se recargó, pero la caja visible estaba cerrada y por eso no renderizó los filtros del catálogo.
- La migración `20260614_001_audit_sale_cashier.sql` se aplicó: 3 ventas históricas quedaron con UUID/correo, sin registros huérfanos, y el trigger de identidad está activo.
- Para auditoría de ventas: TypeScript y lint pasaron, y `pnpm test` pasó con 309 tests.
- Para el historial detallado: TypeScript y lint pasaron, y `pnpm test` pasó con 311 tests en 37 archivos.
- Para inventario inicial: la migración `20260614_002_create_product_with_initial_stock.sql` fue aplicada; la prueba transaccional creó producto + 1 movimiento + stock 7 y terminó en `ROLLBACK`.
- TypeScript y lint pasaron, y `pnpm test` pasó con 314 tests en 37 archivos. El formulario se verificó en navegador sin errores de consola.
- Los controles de formulario compartidos ahora renderizan su host como bloque, corrigiendo el espaciado vertical entre Nombre, SKU, código de barras y las demás filas.

## 6. Bloqueos y preguntas pendientes

- Investigar por separado el cierre abrupto local de Angular durante `ng build`.

## 7. Próximos pasos

Verificar visualmente los nuevos filtros de categoría durante el próximo turno con caja abierta.

## 8. Notas adicionales

El error reportado era exactamente un recargo del 19%: $79.000 se convertía en $94.010.
