# Historias de usuario y plan de pruebas — MOVEONAPP POS

Este directorio contiene las historias de usuario (HUs) del proyecto, organizadas para
**iniciar pruebas funcionales** del MVP v1.0.

## Estructura

| Archivo | Contenido |
|---|---|
| [`features.md`](./features.md) | HUs **por cada feature** (auth, catálogo, inventario, caja, POS, pagos, clientes, reportes, tickets). Cada HU tiene criterios de aceptación verificables como checklist. |
| [`flows.md`](./flows.md) | HUs **por cada flujo operativo** (cruzan varias features): apertura de día, venta efectivo, venta mixta, venta con descuento, anulación, cierre de caja, gestión de catálogo. |
| [`E2E-flujo-completo-pruebas.md`](./E2E-flujo-completo-pruebas.md) | **Un flujo completo de extremo a extremo** (login → venta → cierre) escrito como guion de prueba para arrancar QA manual. |
| `sprint-01.md` … `sprint-05.md` | HUs originales por sprint (histórico). Las HUs `HU-XX` se referencian desde los nuevos docs. |

## Convención de IDs

- **Features:** prefijo por módulo + número. Ej: `AUTH-01`, `CAT-02`, `INV-03`, `CAJA-04`, `POS-05`, `PAY-06`, `CLI-07`, `REP-08`, `TCK-09`.
- **Flujos:** `FLUJO-01` … `FLUJO-07`.
- **Casos de prueba E2E:** `TC-01` … `TC-NN`.
- Donde aplica, se referencia la HU original (`HU-XX`) y la regla de negocio (`RN-XXNN`) del módulo en `/docs/modules/`.

## Cómo usar esto para probar

1. Verifica los pre-requisitos del entorno (Supabase activo, `runtime-config.json` correcto, usuario admin y cajero creados).
2. Corre el **flujo completo** (`E2E-flujo-completo-pruebas.md`) como smoke test del happy path.
3. Profundiza por flujo (`flows.md`) cubriendo variantes y casos de error.
4. Usa los criterios de aceptación de cada feature (`features.md`) como checklist fino.

## Leyenda de estado

- ✅ Implementado y verificable hoy.
- ⚠️ Implementado parcialmente o con gap conocido (ver nota).
- ❌ No implementado (fuera del estado actual; documentado para completar el MVP).

> Gaps conocidos a la fecha (2026-05-27): no hay guard por rol en rutas (solo `authGuard` de autenticación); descuentos con permiso por rol (RN-S09) no implementados; recuperación de contraseña UI (AUTH) pendiente; importador CSV Siigo (CAT) no implementado. Ver `docs/sessions/2026-05-08-auditoria-hallazgos.md`.
