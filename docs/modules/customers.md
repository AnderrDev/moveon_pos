# Módulo: customers (Clientes)

## Responsabilidad

Gestión de clientes para historial de compras y futura fidelización.

## Reglas (MVP v1.0)

- RN-CL01: cliente es opcional en una venta.
- RN-CL02: si cliente solicita factura, los datos fiscales son obligatorios.
- RN-CL03: documento + tipo único por tienda.

## Reglas (planeadas para v1.3 — MOVE ON Club, ver `docs/modules/loyalty.md`)

- RN-CL04: `celular_normalizado` es único por tienda (índice parcial, ignora nulos) y es el
  identificador operativo principal del cliente — se puede identificar solo con su número.
- RN-CL05: la normalización de celulares colombianos vive en un value object de dominio puro
  (`PhoneCO`), reutilizado por la UI de registro y por los RPC de fidelización.
- RN-CL06: `clientes.activo`, `clientes.autoriza_fidelizacion` y
  `clientes.acepta_mensajes_promocionales` son campos independientes — la autorización para
  participar en el programa no implica autorización para mensajes promocionales.
- RN-CL07: el registro rápido desde el flujo de venta no exige instalar ninguna app ni pide más
  que nombre + celular + autorizaciones; no debe interrumpir ni bloquear la venta en curso.

## Use cases (MVP)

- `CreateCustomer`, `UpdateCustomer`
- `SearchCustomer` (por documento, nombre, teléfono)
- `GetCustomerHistory`

## Use cases (planeados para v1.3)

- `QuickCreateCustomerUseCase` (desde POS): nombre + celular + autorizaciones, sin campos
  fiscales obligatorios.
- `SearchCustomer` se extiende para buscar por `celular_normalizado` como criterio principal.

## Fidelización (v1.3)

Módulo propio: `src/modules/loyalty` (dominio, casos de uso, ledger de sellos y recompensas).
Especificación funcional completa, modelo de datos, RPC y reglas de negocio en
**`docs/modules/loyalty.md`**. Decisión arquitectónica en
**`docs/adr/0013-programa-fidelizacion-move-on-club.md`**. Estado: planeado, no implementado
(ver roadmap — v1.3 / Sprint 8, después de v1.1 facturación y v1.2 recetas).

## Exportación Excel

- La descarga masiva respeta el filtro activo e incluye únicamente los datos visibles del directorio.
- El botón y la acción se restringen al rol `admin`; los cajeros conservan el acceso operativo a búsqueda y edición, pero no a exportación masiva.
- No se exportan UUID ni `tienda_id`.
