# Flujo completo de pruebas (E2E) — MOVEONAPP POS

Guion de **smoke test del happy path** para arrancar QA del MVP. Cubre de punta a punta:
preparación → login → catálogo → apertura de caja → ventas → anulación → cierre → reportes.

Ejecútalo en orden. Marca cada caso (`TC-XX`) como Pass/Fail y anota el resultado real.
Referencias: features en [`features.md`](./features.md), flujos en [`flows.md`](./flows.md), reglas en `/docs/modules/`.

---

## 0. Pre-requisitos del entorno

- [ ] **PRE-1:** Proyecto Supabase activo (no pausado). Verificar `auth/v1/health` → HTTP 200 con la anon key.
- [ ] **PRE-2:** `apps/pos-angular/public/runtime-config.json` apunta a la URL real del proyecto (no `placeholder`). Regenerar con `node scripts/generate-runtime-config.mjs` si hace falta.
- [ ] **PRE-3:** App levantada: `pnpm dev` → http://localhost:4200.
- [ ] **PRE-4:** Migraciones aplicadas en la DB de prueba (incluye `create_sale_atomic`, `void_sale_atomic`, `close_cash_session_atomic`).
- [ ] **PRE-5:** Existe al menos un usuario **admin** y, si se prueba rol, un **cajero**, activos en `user_tiendas`, con una `tienda` asignada.

> Datos de prueba sugeridos: producto A (`simple`, IVA 19%, precio $10.000, stock 20), producto B (`simple`, IVA 5%, precio $5.000, stock 20), producto C (`prepared`/batido, IVA 0%, precio $8.000, sin control de stock).

---

## 1. Autenticación

**TC-01 — Login inválido**
1. En `/login`, ingresar email válido + contraseña incorrecta.
- [ ] Esperado: mensaje de error genérico; **no** ingresa. (AUTH-01 / CA3)

**TC-02 — Login válido**
1. Ingresar credenciales del admin.
- [ ] Esperado: ingreso correcto y redirección a `/pos`. (AUTH-01 / CA2)

---

## 2. Preparación de catálogo e inventario (admin)

**TC-03 — Crear categoría**
1. En `/productos/categorias`, crear "Suplementos".
- [ ] Esperado: aparece en la lista. (CAT-01)

**TC-04 — Crear productos**
1. En `/productos`, crear productos A, B y C (datos sugeridos arriba).
- [ ] Esperado: se crean; SKU/código de barras únicos por tienda. (CAT-02)
- [ ] Esperado: intentar duplicar SKU muestra error. (CAT-02 / CA3)

**TC-05 — Registrar stock inicial**
1. En `/inventario`, registrar entrada de 20 unidades para A y 20 para B.
- [ ] Esperado: stock A = 20, stock B = 20. (INV-02 / INV-01)

**TC-06 — Verificar kardex y bajo stock**
1. Abrir el kardex de A.
- [ ] Esperado: aparece el movimiento `entry` con motivo. (INV-04)
- [ ] Esperado: productos bajo `stock_minimo` se destacan en `/inventario`. (INV-05)

---

## 3. Apertura de caja

**TC-07 — Venta bloqueada sin caja**
1. Ir a `/pos` y armar un carrito; intentar confirmar.
- [ ] Esperado: confirmar está bloqueado / devuelve `CashSessionNotOpen`. (POS-04 / RN-S01)

**TC-08 — Abrir caja**
1. En `/caja`, abrir sesión con base $100.000.
- [ ] Esperado: sesión `open`; `/pos` ya permite confirmar. (CAJA-01 / FLUJO-01)
- [ ] Esperado: intentar abrir otra caja falla (RN-C01).

---

## 4. Ventas

**TC-09 — Venta efectivo simple**
1. En `/pos`, agregar 2× producto A (IVA 19%). Total esperado = 2 × $10.000 + IVA.
2. Pagar con `cash`, entregando un monto mayor al total.
- [ ] Esperado: total e IVA correctos. (POS-02 / RN-S10)
- [ ] Esperado: cambio correcto = entregado − total. (PAY-02)
- [ ] Esperado: venta `completed` con `saleNumber` correlativo. (POS-05)
- [ ] Esperado: stock A baja a 18. (POS-05 / CA5)
- [ ] Esperado: se imprime/auto-imprime el ticket térmico de 58 mm sin avance excesivo de papel. (TCK-01)

**TC-10 — Idempotencia**
1. Reintentar confirmar la misma venta (doble click / reintento de red).
- [ ] Esperado: **no** se crea una segunda venta; se devuelve la original. (POS-05 / RN-S04)

**TC-11 — Venta con pago mixto e IVA mixto**
1. Carrito: 1× A (19%) + 1× B (5%) + 1× C (0%, batido).
2. Pago: parte `cash` + parte `nequi` (con referencia) que sumen ≥ total.
- [ ] Esperado: IVA total = suma de IVAs por ítem. (FLUJO-03 / CA2)
- [ ] Esperado: la venta registra ambos pagos con referencia en el no-cash. (PAY-01)
- [ ] Esperado: el producto C (`prepared`) no bloquea por stock. (POS-03 / RN-S02)

**TC-12 — Venta con cliente y descuento**
1. Crear/seleccionar un cliente (CLI-01/02) y asociarlo.
2. Aplicar un descuento por ítem o global; confirmar.
- [ ] Esperado: venta asociada al cliente; total con descuento aplicado. (FLUJO-04)
- [ ] Anotar: comportamiento real del umbral de descuento (gap RN-S09).

**TC-13 — Stock insuficiente**
1. Intentar vender una cantidad de A mayor al stock disponible.
- [ ] Esperado: error `InsufficientStock`; la venta no se crea. (POS-03 / RN-S02)

**TC-14 — Pagos insuficientes**
1. Intentar confirmar con suma de pagos < total.
- [ ] Esperado: error `PaymentTotalMismatch`; la venta no se crea. (PAY-01 / RN-S03)

---

## 5. Anulación (admin)

**TC-15 — Anular venta**
1. En el historial (POS-09), anular la venta de TC-09 con un motivo.
- [ ] Esperado: queda `voided` con `voided_by/at/reason`. (POS-08)
- [ ] Esperado: stock A vuelve a subir (de 18 a 20) vía `void_return`. (POS-08 / RN-S07)
- [ ] Esperado: queda registro en `audit_logs`. (POS-08 / CA3)

---

## 6. Cierre de caja

**TC-16 — Cierre con cuadre**
1. En `/caja`, iniciar el cierre.
2. Revisar efectivo esperado y ventas esperadas calculados.
3. Contar efectivo, ingresar `actual_cash_amount` y confirmar montos no-efectivo.
- [ ] Esperado: efectivo esperado = base + ventas efectivo + cash_in − cash_out (RN-C03).
- [ ] Esperado: ventas esperadas = total de ventas completadas del turno (RN-C04).
- [ ] Esperado: se muestran `difference` y `sales_difference`. (CAJA-03)
- [ ] Esperado: diferencia > $5.000 exige nota de cierre. (RN-C10)
- [ ] Esperado: la sesión queda `closed` (atómico). (CAJA-03 / CA6)

**TC-17 — Post-cierre**
1. Volver a `/pos` y armar carrito; intentar confirmar.
- [ ] Esperado: ventas bloqueadas hasta abrir nueva caja. (FLUJO-06 / CA6)

---

## 7. Reportes

**TC-18 — Ventas del día**
1. En `/reportes`, abrir ventas del día.
- [ ] Esperado: total del día y desglose por método de pago. (REP-01)
- [ ] Anotar: desglose por cajero (gap M8).

**TC-19 — Stock y cierre imprimible**
- [ ] Esperado: reporte de stock con bajo stock destacado. (REP-02)
- [ ] Esperado: reporte de cierre imprimible con esperado/confirmado y diferencias. (REP-03)

---

## Hoja de resultados

| TC | Caso | Resultado (Pass/Fail) | Notas |
|----|------|----------------------|-------|
| TC-01 | Login inválido | | |
| TC-02 | Login válido | | |
| TC-03 | Crear categoría | | |
| TC-04 | Crear productos | | |
| TC-05 | Stock inicial | | |
| TC-06 | Kardex / bajo stock | | |
| TC-07 | Venta bloqueada sin caja | | |
| TC-08 | Abrir caja | | |
| TC-09 | Venta efectivo simple | | |
| TC-10 | Idempotencia | | |
| TC-11 | Pago/IVA mixto | | |
| TC-12 | Cliente + descuento | | |
| TC-13 | Stock insuficiente | | |
| TC-14 | Pagos insuficientes | | |
| TC-15 | Anular venta | | |
| TC-16 | Cierre con cuadre | | |
| TC-17 | Post-cierre bloquea ventas | | |
| TC-18 | Ventas del día | | |
| TC-19 | Stock / cierre imprimible | | |

---

## Gaps a vigilar durante las pruebas

- **Roles:** guard por rol implementado; mantener prueba admin/cajero en cada regresión. (AUTH-04)
- **Descuentos:** umbral por rol (RN-S09) no implementado. (POS-07 / TC-12)
- **Recuperación de contraseña:** UI implementada; falta validar Redirect URLs/plantilla en Supabase. (AUTH-05)
- **Inventario por ubicación:** bodega no habilita venta hasta trasladar a punto de venta. (INV-07/POS-03)
- **Ticket térmico:** validar en impresora física real. (TCK-01)
