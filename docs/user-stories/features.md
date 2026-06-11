# Historias de usuario por feature — MOVEONAPP POS

HUs agrupadas por feature, con criterios de aceptación verificables como checklist de prueba.
Cada HU referencia, donde aplica, la regla de negocio (`RN-*`) del módulo en `/docs/modules/` y la
HU original (`HU-XX`) de los sprints.

> Estado: ✅ implementado · ⚠️ parcial/gap · ❌ pendiente. Rutas reales de la app entre `código`.

---

## 1. Auth (`/login`) — módulo `auth`

### AUTH-01 — Iniciar sesión (HU-01) ✅
**Como** usuario (admin o cajero) **quiero** iniciar sesión con email y contraseña **para** acceder al sistema.
- [ ] CA1: `/login` es accesible sin autenticación.
- [ ] CA2: Con credenciales válidas, ingreso y soy redirigido a `/pos`.
- [ ] CA3: Con credenciales inválidas, veo un mensaje de error genérico (sin revelar si falló email o contraseña).
- [ ] CA4: Estando autenticado, cualquier ruta protegida es accesible; sin sesión, `authGuard` me manda a `/login`.
- [ ] CA5: El formulario valida email con formato válido y contraseña mínima (Zod).

### AUTH-02 — Cerrar sesión (HU-02) ✅
**Como** usuario autenticado **quiero** cerrar sesión **para** proteger mi cuenta.
- [ ] CA1: Existe acción "Cerrar sesión" en el shell.
- [ ] CA2: Al cerrar, la sesión Supabase termina y vuelvo a `/login`.
- [ ] CA3: No puedo volver a una ruta protegida con el botón "atrás" del navegador.

### AUTH-03 — Acceso solo a usuarios activos (RN-A01) ⚠️
**Como** administrador **quiero** que solo usuarios `is_active = true` en `user_tiendas` entren.
- [ ] CA1: Un usuario inactivo no puede operar la app.
- [ ] ⚠️ Gap: validar mensaje "Usuario sin acceso" y comportamiento exacto contra la implementación actual.

### AUTH-04 — Separación de capacidades por rol (RN-A03, RN-S08, RN-I04) ✅
**Como** administrador **quiero** que el cajero no acceda a funciones de admin.
- [ ] CA1: Cajero no ve ni navega a `/productos`, `/inventario`, `/reportes` ni `/productos/categorias`.
- [ ] CA2: Cajero no ve la acción "Anular" en ventas del turno.
- [ ] CA3: Admin mantiene acceso completo.

### AUTH-05 — Recuperación de contraseña ✅
**Como** usuario **quiero** recuperar mi contraseña.
- [ ] CA1: `/recuperar-contrasena` solicita email sin revelar si existe.
- [ ] CA2: `/restablecer-contrasena` permite fijar una nueva contraseña con sesión Supabase válida.
- [ ] CA3: Supabase Auth debe tener configurados Site URL, Redirect URLs y plantilla de email en el dashboard.

---

## 2. Catálogo: Productos y Categorías (`/productos`, `/productos/categorias`) — módulo `products`

### CAT-01 — CRUD de categorías (HU-03) ✅
**Como** admin **quiero** crear/editar/desactivar categorías **para** organizar el catálogo.
- [ ] CA1: `/productos/categorias` lista las categorías de la tienda.
- [ ] CA2: Puedo crear una categoría con nombre obligatorio.
- [ ] CA3: Puedo editar el nombre de una categoría.
- [ ] CA4: Puedo desactivar una categoría sin borrar sus productos.
- [ ] CA5: No se permiten dos categorías activas con el mismo nombre en la tienda.

### CAT-02 — CRUD de productos (HU-04) ✅
**Como** admin **quiero** gestionar productos **para** tener disponibles los correctos en venta.
- [ ] CA1: `/productos` lista productos con nombre, SKU, código de barras, categoría, precio, IVA, stock y estado.
- [ ] CA2: Puedo crear un producto con nombre, precio de venta > 0, IVA en {0, 5, 19}, tipo {simple, prepared, ingredient}.
- [ ] CA3: SKU y código de barras son únicos por tienda (RN-P01); duplicar muestra error.
- [ ] CA4: Puedo editar todos los campos; el cambio de precio queda en `audit_logs` (RN-P02).
- [ ] CA5: Puedo desactivar un producto; los inactivos no aparecen en `/pos` (RN-P03).
- [ ] CA6: Validación con Zod visible al usuario en cada campo inválido.

### CAT-03 — Búsqueda de productos (HU-05) ✅
**Como** cajero **quiero** encontrar productos rápido **para** agregarlos a la venta.
- [ ] CA1: La búsqueda matchea nombre, SKU y código de barras.
- [ ] CA2: Solo aparecen productos activos.
- [ ] CA3: Escanear/escribir un código de barras exacto selecciona el producto directamente.
- [ ] CA4: La búsqueda es responsiva (debounce) y usa el cache de productos (no refetchea cada tecla).

### CAT-04 — Importación CSV desde Siigo ✅
**Como** admin **quiero** importar productos por CSV **para** migrar desde Siigo.
- [ ] CA1: El script CLI valida el CSV antes de escribir.
- [ ] CA2: Inserta categorías/productos faltantes sin sobrescribir duplicados.
- [ ] CA3: `stock_inicial` genera `inventory_movements.entry` en `bodega`.

---

## 3. Inventario (`/inventario`) — módulo `inventory`

### INV-01 — Stock como suma de movimientos por ubicación (RN-I01, RN-I07) ✅
**Como** sistema **quiero** que el stock sea la suma de `inventory_movements` **para** trazabilidad total.
- [ ] CA1: El stock mostrado coincide con `get_stock(producto, tienda, ubicacion)`.
- [ ] CA2: Ningún flujo modifica un campo `stock` directamente.

### INV-02 — Registrar entrada de mercancía (HU-06) ✅
**Como** admin **quiero** registrar entradas **para** sumar stock.
- [ ] CA1: Puedo registrar una entrada (`entry`, cantidad positiva) para un producto.
- [ ] CA2: Por defecto la entrada aumenta `bodega`; puedo elegir `punto_venta` si aplica.

### INV-03 — Ajustar stock con motivo (RN-I02, RN-I03, RN-I05) ✅
**Como** admin **quiero** ajustar stock **para** corregir diferencias de inventario físico.
- [ ] CA1: Puedo crear un `adjustment` positivo o negativo.
- [ ] CA2: El ajuste exige ubicación y motivo.
- [ ] CA3: El ajuste queda registrado en `audit_logs`.

### INV-04 — Kardex por producto (HU-08) ✅
**Como** admin **quiero** ver el historial de movimientos de un producto.
- [ ] CA1: El kardex lista movimientos con tipo, cantidad, fecha y motivo.
- [ ] CA2: Incluye `entry`, `sale_exit`, `adjustment`, `void_return`, `transfer_out`, `transfer_in` y ubicación.

### INV-05 — Alerta de bajo stock (HU-09) ✅
**Como** admin **quiero** ver productos bajo el mínimo **para** reabastecer a tiempo.
- [ ] CA1: Los productos con stock < `stock_minimo` aparecen destacados.
- [ ] CA2: El cálculo usa `punto_venta`, no el total con bodega.

### INV-06 — Permisos de inventario (RN-I04) ✅
- [ ] CA1: Solo admin accede a `/inventario`.
- [ ] CA2: Solo admin crea `entry`, `adjustment` y traslados.

### INV-07 — Trasladar entre Bodega y Punto de venta (RN-I08) ✅
**Como** admin **quiero** trasladar mercancía **para** mover stock vendible al mostrador sin perder trazabilidad.
- [ ] CA1: Puedo trasladar de `bodega` a `punto_venta` y viceversa.
- [ ] CA2: No puedo trasladar más de lo disponible en el origen.
- [ ] CA3: El traslado crea `transfer_out` y `transfer_in` con el mismo `referencia_id`.

---

## 4. Caja (`/caja`) — módulo `cash-register`

### CAJA-01 — Abrir caja con base inicial (HU-10, RN-C01) ✅
**Como** cajero **quiero** abrir caja con base **para** poder vender.
- [ ] CA1: Puedo abrir una sesión con `opening_amount`.
- [ ] CA2: Solo puedo tener 1 sesión `open` a la vez.
- [ ] CA3: Con caja cerrada, `/pos` no permite confirmar ventas (RN-C02 / RN-S01).

### CAJA-02 — Movimientos manuales de caja (HU-11) ✅
**Como** cajero **quiero** registrar ingresos/egresos **para** reflejar dinero que entra/sale del cajón.
- [ ] CA1: Puedo registrar `cash_in`, `cash_out`/`expense` con monto y nota.
- [ ] CA2: Los movimientos afectan el efectivo esperado en el cierre (RN-C03).

### CAJA-03 — Cierre de caja con cuadre (HU-12, RN-C03..C10) ✅
**Como** cajero **quiero** cerrar la caja **para** cuadrar el turno.
- [ ] CA1: El cierre calcula `expected_cash_amount` (base + ventas efectivo + cash_in − cash_out/expense).
- [ ] CA2: El cierre calcula `expected_sales_amount` (total de ventas completadas, todos los medios).
- [ ] CA3: Ingreso `actual_cash_amount` (efectivo contado) y confirmo montos no-efectivo por método.
- [ ] CA4: Se muestra `difference` (efectivo físico) y `sales_difference` (ventas del turno).
- [ ] CA5: Diferencias > $5.000 COP exigen nota de cierre (RN-C10).
- [ ] CA6: El cierre se ejecuta de forma atómica vía RPC `close_cash_session_atomic`.

---

## 5. POS / Ventas (`/pos`) — módulos `sales`, `payments`

### POS-01 — Pantalla de venta con búsqueda dual (HU-13) ✅
- [ ] CA1: `/pos` permite buscar por escritura y por scanner (código de barras).
- [ ] CA2: Solo productos activos son agregables.

### POS-02 — Carrito editable (HU-14) ✅
- [ ] CA1: Puedo agregar productos, cambiar cantidades y quitar líneas.
- [ ] CA2: El subtotal, IVA y total se recalculan al instante (IVA por ítem según `iva_tasa`, RN-S10).

### POS-03 — Validación de stock (HU-20, RN-S02) ✅
- [ ] CA1: No puedo confirmar una venta con cantidad > stock para productos `simple`/`ingredient`.
- [ ] CA2: La validación usa stock en `punto_venta`; stock en `bodega` no habilita venta.
- [ ] CA3: Productos `prepared` (batidos) no bloquean por stock.

### POS-04 — Caja abierta obligatoria (HU-19, RN-S01) ✅
- [ ] CA1: Sin sesión `open`, el botón de confirmar venta está bloqueado o devuelve `CashSessionNotOpen`.

### POS-05 — Confirmar venta atómica (RN-S04..S07) ✅
- [ ] CA1: La venta se crea vía RPC `create_sale_atomic` (insert sale + items + payments + `sale_exit`).
- [ ] CA2: Se genera `saleNumber` correlativo por tienda.
- [ ] CA3: `producto_nombre`/`producto_sku` quedan como snapshot en el ítem (RN-S05).
- [ ] CA4: Reenviar con el mismo `idempotencyKey` devuelve la misma venta, sin duplicar (RN-S04).
- [ ] CA5: Tras confirmar, el stock `punto_venta` de cada producto disminuye en la cantidad vendida.

### POS-06 — Cliente opcional en la venta (HU-16, RN-CL01) ✅
- [ ] CA1: Puedo confirmar una venta sin cliente.
- [ ] CA2: Puedo asociar un cliente existente a la venta.

### POS-07 — Descuentos (HU-15, RN-S09) ⚠️
- [ ] CA1: Puedo aplicar un descuento por ítem y/o global que reduce el total.
- [ ] ⚠️ Gap: el umbral de descuento por rol (cajero ≤ 10%, mayor requiere admin/auditoría) no está implementado.

### POS-08 — Anular venta con reposición de stock (HU-21, RN-S07, RN-S08) ✅
**Como** admin **quiero** anular una venta **para** corregir un error, reponiendo stock.
- [ ] CA1: La anulación marca `status='voided'` y registra `voided_by/at/reason`.
- [ ] CA2: Por cada ítem se crea un `void_return` en `punto_venta` (cantidad positiva) y el stock vuelve a subir.
- [ ] CA3: Queda registro en `audit_logs`. Se ejecuta atómicamente (`void_sale_atomic`).
- [ ] CA4: Solo admin puede anular.

### POS-09 — Historial de ventas del día (HU-22) ✅
- [ ] CA1: Puedo ver las ventas de la sesión/día con su número, total y estado.

### PAY-01 — Pagos mixtos (HU-17, RN-PG01..PG04) ✅
- [ ] CA1: Una venta admite varios pagos con métodos `cash`, `card`, `nequi`, `daviplata`, `transfer`, `other`.
- [ ] CA2: La suma de pagos debe ser ≥ total (RN-PG02 / RN-S03); si falta, error `PaymentTotalMismatch`.
- [ ] CA3: Pagos no-cash permiten ingresar `referencia` manualmente.

### PAY-02 — Cálculo de cambio (HU-18, RN-PG02) ✅
- [ ] CA1: Si el efectivo entregado supera el total, se muestra el cambio.
- [ ] CA2: El cambio solo aplica al método `cash`.

---

## 6. Clientes (`/clientes`) — módulo `customers`

### CLI-01 — CRUD de clientes (HU-23) ✅
- [ ] CA1: Puedo crear/editar clientes con datos básicos.
- [ ] CA2: Documento + tipo es único por tienda (RN-CL03).

### CLI-02 — Buscar cliente (RN módulo) ✅
- [ ] CA1: Puedo buscar por documento, nombre o teléfono y seleccionarlo en la venta.

### CLI-03 — Datos fiscales para factura (RN-CL02) ⚠️/❌
- [ ] ⚠️ Gap: la obligatoriedad de datos fiscales aplica cuando exista facturación electrónica (v1.1).

---

## 7. Reportes (`/reportes`) — módulo `reports`

### REP-01 — Ventas del día (HU-24) ✅
- [ ] CA1: Muestra total del día y desglose por método de pago.
- [ ] CA2: Muestra desglose por cajero.

### REP-02 — Stock con alerta de bajo stock (HU-26) ✅
- [ ] CA1: Lista stock `punto_venta`, `bodega`, total y destaca productos bajo el mínimo de punto de venta.

### REP-03 — Cierre de caja imprimible (HU-25) ✅
- [ ] CA1: Existe el reporte de cierre con esperado/confirmado, diferencia de efectivo y diferencia de ventas.

### REP-04 — Detalle de ventas por fecha ⚠️
- [ ] ⚠️ Gap: filtros avanzados de detalle por fecha/cajero parcialmente cubiertos.

---

## 8. Tickets / Impresión (módulo POS — `receipt-*`) — feature transversal

### TCK-01 — Ticket interno 80mm (HU-27) ✅
- [ ] CA1: Al confirmar una venta se imprime/auto-imprime un ticket 80mm (no fiscal).
- [ ] CA2: El ticket incluye encabezado de tienda (de `tienda-info.service`), ítems, IVA, total, pagos y cambio.
- [ ] CA3: Puedo reimprimir el ticket de una venta.
- [ ] CA4: Los estilos `@media print` aíslan el ticket (solo se imprime el área del recibo).
- [ ] ⚠️ CA5: Pendiente validación en impresora térmica física real.
