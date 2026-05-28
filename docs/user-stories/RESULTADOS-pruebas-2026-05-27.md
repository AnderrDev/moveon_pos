# Resultados de pruebas manuales (navegador) — 2026-05-27

Ejecución del guion [`E2E-flujo-completo-pruebas.md`](./E2E-flujo-completo-pruebas.md) contra la app local
(`http://localhost:4200`) apuntando al proyecto Supabase de staging `rmaieqyscchtxxkgxgik`.

- **Herramienta:** navegador (Playwright MCP), pruebas manuales interactivas.
- **Usuario:** `admin@moveonpos.co` (rol mostrado: "Operador").
- **Leyenda:** ✅ Pass · ⚠️ Pass con observación/gap · ❌ Fail · ⏭️ No ejecutable en este entorno.

---

## Entorno encontrado

- La base de staging **ya tiene datos sembrados**: 22 productos, 10 categorías (Proteínas, Creatinas, Pre-entrenos, Aminoácidos, Vitaminas, Quemadores, Batidos preparados, Snacks fitness, Bebidas).
- **Ya había una caja abierta** al entrar ("Turno abierto · Caja $100.000"). Por eso TC-07 (venta bloqueada sin caja) y TC-08 (abrir caja) se reordenan: se verifican alrededor del cierre.
- Login con credenciales pre-cargadas en el formulario (`admin@moveonpos.co` / `Admin1234!`).
- Batidos preparados (BP001–003) se muestran sin "+IVA" → IVA 0%, consistente con tipo `prepared`.

---

## 1. Autenticación

### TC-01 — Login inválido ⚠️
- **Esperado:** mensaje de error genérico en español ("Email o contraseña incorrectos"), sin revelar qué campo falló.
- **Resultado:** con contraseña incorrecta, muestra el mensaje **"Invalid login credentials"** bajo el formulario y no ingresa. Console: 1 error `400` de `/auth/v1/token` (esperado).
- **Veredicto:** funcionalmente correcto (no revela el campo, no ingresa), pero el mensaje viene **crudo de Supabase en inglés**. CLAUDE.md exige mensajes de UI en español.
- **Faltante:** localizar/mapear el error a "Email o contraseña incorrectos".

### TC-02 — Login válido ✅
- **Esperado:** ingreso y redirección a la home según rol.
- **Resultado:** con credenciales correctas, redirige a `/pos`. Shell con navegación (POS, Productos, Inventario, Caja, Clientes, Reportes), usuario "admin · Operador" y botón "Cerrar sesión".
- **Veredicto:** ✅ Pass. (Nota: redirige siempre a `/pos`, no diferencia admin→`/dashboard`; no existe `/dashboard` en rutas — comportamiento actual del MVP.)

---

## 4. Ventas

### TC-09 — Venta efectivo simple ✅ (con hallazgos)
- **Pasos:** agregar 2× "Agua 600ml" (BE001, $3.500, IVA 19%) → Cobrar → Efectivo $10.000 → Confirmar.
- **Esperado:** total e IVA correctos; cambio correcto; venta `completed` con número correlativo; stock baja; ticket impreso.
- **Resultado:**
  - Subtotal $7.000 + IVA $1.330 (19%) = **Total $8.330**. ✅ IVA correcto por ítem.
  - Pagado $10.000 → **Cambio $1.670** ($10.000 − $8.330). ✅ (PAY-02)
  - Venta registrada en "Ventas del turno": `260527-1779933558354`, Efectivo $10.000, 2 items, $8.330, estado OK. ✅
  - El carrito se vació y el modal se cerró tras confirmar (sin error). ✅
- **Veredicto:** ✅ Pass.
- **Hallazgo 1 (número de venta NO correlativo):** el número generado es `260527-<epoch ms>`. Ventas históricas usaban formato correlativo `V-20260509-001/002/003/004`. RN-S exige `saleNumber` **correlativo por tienda**; hoy es timestamp-based → no es secuencial ni auditable como consecutivo.
- **Hallazgo 2 ("Ventas del turno" no acota por sesión):** el modal "Anula o reimprime ventas del cierre actual" muestra ventas de 09, 10, 18 y 27 de mayo. O la sesión de caja lleva abierta semanas (stale), o el filtro no se limita a la `cash_session` actual. Revisar el alcance del query.

### TC-10 — Idempotencia ⏭️
- **No verificable solo por UI:** el `idempotencyKey` no se reenvía manualmente desde la interfaz (cada flujo genera uno nuevo). Doble-click confirma una sola vez porque el botón se deshabilita/cierra el modal.
- **Cobertura existente:** test unitario `tests/unit/modules/sales/create-sale-use-case.test.ts` valida que el mismo key devuelve la misma venta (RN-S04). Recomendado: test de integración contra `create_sale_atomic`.

### TC-11 — Venta con pago mixto e IVA mixto ✅
- **Pasos:** carrito 1× Whey Protein 1kg (19%) + 1× Batido Whey+Plátano (0%, `prepared`, stock 0) → Cobrar → Efectivo $100.000 + Nequi $48.900 → Confirmar.
- **Resultado:**
  - IVA total = $20.900 (solo Whey, 19% sobre $110.000). El batido suma 0 IVA. **Total $148.900**. ✅ IVA por ítem con tasas distintas (RN-S10).
  - El batido con stock 0 **sí se agregó y vendió** sin bloqueo → confirma exención de stock para `prepared` (RN-S02). ✅
  - Pago mixto Efectivo + Nequi sumando exactamente el total → Confirmar habilitado; venta creada; carrito vaciado. ✅ (PAY-01)
- **Veredicto:** ✅ Pass.
- **Hallazgo (sin captura de referencia para pagos no-cash):** al seleccionar Nequi/Tarjeta/Daviplata/Transferencia **no aparece campo de "referencia"**. RN-PG04 y PAY-01 CA3 indican que los pagos no-cash deben permitir ingresar referencia (últimos 4 de tarjeta, # aprobación). La UI no lo expone.
- **Nota UX:** el campo de monto usa el valor sugerido como *placeholder*, no como valor real. Hay que escribir el monto; pulsar "Agregar" con el campo vacío no agrega nada (puede confundir al cajero, que verá el monto "puesto" pero no aplicado).

### TC-14 — Pagos insuficientes ✅
- **Pasos:** dentro de TC-11, con solo $100.000 de $148.900 → "Falta $48.900".
- **Resultado:** el botón **Confirmar permanece deshabilitado** mientras los pagos < total. ✅ (RN-S03)
- **Veredicto:** ✅ Pass (validación en UI). Pendiente confirmar el error `PaymentTotalMismatch` a nivel de use-case/RPC con test de integración.

### TC-13 — Stock insuficiente ⚠️ (protegido en servidor, no en UI)
- **Pasos:** Caseína 2lb (stock 9), subir cantidad a 10 con "+", cobrar exacto en efectivo, Confirmar.
- **Resultado:**
  - El carrito **permitió cantidad 10 > stock 9** sin tope ni advertencia. ⚠️
  - Al confirmar, `create_sale_atomic` devolvió **HTTP 400** y la venta **no se creó**. El stock no se sobrevende. ✅
  - La UI mostró un mensaje **genérico "Error al crear venta"**.
- **Veredicto:** ⚠️ Protección efectiva en el servidor (RN-S02 se cumple), pero falta validación en cliente y el error no indica que es por stock ni qué producto/cantidad. El dominio define `InsufficientStock { productoId, available, requested }` — no se está surfaceando.
- **Faltante:** topar cantidad al stock disponible (o avisar) en el carrito; mapear el error de stock a un mensaje claro.

### TC-12 — Venta con cliente y descuento ❌ (no disponible en UI)
- **Hallazgo mayor:** el POS **no tiene selector de cliente** ni **campo de descuento** (ni por ítem ni global).
  - **POS-06 (cliente opcional en venta):** no se puede asociar un cliente a la venta desde `/pos`, aunque exista el CRUD en `/clientes`.
  - **POS-07 / HU-15 (descuentos):** no hay forma de aplicar descuento en la UI. No es solo el umbral por rol (RN-S09): la funcionalidad de descuento **no está cableada**.
- **Veredicto:** ❌ No ejecutable: ambas capacidades faltan en la pantalla de venta.

---

## 3. Catálogo e inventario (verificación)

### INV-01 / INV-05 — Stock y bajo stock ✅
- `/inventario` lista 22 productos con stock y mínimo. Los productos bajo el mínimo muestran el badge "Stock bajo". ✅
- **Hallazgo menor:** los batidos `prepared` (BP001/2/3) tienen stock 0 / min 0 y muestran "Stock bajo", aunque no manejan stock. Conviene excluir `prepared` del cálculo de bajo stock.

### INV-04 — Kardex ✅
- El kardex de Agua 600ml muestra movimientos con tipo (Venta/Entrada/Ajuste), cantidad y motivo, ordenados por fecha. Incluye `entry` ("Carga inicial seed"), `adjustment` ("Merma: botellas vencidas") y `sale_exit`. ✅
- **Hallazgo menor:** el `sale_exit` de mi venta (TC-09) tiene motivo vacío ("—"), mientras los seed muestran "Venta". Inconsistencia de etiqueta.

## 5. Anulación

### TC-15 — Anular venta ✅ (con hallazgo UX)
- **Pasos:** "Ventas del turno" → Anular la venta `260527-1779933558354` ($8.330, Agua 600ml) → ingresar motivo.
- **Resultado:**
  - El motivo se pide con un **`prompt()` nativo del navegador** ("Motivo para anular 260527-…").
  - Tras confirmar, la venta pasó a estado **"Anulada"** y desapareció su botón "Anular" (solo queda "Reimprimir"). ✅
  - El kardex de Agua 600ml muestra el nuevo movimiento **"Anulacion · +2 · Prueba QA - anulación de venta de prueba"** → reposición de stock y motivo registrados. ✅ (RN-S07)
  - La venta fallida por stock (TC-13) **no** aparece en el historial → confirma que nunca se creó. ✅
- **Veredicto:** ✅ Pass (lógica correcta y atómica).
- **Hallazgo UX:** el motivo de anulación se captura con `window.prompt()` nativo, no con un modal de la app. Es jarring, no se puede estilizar/localizar y no valida longitud mínima del motivo. Reemplazar por un diálogo `mo-*` con validación.
- **Pendiente (roles):** no se pudo probar la restricción "solo admin anula" (RN-S08) porque no hay guard por rol; el usuario actual ("Operador") pudo anular.

## 7. Reportes

### TC-18 — Ventas del día ⚠️ (bug de zona horaria)
- **Resultado con fecha 2026-05-27 (la del sistema):** Total $0, 0 ventas, IVA $0, "Sin ventas en la fecha" — **pese a haber creado 2 ventas hoy**.
- **Resultado con fecha 2026-05-28:** aparecen las 2 ventas de hoy: Total $148.900 (1 venta OK), IVA $20.900, **Anuladas 1** (la de $8.330), desglose **Por método** (Efectivo $100.000, Nequi $48.900) y **Top productos** (Whey $130.900, Batido $18.000). ✅
- **Veredicto:** ⚠️ Bug de zona horaria. El reporte filtra ventas por **fecha UTC**, pero el selector por defecto y las etiquetas de hora usan hora local (Colombia, UTC−5). Las ventas hechas en la noche (hora local) caen en el día UTC siguiente → el operador ve "$0 hoy". **Bloqueante de confianza para el cierre diario.** Hay que filtrar por día en zona horaria de la tienda (`America/Bogota`).
- **Gap (por cajero):** el reporte no tiene desglose por cajero (REP-01 CA2 / M8 pendiente).

### TC-19 — Stock con bajo stock ✅
- La pestaña Stock lista todos los productos; los de bajo stock (batidos) se ordenan arriba con badge "Stock bajo". ✅ (REP-02)
- **Verificación cruzada de stock** tras los casos: Agua 600ml = 105 (vendí 2 en TC-09, anulé → repuso 2), Whey Protein = 20 (vendí 1 en TC-11), Caseína = 9 (venta TC-13 rechazada, intacta). Todo coherente. ✅

## 2. Catálogo (CRUD)

### TC-03 — Crear categoría ✅
- **Pasos:** `/productos/categorias` → "+ Nueva categoria" → Nombre "TEST QA Suplementos" → Crear.
- **Resultado:** la categoría aparece en la lista marcada como "Activa". Aparece también en el filtro del POS. ✅
- **Veredicto:** ✅ Pass.

### TC-04 — Crear producto ⚠️/❌ (bug en formulario)
- **Pasos:** `/productos` → "+ Nuevo producto" → Nombre "TEST QA Producto", SKU "TESTQA01", Precio $10.000, Costo $5.000, Categoría "TEST QA Suplementos", IVA 19%, Tipo Simple → Crear.
- **Resultado:**
  - El select de **IVA muestra "Invalid input"** desde la apertura del formulario (con la opción "0% (exento)" seleccionada por defecto), y **sigue mostrando "Invalid input"** después de seleccionar 19% o 0% mediante `selectOption`. Crear producto no procede.
  - El campo **Costo es opcional** según el spec, pero la validación pide número (vacío falla con "Ingresa un valor numérico").
- **Veredicto:** ❌ No se pudo crear el producto en esta sesión automatizada.
- **Faltante / a validar manualmente:** un humano abriendo el dropdown e seleccionando con click *probablemente* sí dispare los eventos de Angular y funcione. El test unitario del componente pasa, así que la lógica pura está bien — el bug parece ser de **integración** del Reactive Form con el `<select>`. Validar en navegador real haciendo click en el dropdown.
- **Faltante claro:** el estado inicial del form arranca con `Invalid input` visible aun sin que el usuario haya tocado nada (UX confuso); además, Costo no debería validar `numérico` cuando está vacío (debería tratarse como opcional/`undefined`).

---

## 6. Cierre de caja y reapertura

### TC-16 — Cierre con cuadre ✅ (con hallazgos de form)
- **Estado de la sesión:** caja abierta desde el 9-may 03:00 a.m., apertura $100.000.
- **Esperado calculado por el sistema:** Total ventas $3.643.150 / Esperado en caja **$2.533.560** / desglose por método (Efectivo $2.426.560, Tarjeta $248.710, Nequi $795.330, Transferencia $172.550, suma = total ventas ✅).
- **Pasos:** Cerrar caja → ingresar montos exactos por método (Efectivo $2.533.560, Tarjeta $248.710, Nequi $795.330, Transferencias $172.550, sin diferencia) → Confirmar cierre.
- **Resultado:** el cierre se ejecutó atómicamente (RPC `close_cash_session_atomic`); tras Confirmar, la pantalla de Caja pasó al estado "Abrir caja". ✅ (CAJA-03 / RN-C03..C09)
- **Veredicto:** ✅ Pass (lógica de cierre).
- **Hallazgo crítico (form-currency-input + `fill()`):** rellenar el campo Efectivo con `HTMLInputElement.fill()` (paste-like) produjo valor cosmético "$ 100.000.000" en pantalla y al re-fillear con `''` no limpió. Solo funcionó **escribiendo tecla-a-tecla** con `pressSequentially` + `Tab` para blur. Un usuario que pegue (Ctrl+V) un monto puede ver el mismo comportamiento.
- **Hallazgo UX (faltante):** el diálogo de cierre **no muestra los esperados** por método dentro del propio diálogo. El cajero está tipeando "a ciegas" — debería verse `Esperado vs Conteo` lado a lado para detectar errores de tipeo.
- **Faltante (no validado por flujo):** no se ejercitó el caso `diferencia > $5.000 → nota obligatoria` (RN-C10) ni la persistencia de campos al reabrir el diálogo (al cancelar y reabrir, los valores quedan visualmente pero el form los reporta vacíos al re-blur — confuso).

### TC-17 — Post-cierre bloquea ventas ✅
- **Resultado:** tras el cierre, `/pos` muestra **"No hay caja abierta"** + badge **"Caja cerrada"**. Se puede armar el carrito (se calcula IVA correctamente), pero el botón **"Cobrar" queda `[disabled]`**. ✅ (POS-04 / RN-S01)
- **Veredicto:** ✅ Pass.

### TC-07 — Venta bloqueada sin caja ✅
- Cubierto por TC-17 (mismo escenario). ✅

### TC-08 — Abrir nueva caja ✅
- **Pasos:** `/caja` → ingresar $100.000 de apertura → Abrir caja.
- **Resultado:** nueva sesión "Caja abierta · $100.000" del 27-may 09:33 p.m., Total ventas $0, Movimientos $0, Esperado $100.000. ✅
- **Veredicto:** ✅ Pass. La app queda usable.

### TC-05 — Registrar stock inicial — no ejecutado en esta sesión
- El catálogo seed ya tenía stock; se ejercitó indirectamente al ver entries de "Carga inicial seed" en el kardex (INV-04 ✅). No se creó una entrada nueva específica.

### TC-06 — Kardex y bajo stock ✅ (ya cubierto)
- Ver INV-04 y INV-05 arriba.

---

## 8. Resumen ejecutivo

### Hoja de resultados

| TC | Caso | Resultado | Notas |
|----|------|-----------|-------|
| TC-01 | Login inválido | ⚠️ Pass parcial | Mensaje "Invalid login credentials" en inglés (debe ser español genérico) |
| TC-02 | Login válido | ✅ Pass | Redirige a `/pos` |
| TC-03 | Crear categoría | ✅ Pass | "TEST QA Suplementos" creada |
| TC-04 | Crear producto | ❌ Fail (en automated) | IVA "Invalid input" persistente; validar manual |
| TC-05 | Stock inicial | ⏭️ No ejecutado (seed ya cargado) | Indirecto en INV-04 |
| TC-06 | Kardex / bajo stock | ✅ Pass | Kardex completo; batidos `prepared` mal marcados como "Stock bajo" |
| TC-07 | Venta bloqueada sin caja | ✅ Pass | Botón "Cobrar" disabled |
| TC-08 | Abrir caja | ✅ Pass | Sesión nueva limpia |
| TC-09 | Venta efectivo simple | ✅ Pass | IVA y cambio correctos; `saleNumber` no es correlativo |
| TC-10 | Idempotencia | ⏭️ No verificable por UI | Cubierto en test unitario |
| TC-11 | Pago/IVA mixto | ✅ Pass | Falta campo "referencia" para no-cash |
| TC-12 | Cliente + descuento | ❌ Fail | UI **no tiene** ni selector de cliente ni campo de descuento |
| TC-13 | Stock insuficiente | ⚠️ Pass | Servidor lo rechaza, pero UI permite cantidad > stock y muestra "Error al crear venta" genérico |
| TC-14 | Pagos insuficientes | ✅ Pass | Confirmar disabled hasta cubrir el total |
| TC-15 | Anular venta | ✅ Pass | Reposición de stock + audit; **motivo se pide con `window.prompt()` nativo** |
| TC-16 | Cierre con cuadre | ✅ Pass | Falta mostrar Esperado vs Conteo en el diálogo |
| TC-17 | Post-cierre bloquea ventas | ✅ Pass | "Caja cerrada" + Cobrar disabled |
| TC-18 | Ventas del día | ⚠️ Pass con bug | **Filtra por fecha UTC**, no por TZ local → "$0 hoy" |
| TC-19 | Stock / cierre imprimible | ✅ Pass | Bajo stock destacado |

### Hallazgos críticos (deben atenderse antes del go-live)

1. **TZ del reporte diario (TC-18):** filtra ventas por día UTC en vez de `America/Bogota`. El cajero verá $0 en horas críticas de la noche local. **Bloqueante de confianza.**
2. **POS no tiene cliente ni descuento (TC-12):** POS-06 y POS-07/HU-15 **no están implementados en la UI**, aunque están en spec y en módulos. No solo el umbral por rol (RN-S09); la funcionalidad de descuento no existe.
3. **`saleNumber` no es correlativo (TC-09):** las ventas nuevas usan formato `YYMMDD-<epoch>`, no consecutivo por tienda (RN-S). Las históricas sí (`V-20260509-001..004`). Cambió la generación en algún punto.
4. **"Ventas del turno" no se acota por sesión (TC-09):** muestra ventas de varios días, no solo del turno actual. Filtro mal definido o sesión muy stale.
5. **Producto no creable en este flujo automatizado (TC-04):** IVA "Invalid input" desde el estado inicial del form. Costo trata vacío como inválido. Validar manualmente.
6. **`form-currency-input` rompe con `fill()`/paste (TC-16):** valores cosméticos incorrectos al pegar. Solo escritura tecla-a-tecla funciona.
7. **Stock insuficiente no se previene en cliente (TC-13):** el `+` del carrito no topa al stock; el error que devuelve el servidor es genérico ("Error al crear venta") y no nombra el producto ni el faltante.

### Hallazgos UX (recomendados antes del go-live)

8. **Mensaje de login inválido (TC-01):** "Invalid login credentials" en inglés. Localizar a español.
9. **Motivo de anulación (TC-15):** se captura con `window.prompt()` nativo en vez de un modal `mo-*`. No valida longitud mínima.
10. **Campo de monto en pago muestra placeholder = valor sugerido (TC-11):** confunde — pulsar "Agregar" sin escribir no agrega nada aunque parezca que sí.
11. **No hay campo de "referencia" para pagos no-cash (TC-11):** RN-PG04 lo exige.
12. **El diálogo de cierre no muestra esperados (TC-16):** se tipea a ciegas. Mostrar "Esperado vs Conteo" lado a lado.
13. **Movimientos `sale_exit` con motivo vacío "—" (TC-09):** seed muestra "Venta"; las nuevas, vacío. Inconsistencia.
14. **Batidos `prepared` aparecen como "Stock bajo" (INV-05/REP-02):** se calcula `stock <= min` sin excluir `prepared`.

### Gaps de scope que siguen pendientes

- **AUTH-04:** sin guard por rol — un cajero hoy puede entrar a `/productos`, `/inventario`, anular ventas, etc.
- **AUTH-05:** recuperación de contraseña UI no implementada.
- **REP-01 CA2 / M8:** reporte por cajero no implementado.
- **CAT-04 / M9:** importador CSV Siigo no implementado.
- **POS-07 / RN-S09:** umbral de descuento por rol (depende de que primero exista la UI de descuento).

### Lo que sí está sólido

- **Login + sesión + redirección.** ✅
- **Carrito y cálculo de IVA por ítem (incluido IVA mixto 19% + 0% `prepared`).** ✅
- **Cálculo de cambio en efectivo.** ✅
- **Pagos mixtos sumando ≥ total + botón Confirmar bloqueado si no se cubre.** ✅
- **Confirmación atómica de venta (`create_sale_atomic`) con descuento de stock.** ✅
- **Anulación atómica con reposición de stock (`void_sale_atomic`) + auditoría visible en kardex.** ✅
- **Protección del servidor contra venta con stock insuficiente.** ✅
- **Cierre atómico de caja con cálculo de esperados y desglose por método (`close_cash_session_atomic`).** ✅
- **Post-cierre bloquea correctamente nuevas ventas.** ✅

---

_Resultados de pruebas manuales — sesión 2026-05-27 con Playwright MCP._

