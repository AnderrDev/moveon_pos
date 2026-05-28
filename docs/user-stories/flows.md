# Historias de usuario por flujo — MOVEONAPP POS

Flujos operativos que cruzan varias features. Cada flujo describe la secuencia de pasos del
usuario, las features/HUs que toca y los criterios de aceptación del flujo completo.
Sirven para probar el sistema como lo usaría el negocio, no feature por feature.

> Para el guion completo de smoke test ver [`E2E-flujo-completo-pruebas.md`](./E2E-flujo-completo-pruebas.md).

---

## FLUJO-01 — Apertura de día / inicio de turno
**Actor:** cajero. **Precondición:** usuario activo, productos cargados.

**Pasos:**
1. Iniciar sesión en `/login` (AUTH-01).
2. Ir a `/caja` y abrir sesión con base inicial (CAJA-01).
3. Verificar en `/pos` que ya se pueden confirmar ventas.

**Criterios de aceptación:**
- [ ] CA1: Tras abrir caja, existe una `cash_session` con `status='open'` para el cajero.
- [ ] CA2: Antes de abrir caja, confirmar venta en `/pos` está bloqueado (RN-S01).
- [ ] CA3: No se puede abrir una segunda caja mientras hay una abierta (RN-C01).

---

## FLUJO-02 — Venta en efectivo simple
**Actor:** cajero. **Precondición:** caja abierta, producto con stock.

**Pasos:**
1. En `/pos`, buscar un producto por nombre o escanear su código (CAT-03).
2. Agregarlo al carrito y ajustar cantidad (POS-02).
3. Abrir el pago, elegir `cash`, ingresar monto entregado ≥ total (PAY-01).
4. Confirmar venta (POS-05). Se imprime el ticket (TCK-01).

**Criterios de aceptación:**
- [ ] CA1: El total = subtotal − descuentos + IVA por ítem (RN-S10).
- [ ] CA2: Si el efectivo entregado supera el total, se muestra el cambio correcto (PAY-02).
- [ ] CA3: Al confirmar, la venta queda `completed` con `saleNumber` correlativo.
- [ ] CA4: El stock del producto baja en la cantidad vendida (`sale_exit`).
- [ ] CA5: Se imprime/auto-imprime el ticket 80mm.

---

## FLUJO-03 — Venta con pago mixto
**Actor:** cajero. **Precondición:** caja abierta.

**Pasos:**
1. Armar el carrito con varios productos (IVA mixto: 19% / 5% / 0%).
2. En el pago, agregar dos o más métodos (ej. `cash` + `nequi`) que sumen ≥ total (PAY-01).
3. Ingresar referencia para el pago no-cash (RN-PG04).
4. Confirmar.

**Criterios de aceptación:**
- [ ] CA1: La suma de pagos ≥ total; si falta, error `PaymentTotalMismatch` y no se crea la venta.
- [ ] CA2: El IVA total es la suma de IVAs por ítem con tasas distintas (RN-S10).
- [ ] CA3: La venta registra los N pagos con su método y referencia.
- [ ] CA4: El cambio (si hay) solo se calcula sobre la porción `cash`.

---

## FLUJO-04 — Venta con cliente y descuento
**Actor:** cajero/admin. **Precondición:** caja abierta, cliente existente.

**Pasos:**
1. Crear o buscar un cliente (CLI-01 / CLI-02) y asociarlo a la venta (POS-06).
2. Aplicar un descuento por ítem y/o global (POS-07).
3. Confirmar y verificar el total con descuento.

**Criterios de aceptación:**
- [ ] CA1: La venta queda asociada al `clienteId`.
- [ ] CA2: El descuento reduce el total y se refleja en `discountTotal`.
- [ ] ⚠️ CA3: (Gap) El umbral de descuento por rol (RN-S09) no está implementado: documentar el comportamiento real observado.

---

## FLUJO-05 — Anulación de venta
**Actor:** admin. **Precondición:** existe una venta `completed` en la sesión.

**Pasos:**
1. Ubicar la venta en el historial (POS-09).
2. Anularla indicando un motivo (POS-08).
3. Verificar la reposición de stock y la auditoría.

**Criterios de aceptación:**
- [ ] CA1: La venta pasa a `status='voided'` con `voided_by/at/reason`.
- [ ] CA2: Por cada ítem se crea un `void_return` y el stock vuelve a subir (RN-S07).
- [ ] CA3: Queda registro en `audit_logs`; la operación es atómica (`void_sale_atomic`).
- [ ] CA4: La venta original no se borra ni se edita (salvo campos `voided_*` y `status`) (RN-S06).
- [ ] ⚠️ CA5: (Gap) La restricción "solo admin" depende del guard por rol pendiente.

---

## FLUJO-06 — Cierre de caja / fin de turno
**Actor:** cajero. **Precondición:** caja abierta con ventas/movimientos del turno.

**Pasos:**
1. En `/caja`, iniciar el cierre (CAJA-03).
2. Revisar `expected_cash_amount` y `expected_sales_amount` calculados por el sistema.
3. Contar el efectivo físico e ingresar `actual_cash_amount`; confirmar montos no-efectivo por método.
4. Si hay diferencia > $5.000, escribir la nota de cierre.
5. Cerrar y revisar el reporte imprimible (REP-03).

**Criterios de aceptación:**
- [ ] CA1: El efectivo esperado = base + ventas efectivo + cash_in − cash_out/expense (RN-C03).
- [ ] CA2: Las ventas esperadas = total de ventas completadas del turno (RN-C04).
- [ ] CA3: Se muestran `difference` y `sales_difference` correctamente.
- [ ] CA4: Diferencias > $5.000 COP exigen nota antes de cerrar (RN-C10).
- [ ] CA5: El cierre es atómico (`close_cash_session_atomic`) y la sesión queda `closed`.
- [ ] CA6: Tras cerrar, `/pos` vuelve a bloquear ventas hasta abrir otra caja.

---

## FLUJO-07 — Gestión de catálogo e inventario (preparación previa)
**Actor:** admin. **Precondición:** sesión iniciada.

**Pasos:**
1. Crear una categoría (CAT-01).
2. Crear un producto en esa categoría con precio e IVA (CAT-02).
3. Registrar una entrada de stock para ese producto (INV-02).
4. Verificar el stock en `/inventario` y el kardex (INV-04).

**Criterios de aceptación:**
- [ ] CA1: El producto aparece en `/pos` (activo) y es buscable (CAT-03).
- [ ] CA2: Tras la entrada, el stock refleja la cantidad ingresada (INV-01).
- [ ] CA3: El kardex muestra el movimiento `entry` con su motivo.
- [ ] CA4: Un producto desactivado desaparece de `/pos` pero sigue en reportes (RN-P03).
