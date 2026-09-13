# Módulo: customers (Clientes)

## Responsabilidad

Gestión de clientes para historial de compras y futura fidelización.

## Reglas (MVP v1.0)

- RN-CL01: cliente es opcional en una venta.
- RN-CL02: si cliente solicita factura, los datos fiscales son obligatorios.
- RN-CL03: nombre y documento (tipo + número) son obligatorios al crear o editar un cliente
  desde el directorio de clientes; el resto de los campos (email, celular) son opcionales.
  Documento + tipo único por tienda (índice parcial, ver migración `20260426034930`).
- RN-CL08: en el formulario de alta/edición, "Autoriza fidelización" y "Acepta mensajes
  promocionales" inician marcados por defecto (opt-out, no opt-in) — el cajero los desmarca si el
  cliente no autoriza. Como "Autoriza fidelización" en `true` exige celular colombiano válido
  (RN-CL04/RN-CL06), en la práctica un cliente nuevo sin celular requiere que el cajero desmarque
  ambos checkbox para poder guardarse.

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

Feature propia: `apps/pos-angular/src/app/features/loyalty` (dominio, casos de uso, ledger de sellos y recompensas).
Especificación funcional completa, modelo de datos, RPC y reglas de negocio en
**`docs/modules/loyalty.md`**. Decisión arquitectónica en
**`docs/adr/0013-programa-fidelizacion-move-on-club.md`**. Estado: planeado, no implementado
(ver roadmap — v1.3 / Sprint 8, después de v1.1 facturación y v1.2 recetas).

## Exportación Excel

- La descarga masiva respeta el filtro activo e incluye únicamente los datos visibles del directorio.
- El botón y la acción se restringen al rol `admin`; los cajeros conservan el acceso operativo a búsqueda y edición, pero no a exportación masiva.
- No se exportan UUID ni `tienda_id`.

## Directorio y progreso MOVE ON Club

- El directorio muestra el progreso autorizado de fidelización sin abrir el detalle: en escritorio
  aparece una columna "Progreso Club" y en móvil se presenta debajo del nombre del cliente.
- Un destacado sobre el listado prioriza clientes con premio vigente; si no los hay, muestra el
  cliente con mayor saldo positivo y cuántos sellos le faltan para el siguiente batido gratis.
- El resumen se obtiene en bloque desde cuentas y recompensas vigentes, sin una consulta por
  cliente. Si fidelización no está disponible, el directorio conserva búsqueda, edición y scroll.
