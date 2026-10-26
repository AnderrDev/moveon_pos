# Spec de Sesión — 2026-10-26 — Pagos con tarjeta vía Nequi Negocios (recargo por comisión)

> Copia este archivo como `YYYY-MM-DD-<tema-kebab-case>.md` al inicio de cada sesión de trabajo.
> Llénalo durante y al final de la sesión. Es el registro de lo que pasó.

---

## Metadatos

| Campo | Valor |
|---|---|
| Fecha | 2026-10-26 |
| Sprint | Sprint XX |
| Agente | Claude Code |
| HUs trabajadas | HU-XX, HU-YY |
| Estado | En progreso (investigación + diseño) |

---

## 1. Objetivo de la sesión

Investigar las tarifas de Nequi Negocios y plantear el cobro con tarjeta en el POS sumando al cliente la comisión que nos descuentan.

### Tarifas Nequi Negocios (nequi.com.co/negocios/app-negocios, consultado 2026-10-26)
- Tarjeta débito/crédito (datáfono NFC, procesa Wompi): 1,99 % + IVA 19 % sobre la comisión = 2,368 % efectivo. Además retefuente 1,5 % (anticipo de renta, no es costo si se declara renta). Límites $1.500–$250.000 por transacción.
- Link de pago: 1,5 % + IVA (Nequi/Bancolombia), 2,69 % + IVA (otros bancos/PSE).
- QR Negocios / transferencia Nequi: gratis.
- Sin cuota mensual. Tope diario tarjeta+link $10.000.000.
- Legal (Ley 1480): el recargo debe informarse al cliente antes de pagar.

---

## 2. Lo que se implementó

### 2.1 Archivos creados
- `docs/adr/0024-recargo-pago-con-tarjeta.md` — ADR propuesto del recargo.
- `apps/pos-angular/src/app/features/sales/domain/services/card-surcharge.ts` — comisión Nequi, cálculo inverso exacto y límites.
- `tests/unit/features/sales/card-surcharge.test.ts` — prueba real ($1.500 → $1.464) y neto exacto en todo el rango.
- `supabase/migrations/20261026000100_card_surcharge.sql` — PLAN-99: columnas `card_surcharge` (payments, sales) y snapshot de tarifa; `card_fee_config`, `card_fee_amount`, `card_charge_for`; `create_sale_atomic` valida y guarda el recargo; `correct_payment_atomic` bloquea correcciones con tarjeta. Aplicada SOLO en local.
- `tests/integration/card-surcharge.parity.test.ts` — paridad SQL = TS en todo el rango y contrato de la venta (11 tests).

### 2.2 Archivos modificados
- `docs/plan-de-trabajo.md` — bloque PLAN-97..102 (pago con tarjeta).
- `docs/modules/payments.md` — RN-PG05 modificada, RN-PG06..09.
- `docs/adr/0024-recargo-pago-con-tarjeta.md` — Aceptado.
- PLAN-100 (checkout): `pos-checkout.store.ts` (vista previa, límites, recargo por pago), `pos-cart.store.ts` (`cardSurchargeTotal`, `totalToCharge`), `pos-checkout-dialog.component.ts` (botón Tarjeta, "Pasar por el datáfono", recargo y total a cobrar), `pos.page.ts` (tarifa de la tienda), `tienda-info.service.ts` (`pagoTarjeta`), `src/shared/lib/payment-methods.ts` (`CHECKOUT_PAYMENT_METHOD_OPTIONS`).
- Ventas: `sale.dto.ts` (`cardSurcharge` validado), `sales.repository.ts` (envía/lee `card_surcharge`), `sale.entity.ts` y `sale.mapper.ts` (`cardSurcharge`).
- `tests/integration/support/local-stack.ts` — helper `psqlQuery`. Tests unitarios del checkout, DTO y contrato del repositorio; fixtures con `cardSurcharge: 0`.

### 2.3 Archivos eliminados
- (si aplica)

---

## 3. Decisiones tomadas

- El recargo cubre solo comisión + IVA (no la retefuente) — decisión del dueño, validada con prueba real en Nequi: $1.500 → costo $36 → abono $1.464.
- Neto exacto: se cobra el menor monto cuyo neto cubre la venta; sin redondeo a $100. Verificado exacto para todos los montos de $1.500 a $250.000.
- Revisión de precisión: la prueba de $1.500 la cumplen 8 reglas de redondeo; `card-surcharge.ts` quedó configurable (`rounding`, `ivaBase`) con defecto mitad↑ / IVA sobre comisión redondeada. Montos que la definen: $1.558, $1.626, $1.732, $15.000 (tabla en ADR 0024 §1). Tests contrastados con un cálculo decimal independiente.
- Regla confirmada por el dueño en la calculadora de Nequi: $1.558 → $37, $1.626 → $38, $1.732 → $40, $15.000 → $356 (mitad↑, IVA sobre comisión redondeada = defecto).
- PLAN-99/100: el recargo se guarda aparte del total y del monto del pago (no altera reportes, caja ni iOS); el servidor recalcula y rechaza si no coincide con lo mostrado, para que nunca se guarde algo distinto a lo cobrado por el datáfono.
- Verificado en el navegador contra local: venta $85.000 con tarjeta → datáfono $87.062, guardada como total 85.000 + recargo 2.062 (V-000013); mixto $50.000 efectivo + $35.000 tarjeta → recargo $848.
- **Orden de despliegue:** aplicar la migración en el remoto ANTES de subir el frontend a main: el web nuevo selecciona `card_surcharge` y sin la columna fallarían las consultas de ventas.
- 2026-10-26: commit `ab918c9` en dev. Migración `20261026000100` aplicada en producción con OK del dueño (una transacción vía `db query --linked -f`, registrada en `schema_migrations`). Antes se verificó que `create_sale_atomic` y `correct_payment_atomic` en producción eran idénticos (md5) a los cuerpos copiados del repo; después, las 5 funciones quedaron con el mismo md5 que en local y `card_fee_amount` da 36/37/38/40/356. El frontend publicado sigue compatible (misma firma; pagos sin `card_surcharge` = 0). El web con tarjeta aún NO está en main.
- PLAN-101 hecho: tirilla (`esc-pos-receipt.builder.ts`), detalle (`sale-detail-body.component.ts`), cierre (`close-session.dialog.ts`, form factory/mapper, `caja.page.ts`), reportes (`sales-summary.ts`, `report.entity.ts`, `daily-kpi-cards.component.ts`). Decisión: el esperado de tarjeta en el cierre es lo que abona Nequi (sin recargo), no lo pasado por el datáfono — así cuadra con lo que llega a la cuenta y con el RPC de cierre, sin migración. ADR 0024 corregido. Verificado en local: fila Tarjeta $85.000 con nota de $87.062; detalle V-000013 con recargo; reporte con "+ $2.062 recargo tarjeta".
- (Histórico) Pendiente PLAN-101: línea del recargo en la tirilla, esperado de tarjeta en el cierre de caja, recargo en detalle/reportes.
- Próximo paso: cobro real de ~$15.000 para validar abono vs calculadora; aprobación del ADR 0024 (PLAN-98) antes de la migración (PLAN-99).

_Decisiones que no quedaron en ADR pero son relevantes para el contexto._

| Decisión | Alternativa descartada | Razón |
|---|---|---|
| | | |

---

## 4. ADRs creados o actualizados

- `docs/adr/XXXX-titulo.md` — resumen de una línea

---

## 5. Tests

- [ ] `pnpm typecheck` — pasó / falló
- [ ] `pnpm lint` — pasó / falló
- [ ] `pnpm test` — X tests pasaron, Y fallaron

Detalle de fallos (si los hay):

---

## 6. Bloqueos y preguntas pendientes

_Lo que impidió avanzar o quedó sin resolver._

- [ ] Pregunta: ...
- [ ] Bloqueado por: ...

---

## 7. Próximos pasos

_Qué debe hacer el próximo agente o sesión para continuar._

1. Continuar con HU-XX criterio CA-Y
2. Resolver el bloqueo de [...]
3. Crear test de integración para [...]

---

## 8. Notas adicionales

_Contexto que no encaja en las secciones anteriores pero que el próximo agente debe saber._
