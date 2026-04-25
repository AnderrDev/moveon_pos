# ADR 0005 — Modo contingencia simple (no offline-first completo)

**Fecha:** 2026-04-25
**Estado:** Aceptado, no implementado en MVP v1.0
**Decisores:** Equipo MOVEONAPP

## Contexto

El internet en la tienda es estable, pero pueden ocurrir caídas. Dos enfoques:

1. **Offline-first completo:** todo funciona sin internet, sincronización compleja, manejo de conflictos, IndexedDB como fuente de verdad local.
2. **Modo contingencia simple:** el sistema opera online normalmente. Si detecta caída, permite vender en modo "ticket interno offline" y sincroniza al recuperar conexión.

## Decisión

Implementamos **modo contingencia simple** en v1.5, NO en MVP v1.0.

## Justificación

- Internet estable según reporte del usuario.
- Implementar offline-first completo desde el inicio agrega ~30% al tiempo de desarrollo del MVP.
- El riesgo real (caer y no poder vender) se mitiga inicialmente con un plan operativo simple (datos guardados en papel temporalmente, ingresar manualmente al recuperar).
- Modo contingencia se construye mejor sobre un sistema online ya estable.

## Consecuencias

### Positivas
- MVP llega más rápido a producción.
- La complejidad de sincronización se aborda cuando el sistema ya tiene tracción.

### Negativas
- Si ocurre una caída larga antes de v1.5, hay que vender manualmente.

### Mitigación inmediata
- Documentar en el manual operativo qué hacer si se cae el sistema (registro en papel + ingreso posterior).
- Monitorear caídas reales durante el piloto. Si ocurren más de lo esperado, priorizar v1.5.

### Especificación futura (v1.5)
- Service Worker detecta offline.
- Ventas offline se guardan en IndexedDB con `idempotency_key`.
- Al reconectar, sync automático envía las ventas al servidor.
- El servidor usa `idempotency_key` para evitar duplicados.
- Facturación electrónica de ventas offline queda en estado `pending` hasta sincronizar.
