# ADR 0024 — Recargo por pago con tarjeta (Nequi Negocios)

**Estado:** Aceptado (aprobado por el dueño el 2026-10-26)

## Contexto

La tienda va a cobrar con tarjeta usando el datáfono en el celular de Nequi Negocios (NFC, procesa Wompi). Nequi descuenta de cada venta con tarjeta **1,99 % de comisión + 19 % de IVA sobre la comisión** (≈ 2,3681 %). No hay mensualidad. QR Negocios y transferencias Nequi no tienen costo. Límites por transacción con tarjeta: $1.500 – $250.000.

El dueño decidió que **el cliente asume la comisión cuando paga con tarjeta** y que lo que llega a la cuenta debe ser **exacto** al valor de la venta. Prueba real del 2026-10-26: una venta de $1.500 dejó comisión $30 + IVA $6 = $36 y un abono de $1.464. La retefuente no se incluye en el recargo (decisión del dueño).

Hoy RN-PG05 dice que no hay integración con datáfono; el método `card` existe en el modelo pero el checkout web solo ofrece efectivo y transferencia.

## Decisión

1. **Fórmula de la comisión (igual a la de Nequi):** `comisión = 1,99 % del monto` e `IVA = 19 % de la comisión`, redondeados al peso. Se calcula con fracciones enteras para no arrastrar errores de punto flotante. **La regla de redondeo es configurable** (`rounding`: mitad hacia arriba / mitad al par / hacia arriba; `ivaBase`: IVA sobre la comisión redondeada / sobre la comisión exacta / un solo redondeo del total), porque la prueba de $1.500 la cumplen 8 reglas distintas. Por defecto: mitad hacia arriba, IVA sobre la comisión redondeada. **Confirmada por el dueño el 2026-10-26** con la calculadora de Nequi ($1.558 → $37, $1.626 → $38, $1.732 → $40, $15.000 → $356); falta un cobro real de ~$15.000 para confirmar que el abono coincide con la calculadora. Para fijarla sin ambigüedad basta el costo que muestra Nequi para estos montos:

   | Monto | mitad↑ / IVA s/ com. redondeada (defecto) | mitad par / com. redondeada | techo / com. redondeada | mitad↑ / com. exacta | mitad par / com. exacta | techo / com. exacta | mitad↑ / un redondeo | techo / un redondeo |
   |---|---|---|---|---|---|---|---|---|
   | $1.558 | 37 | 37 | 39 | 37 | 37 | 38 | 37 | 37 |
   | $1.626 | 38 | 38 | 40 | 38 | 38 | 40 | 39 | 39 |
   | $1.732 | 40 | 40 | 42 | 41 | 41 | 42 | 41 | 42 |
   | $15.000 | 356 | 355 | 356 | 356 | 355 | 356 | 355 | 356 |

2. **Recargo por cálculo inverso:** para que el neto sea `X`, se cobra el **menor monto `C` tal que `C − costo(C) ≥ X`**. Como el costo nunca baja al subir el monto, el neto sube a lo sumo $1 por peso y el primer monto que cubre `X` lo cubre exacto. Verificado con las 8 reglas para todos los montos de $1.500 a $250.000: neto exacto siempre, siempre que la regla configurada sea la de Nequi. Recargo = `C − X`. No se redondea a $100 porque rompería la exactitud.
3. **Lógica de dominio pura** en `features/sales/domain/services/card-surcharge.ts` (sin Angular ni Supabase), con la tarifa como parámetro (`CardFeeConfig`).
4. **Solo aplica a la parte pagada con tarjeta.** En pago mixto, el cajero indica cuánto de la venta cubre la tarjeta; el recargo se calcula sobre esa parte.
5. **El recargo no cambia el precio de los productos ni su IVA.** Se guarda en la venta como un campo propio (`card_surcharge`) junto con la tarifa usada (snapshot), para que un cambio futuro de tarifa no altere ventas pasadas. El total cobrado = total de productos + recargo.
6. **Tarifa configurable por tienda** en Ajustes (por defecto 1,99 % + 19 % IVA), porque Nequi la puede cambiar.
7. **Aviso al cliente (Ley 1480):** el recargo se muestra en el checkout antes de confirmar y sale como línea aparte en el recibo ("Recargo pago con tarjeta"). La tienda debe tener aviso visible en el mostrador.
8. **Reportes:** las ventas se siguen reportando sin recargo; el recargo se muestra aparte (cubre la comisión, no es ingreso del negocio).

## Consecuencias

- Modifica RN-PG05 (el método `card` vuelve al checkout, con recargo automático).
- Requiere migración: columnas en `sales` y ajuste de `create_sale_atomic` para validar y persistir el recargo en el servidor (el cliente no es la autoridad).
- Cierre de caja (corregido 2026-10-26, PLAN-101): el esperado de tarjeta es lo que abona Nequi, es decir el monto SIN recargo (el recargo se va en la comisión). Coincide con `close_cash_session_atomic`, que suma `payments.amount`. El diálogo muestra aparte lo que pasó por el datáfono (monto + recargo) para cuadrar contra la app de Nequi.
- Si Nequi cambia la tarifa o el redondeo, solo cambia la configuración (`CardFeeConfig`) y su test.
- Retefuente: la página de Nequi muestra una retención de 1,5 % en ventas con tarjeta que en la prueba de $1.500 no se aplicó. Si aparece en una venta real, el neto bajará en esa retención (no es costo, es anticipo de renta) y el recargo no la cubre, por decisión del dueño.
