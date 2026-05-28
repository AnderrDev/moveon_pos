# Plan de pruebas manuales (regresión post-fixes) — 2026-05-27

Plan paso a paso para validar en el navegador los 8 fixes P0 del `docs/plan-de-trabajo.md`
más el flujo operativo base. Se ejecuta contra la app local (`http://localhost:4200`)
apuntando al Supabase de staging `rmaieqyscchtxxkgxgik`, **con las migraciones de PLAN-01
y PLAN-03 ya aplicadas al remoto**.

- **Convención:** cada caso `TC-Rxx` tiene Pasos + Resultado esperado. Se marca ✅/⚠️/❌ al ejecutar.
- **Trazabilidad:** cada caso indica qué PLAN-XX valida.

---

## 0. Pre-requisitos

- [ ] **PRE-1:** Supabase activo (auth/health 200).
- [ ] **PRE-2:** Migraciones `20260527_001_add_tienda_timezone` y `20260527_002_correlative_sale_number` aplicadas al remoto (verificado: `tiendas.timezone` existe, `sale_counters` existe, RPC con `lpad`).
- [ ] **PRE-3:** `runtime-config.json` apunta al proyecto real.
- [ ] **PRE-4:** `pnpm dev` corriendo en http://localhost:4200.
- [ ] **PRE-5:** Usuario admin `admin@moveonpos.co`. (Si existe un usuario cajero, anotar credenciales para TC-R02b; si no, se documenta como no ejecutable.)

---

## 1. Auth + Guard por rol (PLAN-15)

### TC-R01 — Login admin y navegación completa
- **Pasos:** ir a `/login`, entrar como admin.
- **Esperado:** redirige a `/pos`; el sidebar muestra **todos** los módulos (POS, Productos, Inventario, Caja, Clientes, Reportes).

### TC-R02 — Admin ve el botón "Anular"
- **Pasos:** en `/pos` abrir "Ventas del turno".
- **Esperado:** las ventas `completed` muestran botón "Anular" (además de "Reimprimir").

### TC-R02b — Cajero restringido (si hay usuario cajero)
- **Pasos:** login como cajero; intentar navegar a `/productos`, `/inventario`, `/reportes`, `/productos/categorias`.
- **Esperado:** cada una redirige a `/pos`; el nav NO muestra Productos/Inventario/Reportes; en "Ventas del turno" NO aparece "Anular".

---

## 2. Catálogo — formulario de producto (PLAN-05)

### TC-R03 — Crear producto con IVA y costo opcional
- **Pasos:** `/productos` → "+ Nuevo producto". Nombre "TEST Creatina QA", SKU "TESTQA02", Precio 50000, **dejar Costo vacío**, Categoría "TEST QA Suplementos", IVA **19%**, Tipo Simple → "Crear producto".
- **Esperado:** el select de IVA **no muestra "Invalid input"** al abrir; con Costo vacío el producto **se crea** (no exige número); aparece en la lista con IVA 19%.

### TC-R03b — Costo presente
- **Pasos:** crear otro producto con Costo 30000.
- **Esperado:** se guarda con costo 30000.

---

## 3. POS — venta simple + número correlativo (PLAN-03)

### TC-R04 — Caja abierta
- **Pasos:** `/caja`; si no hay caja abierta, abrir con base $100.000.
- **Esperado:** "Caja abierta · $100.000"; `/pos` permite cobrar.

### TC-R05 — Venta efectivo + número correlativo
- **Pasos:** en `/pos` agregar 2× "Agua 600ml" (IVA 19%); Cobrar; Efectivo $10.000; Confirmar. Abrir "Ventas del turno".
- **Esperado:** total $8.330, cambio $1.670; venta `completed`; **número con formato `V-000001`** (correlativo, no timestamp). Registrar el número exacto.

### TC-R06 — Segunda venta: número consecutivo
- **Pasos:** otra venta simple (1× Powerade); confirmar; ver "Ventas del turno".
- **Esperado:** el número es **`V-000002`** (consecutivo respecto al anterior).

---

## 4. POS — cliente y descuentos (PLAN-02)

### TC-R07 — Asociar cliente
- **Pasos:** en `/pos`, botón "Asociar cliente" en el carrito → buscar por nombre/documento → seleccionar uno.
- **Esperado:** el nombre del cliente aparece en el header del carrito con opción "Quitar".

### TC-R08 — Descuento por ítem
- **Pasos:** agregar un producto; en su línea, botón de descuento → ingresar un monto por unidad ≤ precio unitario → aplicar.
- **Esperado:** la línea refleja el descuento; "Descuentos" del carrito se actualiza; el total baja con IVA recalculado. Intentar un descuento > precio unitario → bloqueado.

### TC-R09 — Descuento global + venta con cliente
- **Pasos:** abrir Cobrar; ingresar un "Descuento global" en monto; pagar el total (menor) y confirmar.
- **Esperado:** "Total venta" baja por el descuento global; "Descuentos" suma ítem+global; IVA no se altera por el global; la venta queda asociada al cliente (verificable al reimprimir / en historial).

---

## 5. POS — tope de stock (PLAN-07)

### TC-R10 — Tope de cantidad por stock (producto simple)
- **Pasos:** elegir un producto `simple` con stock bajo conocido (ej. Caseína 2lb, stock 9); pulsar "+" repetidamente.
- **Esperado:** la cantidad **no supera el stock**; al intentar pasarlo aparece toast "Stock máximo: N unidades" y el botón "+" queda inactivo en el máximo.

### TC-R11 — Producto `prepared` sin tope
- **Pasos:** agregar un batido (BP00x) y pulsar "+" varias veces.
- **Esperado:** la cantidad sube **sin tope** y **sin** toast de stock.

---

## 6. Inputs de moneda — paste (PLAN-06)

### TC-R12 — Pegar monto en un campo de moneda
- **Pasos:** en un campo de moneda (ej. "Precio de venta" del form de producto, o "Efectivo en caja" del cierre), **pegar** (Cmd/Ctrl+V) el texto `2.533.560` o `$ 2.533.560`.
- **Esperado:** el campo queda en `2.533.560` (no `$ 100.000.000` ni basura). Pegar/borrar vacío → campo a 0/vacío.

---

## 7. Ventas del turno por sesión (PLAN-04)

### TC-R13 — Historial acotado a la sesión actual
- **Pasos:** con la caja actual y las ventas de TC-R05/06, abrir "Ventas del turno".
- **Esperado:** muestra **solo** las ventas de la sesión actual (las creadas hoy en esta caja), no de días/sesiones anteriores.

### TC-R14 — Tras cerrar y reabrir, arranca vacío
- **Pasos:** cerrar la caja (TC-R17) y abrir una nueva; abrir "Ventas del turno".
- **Esperado:** listado **vacío** ("Aún no se registran ventas en este turno"), sin ventas del turno anterior.

---

## 8. Reportes por zona horaria local (PLAN-01)

### TC-R15 — El reporte del día local incluye las ventas de hoy
- **Pasos:** `/reportes` (pestaña "Reporte diario"). El selector de fecha por defecto debe mostrar **hoy en hora Colombia**.
- **Esperado:** las ventas creadas hoy (TC-R05/06/09) aparecen en el reporte del día local **sin** tener que cambiar la fecha al día UTC siguiente. Total, IVA, desglose por método y top productos reflejan las ventas de hoy.

### TC-R16 — Stock report
- **Pasos:** pestaña "Stock".
- **Esperado:** lista de productos; bajo stock destacado; los nuevos productos de TC-R03 aparecen.

---

## 9. Anulación y cierre (regresión)

### TC-R17 — Anular venta (admin) repone stock
- **Pasos:** "Ventas del turno" → "Anular" en una venta → motivo.
- **Esperado:** queda "Anulada"; el stock del producto se repone (verificar en kardex/inventario).

### TC-R18 — Cierre de caja con cuadre
- **Pasos:** `/caja` → "Cerrar caja"; ingresar montos por método (escribir o pegar — valida PLAN-06); confirmar.
- **Esperado:** muestra esperado vs lo ingresado; diferencias > $5.000 exigen nota; cierra atómicamente; `/pos` vuelve a bloquear ventas.

---

## Hoja de resultados — ejecutado 2026-05-27 (navegador, Playwright MCP)

> Migraciones de PLAN-01 y PLAN-03 aplicadas al remoto antes de ejecutar.

| TC | Caso | PLAN | Resultado | Notas |
|----|------|------|-----------|-------|
| TC-R01 | Login admin + nav | 15 | ✅ | Redirige a `/pos`; los 6 módulos visibles |
| TC-R02 | Admin ve "Anular" | 15 | ✅ | Botón "Anular" presente en ventas `completed` |
| TC-R02b | Cajero restringido | 15 | ⏭️ | No ejecutado: no hay credenciales de un usuario cajero. Cubierto por tests unitarios del guard |
| TC-R03 | Crear producto (IVA+costo) | 05 | ✅ | IVA 19% **sin "Invalid input"** al abrir; **Costo vacío aceptado**; producto creado |
| TC-R03b | Costo presente | 05 | ⏭️ | No ejecutado por separado; el schema lo cubre en tests unitarios |
| TC-R04 | Caja abierta | — | ✅ | $100.000 |
| TC-R05 | Venta + V-000001 | 03 | ✅ | **Número `V-000001`** (correlativo, no timestamp); total $8.330, cambio $1.670 |
| TC-R06 | Venta consecutiva V-000002 | 03 | ✅ | **`V-000002`** consecutivo |
| TC-R07 | Asociar cliente | 02 | ✅ | Búsqueda por nombre filtró; chip "Cliente: María Gómez" con "Quitar" |
| TC-R08 | Descuento por ítem | 02 | ✅ | $2.000/und × 4 = −$8.000; total $72.000→$64.000, IVA correcto |
| TC-R09 | Descuento global + cliente | 02 | ✅ | Global −$4.000 → total $60.000; **DB: V-000002 discount_total=12.000, cliente=María Gómez** |
| TC-R10 | Tope de stock | 07 | ✅ | Caseína topa en 9 (= stock); botón "+" `[disabled]` |
| TC-R11 | Prepared sin tope | 07 | ✅ | Batido sube sin tope ni toast |
| TC-R12 | Paste en moneda | 06 | ✅ | Evento `paste` real "$ 2.533.560" → valor `2533560`; vía programática $50.000 (sin $100M) |
| TC-R13 | Historial por sesión | 04 | ✅ | Solo V-000001/V-000002 (no listado multi-día) |
| TC-R14 | Reabrir caja → vacío | 04 | ✅ | "Aún no se registran ventas en este turno" |
| TC-R15 | Reporte por TZ local | 01 | ✅ | **Ventas de 11:35/11:40 p.m. (UTC del 28) aparecen en el reporte del 2026-05-27 local** |
| TC-R16 | Stock report | 01 | ✅ | Bajo stock arriba; TEST Creatina QA presente |
| TC-R17 | Anular repone stock | — | ✅ | V-000001 `voided`; **DB: stock Agua 103→105** |
| TC-R18 | Cierre de caja | — | ✅ | Esperado $160.000 (V-000001 anulada excluida); cierre atómico OK |

### Resumen

**18 de 18 casos ejecutables: ✅ PASS.** 2 no ejecutados: TC-R02b (sin usuario cajero — cubierto por unit tests) y TC-R03b (costo presente — cubierto por schema test).

**Los 8 fixes P0 quedan validados en el navegador contra el remoto:**
- PLAN-15 ✅ guard por rol (lado admin) · PLAN-01 ✅ reporte por día local (caso headline confirmado) · PLAN-05 ✅ form de producto · PLAN-02 ✅ cliente + descuentos (persistido en DB) · PLAN-06 ✅ paste en moneda (evento real) · PLAN-07 ✅ tope de stock · PLAN-04 ✅ historial por sesión · PLAN-03 ✅ número correlativo `V-000001/V-000002`.

**Pendiente menor de cobertura manual:** TC-R02b requiere un usuario cajero para validar el bloqueo de rutas y la ocultación de "Anular" en la práctica (la lógica está en unit tests).

**Datos de prueba dejados en staging:** producto "TEST Creatina QA" (TESTQA02), ventas `V-000001` (anulada) y `V-000002` (con cliente y descuento), sesión de caja cerrada + nueva abierta con $100.000.
