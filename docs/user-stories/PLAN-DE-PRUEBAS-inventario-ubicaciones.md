# Plan de pruebas — Inventario por ubicacion PV/Bodega

Fecha de ejecucion base: 2026-05-30  
Alcance: PLAN-23..26, ADR 0008, HUs INV/POS/REP relacionadas con stock por ubicacion.

Este plan valida el MVP de inventario por ubicacion:

- El stock vendible vive en `punto_venta`.
- La `bodega` no habilita venta hasta hacer traslado.
- Las ventas descuentan `punto_venta`.
- Las anulaciones reponen `punto_venta`.
- Los reportes y kardex muestran ubicacion.
- El cajero no puede operar inventario.

> Nota de riesgo: ningun plan elimina el riesgo al 100%. Este guion cubre los caminos criticos y deja explicitos los residuales para reducir el riesgo operativo al minimo razonable antes de salida.

---

## 1. Trazabilidad HU/casos

| HU | Riesgo que cubre | Casos |
|---|---|---|
| INV-01 | Stock calculado por movimientos y ubicacion | TC-INVLOC-01, 02, 05, 07 |
| INV-02 | Entrada de mercancia con ubicacion | TC-INVLOC-02 |
| INV-03 | Ajustes mantienen ubicacion y motivo | TC-INVLOC-10 |
| INV-04 | Kardex auditable con ubicacion | TC-INVLOC-08 |
| INV-05 | Bajo stock se calcula con Punto de venta | TC-INVLOC-01, 02, 05, 07, 09 |
| INV-06 | Solo admin opera inventario | TC-INVLOC-11 |
| INV-07 | Traslado Bodega/Punto de venta | TC-INVLOC-04, 10 |
| POS-03 | POS no vende stock que esta solo en Bodega | TC-INVLOC-03, 06 |
| POS-05 | Venta atomica descuenta PV | TC-INVLOC-06 |
| POS-08 | Anulacion repone PV | TC-INVLOC-07 |
| POS-09 | Historial permite anular venta del turno | TC-INVLOC-07 |
| REP-02 | Reporte de stock muestra PV/Bodega/Total | TC-INVLOC-09 |
| FLUJO-07 | Preparacion catalogo + inventario | Flujo manual completo |

---

## 2. Preconditions

- App local en `http://localhost:4200`.
- Migraciones PLAN-23 aplicadas en staging.
- Usuario admin activo.
- Usuario cajero activo para prueba de permisos.
- Caja abierta para la tienda de prueba.
- Usar un producto QA unico por corrida:
  - Nombre sugerido: `QA PV Bodega YYYYMMDDHHmmss`
  - SKU sugerido: `QAPVBODHHmmss`
  - Tipo: `simple`
  - Precio: `$ 12.000`
  - Stock minimo: `2`

---

## 3. Casos de prueba

| ID | HU | Pasos | Esperado | Resultado 2026-05-30 |
|---|---|---|---|---|
| TC-INVLOC-01 | CAT/INV-01/INV-05 | Admin crea producto QA simple con stock minimo 2. Abrir `/inventario` y filtrar por SKU. | PV `0`, Bodega `0`, Total `0`, Min `2`, badge `Stock bajo`. | PASS con `QAPVBOD203208`. |
| TC-INVLOC-02 | INV-02/INV-05 | En `/inventario`, `+ Entrada`, dejar ubicacion default `Bodega`, cantidad `5`, motivo QA. | PV `0`, Bodega `5`, Total `5`; sigue `Stock bajo` porque PV es 0. | PASS. |
| TC-INVLOC-03 | POS-03 | Ir a `/pos`, buscar SKU y hacer click en el producto con PV `0`, Bodega `5`. | No entra al carrito; toast `Stock maximo: 0 unidades`. | PASS. |
| TC-INVLOC-04 | INV-07 | En `/inventario`, `Trasladar` de `Bodega` a `Punto de venta`, cantidad `3`. | PV `3`, Bodega `2`, Total `5`; desaparece bajo stock si PV supera minimo. | PASS. |
| TC-INVLOC-05 | INV-01/INV-05 | Verificar fila despues del traslado. | Stock calculado por ubicacion y total coherente. | PASS: `3/2/5`. |
| TC-INVLOC-06 | POS-03/POS-05 | En `/pos`, vender 1 unidad del producto QA y pagar en efectivo. | Venta completada; ticket interno; PV baja de `3` a `2`, Bodega sigue `2`, Total `4`. | PASS, venta `V-000005`. |
| TC-INVLOC-07 | POS-08/POS-09 | En `Ventas del turno`, anular `V-000005` con motivo. | Venta queda `Anulada`; PV vuelve a `3`, Bodega `2`, Total `5`. | PASS. |
| TC-INVLOC-08 | INV-04 | Abrir `Kardex` del producto QA. | Muestra `Entrada` en Bodega, `Traslado salida` Bodega, `Traslado entrada` Punto de venta, `Venta` Punto de venta y `Anulacion` Punto de venta. | PASS. |
| TC-INVLOC-09 | REP-02 | En `/reportes`, pestaña `Stock`. | Tabla muestra columnas `Punto venta`, `Bodega`, `Total`, `Min`; producto QA aparece `3/2/5/2`. | PASS. |
| TC-INVLOC-10 | INV-07 | Intentar trasladar `99` desde Bodega cuando solo hay `2`. | Error visible `Stock insuficiente en origen. Disponible: 2`; stock no cambia. | PASS. |
| TC-INVLOC-11 | INV-06 | Cerrar sesion admin, entrar como cajero. Revisar nav y abrir directo `/inventario`. | Cajero no ve Productos/Inventario/Reportes; `/inventario` redirige a `/pos`. | PASS. |
| TC-INVLOC-12 | INV-03 | Ajustar `+1` o `-1` con ubicacion explicita y motivo. | Movimiento de ajuste queda en ubicacion elegida y no afecta la otra ubicacion. | Pendiente recomendado. |
| TC-INVLOC-13 | POS-03 | Con PV `3`, intentar subir cantidad del carrito por encima de `3`. | El `+` se deshabilita al maximo y/o muestra toast de tope. | Cubierto por unit tests; pendiente navegador especifico. |
| TC-INVLOC-14 | Seguridad DB | Ejecutar SQL/pgtap de `transfer_stock_atomic` admin-only y `get_stock` por ubicacion. | Tests SQL pasan en staging. | Ya cubierto previamente; consulta SQL de evidencia no disponible en esta sesion por DNS/MCP auth. |

---

## 4. Evidencia de ejecucion 2026-05-30

Producto QA:

- SKU: `QAPVBOD203208`
- Nombre: `QA PV Bodega 20260530203208`
- Entrada: `+5` en Bodega.
- Traslado: `-3` Bodega, `+3` Punto de venta.
- Venta: `V-000005`, `-1` Punto de venta.
- Anulacion: `V-000005` anulada, `+1` Punto de venta.
- Estado final esperado/observado: PV `3`, Bodega `2`, Total `5`, Min `2`.

Verificaciones automaticas locales:

- `corepack pnpm typecheck` — PASS.
- `corepack pnpm lint` — PASS.
- `corepack pnpm test` — PASS, 34 archivos / 299 tests.

Capturas locales de evidencia:

- `/private/tmp/moveonapp-qa-inventario-final.png`
- `/private/tmp/moveonapp-qa-kardex-ubicaciones.png`
- `/private/tmp/moveonapp-qa-reporte-stock.png`

Limitaciones de evidencia tecnica:

- `psql` a staging fallo por DNS local: no resolvio host Supabase desde este entorno.
- MCP Supabase no estaba autorizado: `Unauthorized`, falta `SUPABASE_ACCESS_TOKEN`.
- La verificacion funcional si se ejecuto desde navegador real contra la app local conectada a staging.

---

## 5. Flujo manual completo recomendado

Ejecutar este flujo en orden antes de liberar o mezclar una rama grande de inventario:

1. Entrar como admin.
   - Esperado: redireccion a `/pos`, nav con POS, Productos, Inventario, Caja, Clientes, Reportes.

2. Verificar caja.
   - Si no hay caja abierta, ir a `/caja` y abrir con base de prueba.
   - Esperado: `/pos` muestra `Caja abierta`.

3. Crear producto QA.
   - Ir a `/productos`.
   - Crear producto simple con SKU unico, precio `12000`, IVA `0`, stock minimo `2`.
   - Esperado: producto creado y visible.

4. Validar nacimiento sin stock.
   - Ir a `/inventario`, filtrar por SKU.
   - Esperado: PV `0`, Bodega `0`, Total `0`, Min `2`, `Stock bajo`.

5. Registrar entrada en Bodega.
   - Click `+ Entrada`.
   - Cantidad `5`, ubicacion `Bodega`, motivo `QA entrada bodega`.
   - Esperado: PV `0`, Bodega `5`, Total `5`, sigue `Stock bajo`.

6. Validar que Bodega no habilita venta.
   - Ir a `/pos`, buscar SKU, click en producto.
   - Esperado: carrito sigue vacio y aparece `Stock maximo: 0 unidades`.

7. Trasladar a Punto de venta.
   - Ir a `/inventario`, click `Trasladar`.
   - Origen `Bodega`, destino `Punto de venta`, cantidad `3`, motivo `QA traslado`.
   - Esperado: PV `3`, Bodega `2`, Total `5`; sin badge bajo stock si el minimo es `2`.

8. Vender 1 unidad.
   - Ir a `/pos`, buscar SKU, agregar producto.
   - Click `Cobrar`, agregar pago efectivo exacto, confirmar.
   - Esperado: venta completada y ticket interno.
   - Volver a `/inventario`.
   - Esperado: PV `2`, Bodega `2`, Total `4`.

9. Anular la venta.
   - En `/pos`, abrir `Ventas del turno`.
   - Ubicar la venta recien creada y click `Anular`.
   - Ingresar motivo de minimo 10 caracteres.
   - Esperado: venta `Anulada`.
   - Volver a `/inventario`.
   - Esperado: PV `3`, Bodega `2`, Total `5`.

10. Revisar Kardex.
    - Abrir `Kardex`.
    - Esperado: se ven ubicaciones y movimientos en orden:
      `Entrada` Bodega, `Traslado salida` Bodega, `Traslado entrada` Punto de venta, `Venta` Punto de venta, `Anulacion` Punto de venta.

11. Revisar reportes.
    - Ir a `/reportes`, pestaña `Stock`.
    - Esperado: columnas `Punto venta`, `Bodega`, `Total`, `Min`; producto QA con estado final correcto.

12. Probar negativo de traslado.
    - Intentar mover `99` desde Bodega cuando el disponible sea menor.
    - Esperado: error de stock insuficiente; no cambia PV/Bodega/Total.

13. Probar cajero.
    - Cerrar sesion admin y entrar como cajero.
    - Esperado: no ve Productos/Inventario/Reportes.
    - Abrir directo `/inventario`.
    - Esperado: redireccion a `/pos`.

14. Cerrar evidencias.
    - Registrar SKU, venta, resultado de cada TC y capturas si la corrida es formal.
    - Ejecutar `corepack pnpm typecheck`, `corepack pnpm lint`, `corepack pnpm test`.
    - Si hay acceso DB: ejecutar pgTAP/SQL de `supabase/tests/inventory-locations.test.sql`.

---

## 6. Residuales antes de liberar

- Validar en una corrida con acceso SQL directo para dejar evidencia DB de `inventory_movements` y `sales.status`.
- Repetir `TC-INVLOC-13` en navegador si se quiere evidencia visual del tope de cantidad con PV mayor a 1.
- Validar impresora fisica/ticket real fuera del navegador.
- Probar concurrencia real con dos sesiones vendiendo/trasladando el mismo producto.
- Mantener datos QA con prefijo `QA`/`QAPVBOD` para poder limpiarlos despues sin tocar ventas reales.
