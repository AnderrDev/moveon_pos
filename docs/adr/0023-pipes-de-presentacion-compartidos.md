# ADR 0023 — Pipes de presentación compartidos

**Estado:** Aceptado (2026-10-24, auditoría de arquitectura P2 #17, aprobado por el dueño al pedir la componentización con el design system)

## Contexto

El formateo de dinero (`money()` → `formatCurrency`) estaba copiado como método en ~35 componentes y la etiqueta de método de pago (`paymentLabel()`) en 7. El design system (ADR 0014) no tenía una ubicación para transformaciones de presentación reutilizables.

## Decisión

- Nueva carpeta `apps/pos-angular/src/app/shared/pipes/` con pipes **puros y standalone** que solo envuelven funciones de `src/shared/lib` (sin lógica propia):
  - `MoneyPipe` (`| money`) → `formatCurrency`.
  - `PaymentLabelPipe` (`| paymentLabel`) → `getPaymentMethodLabel`.
- Las plantillas usan el pipe; el código TypeScript (toasts, exportaciones) sigue llamando a la función de `src/shared/lib`.
- Un pipe nuevo entra aquí solo si lo usan 2+ features (mismo criterio que `docs/standards/ui-components.md` §4.1).

## Consecuencias

- Se elimina la duplicación de métodos `money()`/`paymentLabel()`.
- Los pipes puros se recalculan solo cuando cambia el valor (igual o mejor que llamar un método desde la plantilla con OnPush).
