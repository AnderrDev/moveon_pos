# Módulo: payments (Pagos)

## Responsabilidad
No es un módulo independiente sustancial. Las entidades `Payment` viven dentro de `sales`. Este archivo documenta las reglas de pagos.

## Reglas
- RN-PG01: una venta puede tener N pagos (pagos mixtos).
- RN-PG02: la suma de pagos debe ser ≥ total de venta. Diferencia es cambio (solo cash).
- RN-PG03: métodos válidos: `cash`, `card`, `nequi`, `daviplata`, `transfer`, `other`.
- RN-PG04: pagos no-cash pueden incluir `referencia` (últimos 4 tarjeta, número aprobación, etc.).
- RN-PG05: en MVP no hay integración con datáfono; la referencia se ingresa manualmente.
