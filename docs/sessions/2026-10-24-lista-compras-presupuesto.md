# Spec de Sesión — 2026-10-24 — Finanzas desde cero, gastos fijos y lista de compras

## Metadatos

| Campo | Valor |
|---|---|
| Fecha | 2026-10-24 |
| Sprint | Post-MVP (mejoras) |
| Agente | Claude Code |
| HUs trabajadas | Pedido del dueño: reiniciar Finanzas, fijos permanentes, lista de compras con presupuesto |
| Estado | Completada y en producción |

## 1. Objetivo de la sesión

Decisiones del dueño (2026-10-24):

- **Reiniciar el fondo de reinversión hoy con $0.** No se borra ni anula nada: ventas, gastos y compras anteriores quedan como historial y dejan de contar para el fondo.
- **Fijos:** arriendo $2.500.000 y empleado $1.800.000 al mes, como plantillas; se registran como gasto al pagarse, pero desde el día 1 se apartan del dinero disponible.
- **Lista de compras:** pronóstico de consumo por producto + días de cobertura + stock actual, priorizado por urgencia y limitado al presupuesto (no un modelo de ML: con ~4 meses de historia un pronóstico ponderado rinde igual y se puede explicar).

Regla: pruebas solo en local; producción solo con OK del dueño.

## 2. Lo que se implementó (local)

- `fixed-commitments.ts` + tarjeta "Gastos fijos del mes" en Finanzas; resumen con "Gastos fijos por pagar" y "Dinero libre".
- `purchase-suggestions.ts` (pronóstico + presupuesto), `InventoryRepository.getConsumption`, página `/finanzas/compras` con presupuesto editable, días de cobertura, filtro por proveedor y Excel; botón "Lista de compras" en Finanzas.
- Sin migraciones.

## 3. Verificación

- 901 pruebas unitarias (10 nuevas), lint y build OK.
- Navegador local: fijos (plantilla + nómina) con pendiente y "Dinero libre"; lista con presupuesto $500.000 y 30 días → Whey 7 de 10 (parcial, $490.000), Creatina fuera del presupuesto; selector de días muestra el valor real.
- Ajustes tras probar: mínimo 7 días de historia (los productos recién creados disparaban el pronóstico) y `[selected]` en las opciones del select (mostraba 7 días calculando con 14).

## 4. Producción (hecho 2026-10-24 con OK del dueño)

- Reiniciar el fondo: `fecha_inicio = 2026-10-24`, `saldo_inicial = 0` (hoy: 0 compras y $53.996 vendidos al costo → arranca en +$53.996).
- Crear la plantilla mensual "Arriendo" $2.500.000 (categoría Arriendo). El empleado (Gustavo, $1.800.000) ya existe.
- Publicar el frontend (espera a que la sesión de diseño commitee `page-skeleton` y `busy` de `mo-menu`, de los que depende `finanzas.page.ts`).

**Aplicado:** fondo con `fecha_inicio = 2026-10-24` y `saldo_inicial = 0` (arranca en +$53.996, 0 compras hoy); plantilla mensual "Arriendo" $2.500.000 (categoría Arriendo) creada; empleado Gustavo $1.800.000 sin cambios. Frontend publicado en `main` f627ad2 (incluye f330a96 de la sesión de diseño, que había quedado sin compilar por sí solo y se completó en 86ca9b3). Netlify ready en POS y catálogo; `/finanzas/compras` responde.

**Pendiente:** corregir en el kardex los costos de ARMY EAAS SACHET (~$925.000 de más) y COLLAGEN STACK (~$226.000); revisar la lista con datos reales antes de la próxima compra.

## 5. Seed masivo y backtest del asesor (local)

- `scripts/seed-asesor-compras.sql` (+ `-limpiar.sql`), `pnpm seed:asesor`, `pnpm seed:asesor:limpiar`, `pnpm test:backtest` (`vitest.backtest.config.ts`).
- El asesor se rehízo sobre historia diaria (consumo + stock al cierre) reconstruida desde todos los movimientos (`InventoryRepository.getMovementsSince`, `buildDemandHistories`); `forecastDemand` con opciones; por defecto excluye días agotados y suma colchón z=1 (backtest: margen perdido −63%, servicio 97,1% → 99,2%). Ver tabla en `docs/modules/expenses.md`.
- Errores encontrados al armar el backtest: el trigger de componentes fecha la salida con `now()` (en el seed se corrige a la hora de la venta; en producción no aplica); `current_date` en UTC desfasaba un día (seed y backtest usan la zona de la tienda).
- Pendiente: publicar el asesor nuevo (sin migraciones); el seed y el backtest son solo locales.
