# Módulo: customers (Clientes)

## Responsabilidad

Gestión de clientes para historial de compras y futura fidelización.

## Reglas (MVP v1.0)

- RN-CL01: cliente es opcional en una venta.
- RN-CL02: si cliente solicita factura, los datos fiscales son obligatorios.
- RN-CL03: documento + tipo único por tienda.

## Use cases (MVP)

- `CreateCustomer`, `UpdateCustomer`
- `SearchCustomer` (por documento, nombre, teléfono)
- `GetCustomerHistory`

## Fidelización (v1.3)

Tablas adicionales: `loyalty_accounts`, `loyalty_transactions`. Documentar cuando llegue ese sprint.

## Exportación Excel

- La descarga masiva respeta el filtro activo e incluye únicamente los datos visibles del directorio.
- El botón y la acción se restringen al rol `admin`; los cajeros conservan el acceso operativo a búsqueda y edición, pero no a exportación masiva.
- No se exportan UUID ni `tienda_id`.
