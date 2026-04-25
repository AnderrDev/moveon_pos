# Sprint 3 — Pantalla de venta + Pagos

**Duración estimada:** 1.5 semanas full-time / 3 semanas part-time.
**Pre-requisito:** Sprint 2 cerrado. Este es el sprint más crítico del MVP.

---

## HUs planeadas (a detallar al iniciar el sprint)

- HU-13: Pantalla `/pos` con búsqueda dual (scanner + manual).
- HU-14: Agregar productos al carrito y editar cantidades.
- HU-15: Aplicar descuento por ítem o global.
- HU-16: Seleccionar cliente opcional.
- HU-17: Modal de pago con métodos múltiples (mixtos).
- HU-18: Calcular cambio para efectivo.
- HU-19: Confirmar venta con bloqueo si caja cerrada.
- HU-20: Validar stock disponible antes de confirmar.
- HU-21: Anular venta (admin) con reposición de stock.
- HU-22: Ver historial de ventas del día por cajero.

---

## Tests críticos
- E2E: flujo completo de venta efectivo simple.
- E2E: flujo de venta con pagos mixtos.
- Unitario: cálculo de IVA con productos de tasas mixtas.
- Unitario: idempotencia de creación de venta.
- Integración: anulación reversa stock correctamente.
