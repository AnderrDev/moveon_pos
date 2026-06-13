# Spec de Sesión — 2026-06-13 — Corrección total del carrito

## Metadatos

| Campo | Valor |
|---|---|
| Fecha | 2026-06-13 |
| Sprint | Corrección operativa POS |
| Agente | Codex |
| HUs trabajadas | M4 Pantalla de venta |
| Estado | Completada |

## 1. Objetivo de la sesión

Corregir el carrito del POS para que un producto con precio de venta final de $79.000 e IVA 19%
se cobre por $79.000 y no por $94.010, conservando la discriminación del IVA incluido.

## 2. Lo que se implementó

- `src/modules/sales/domain/services/sale-calculator.ts` trata `precioVenta` como precio final con IVA incluido.
- `apps/pos-angular/src/app/features/pos/pos.page.ts` muestra que el IVA está incluido.
- Se actualizaron las pruebas de cálculo y creación de venta, incluyendo el caso exacto de $79.000.
- `docs/modules/sales.md` documenta la semántica del precio final.

## 3. Decisiones tomadas

`precioVenta` representa el precio final al consumidor. El IVA se discrimina internamente sin sumarlo otra vez.

## 4. ADRs creados o actualizados

No se requirió ADR; se corrigió la interpretación de RN-S10.

## 5. Tests

- `pnpm exec tsc --noEmit`: pasó.
- `pnpm lint`: pasó.
- `pnpm test`: 309 tests pasaron.
- `pnpm typecheck`: TypeScript pasó, pero `ng build --configuration development` terminó con `Abort trap: 6` sin diagnóstico.

## 6. Bloqueos y preguntas pendientes

- Investigar por separado el cierre abrupto local de Angular durante `ng build`.

## 7. Próximos pasos

Verificar visualmente el caso real cuando el servidor Angular esté disponible.

## 8. Notas adicionales

El error reportado era exactamente un recargo del 19%: $79.000 se convertía en $94.010.
