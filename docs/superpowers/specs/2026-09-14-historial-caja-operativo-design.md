# Diseño — Historial operativo de Caja

**Fecha:** 2026-09-14  
**Estado:** Aprobado para planificación  
**Módulo:** Caja

## 1. Problema

El historial actual aparece como una lista de hasta 30 turnos debajo de la operación diaria de
Caja. Con volumen real, la página se vuelve larga, la información es difícil de localizar y los
turnos anteriores al límite quedan inaccesibles. Aunque cada fila puede expandirse, el patrón no
comunica con claridad dónde encontrar ventas, productos, pagos y movimientos. El responsable del
cierre solo se conserva como UUID, dato insuficiente para supervisión.

El flujo debe reemplazar la búsqueda manual que hoy se realiza en Excel: localizar un día o turno,
reconocer quién lo cerró y revisar rápidamente cómo se compone.

## 2. Alternativas evaluadas

### A. Pantalla independiente de historial — elegida

Crear `/caja/historial`, enlazada desde el menú lateral y desde el encabezado de Caja. Separa la
operación diaria de la supervisión, admite filtros y paginación sin alargar `/caja`, y ofrece espacio
para un detalle legible.

### B. Pestañas dentro de `/caja`

Reduce rutas, pero mantiene dos trabajos distintos en la misma pantalla y hace que el estado de
filtros compita con el estado del turno abierto.

### C. Incorporarlo a Finanzas o Reportes

Centraliza análisis, pero oculta una responsabilidad propia de Caja y obliga al supervisor a salir
del contexto operativo para investigar un cierre.

## 3. Alcance funcional

### 3.1 Navegación

- `/caja` conserva apertura, turno activo, movimientos y cierre.
- Se elimina la lista extensa de turnos anteriores al final de `/caja`.
- El encabezado de Caja ofrece la acción `Historial de cajas`.
- El menú lateral incluye `Historial de caja`, visible solo para `admin`.
- La ruta `/caja/historial` está protegida con el mismo permiso administrativo en cliente; RLS sigue
  siendo la defensa de datos.

### 3.2 Filtros

La pantalla abre con `Últimos 7 días` y permite:

- Presets: `Hoy`, `Ayer`, `7 días`, `30 días`.
- Rango personalizado de fecha inicial y final, interpretado en la zona horaria de la tienda. La
  fecha final incluye todo ese día y se convierte internamente en un límite UTC exclusivo del día
  siguiente.
- Responsable del cierre.
- Estado del cuadre: `Todos`, `Cuadrados`, `Con diferencia`.
- `Limpiar filtros`, que restaura los últimos 7 días.

Los filtros se aplican en servidor y reinician la página a la primera. No se filtran únicamente los
elementos ya cargados.

### 3.3 Tabla paginada

La tabla muestra 20 turnos por página, ordenados por `closed_at DESC, id DESC`, con total de
resultados y controles anterior/siguiente. Columnas:

- Fecha y horario del turno.
- Responsable que cerró.
- Número y valor de ventas en efectivo.
- Número y valor de ventas por transferencia.
- Total vendido.
- Efectivo esperado.
- Efectivo contado.
- Retiro al cierre.
- Efectivo dejado.
- Diferencia.

Una diferencia distinta de cero se destaca sin depender únicamente del color. En pantallas pequeñas
la fila se convierte en un resumen vertical; no se fuerza una tabla ilegible comprimida.

### 3.4 Detalle del turno

Seleccionar una fila abre un panel lateral en escritorio y una vista de ancho completo en móvil. El
detalle se carga bajo demanda y tiene tres secciones claras:

1. **Cierre:** responsable, apertura/cierre, base inicial, esperado, contado, diferencia, retirado,
   dejado y notas.
2. **Ventas:** cada venta muestra número, hora, cajero, cliente, estado, productos, descuentos,
   pagos y total. Se reutiliza `mo-sale-detail-list` para conservar el detalle ya probado.
3. **Movimientos:** hora, tipo, concepto, monto, estado y motivo de anulación cuando aplique.

El panel permite descargar el Excel completo de ese turno. Si un seed de volumen no tiene ventas o
movimientos relacionados, se muestra explícitamente `Sin ventas registradas` o `Sin movimientos`,
sin dar la impresión de que el detalle está todavía cargando.

## 4. Responsabilidad del cierre

Se agrega `cash_sessions.closed_by_email text null` como snapshot auditable. Al cerrar:

- `close_cash_session_atomic` valida que `p_closed_by = auth.uid()` como hasta ahora.
- Obtiene el correo desde el JWT autenticado y usa `auth.users.email` como fallback interno.
- Persiste el correo junto con `closed_by` en la misma transacción.
- Los cierres existentes se rellenan desde `auth.users` cuando el usuario todavía existe.

El correo es solo una etiqueta de auditoría; nunca se usa para autorizar. El UUID continúa siendo la
identidad canónica. Así, un cambio posterior de correo no altera quién figuraba en el cierre original.

Para poblar el selector de responsables se expone una función SQL `SECURITY INVOKER` que devuelve
pares distintos `closed_by`/`closed_by_email` únicamente dentro de tiendas visibles por RLS. Se
revoca `EXECUTE` a `PUBLIC`/`anon` y se concede explícitamente a `authenticated`.

## 5. Arquitectura y datos

### Dominio

- `CashSession` incorpora `closedByEmail`.
- Nuevo contrato paginado `CashHistoryQuery` con rango UTC, responsable, estado de cuadre, página y
  tamaño.
- Nuevo resultado `CashHistoryPage` con `items`, `total`, `page` y `pageSize`.
- Helpers puros convierten presets/rangos a límites y normalizan filtros.

### Datos

- El repositorio consulta `cash_sessions` con `count: 'exact'`, filtros PostgREST y `.range()`.
- La fecha se filtra por `closed_at`, porque el usuario busca el día en que se rindió la caja.
- La condición `Con diferencia` considera diferencia de efectivo o diferencia total de ventas.
- Se añaden los índices `(tienda_id, closed_at DESC, id DESC)` para fecha/paginación y
  `(tienda_id, closed_by, closed_at DESC)` para el filtro de responsable.
- Ventas y movimientos solo se consultan para el turno seleccionado; no hay N+1 al listar.

### Presentación

- `cash-history.page.ts`: coordina filtros, paginación, selección y estados de carga.
- `cash-history-filters.component.ts`: filtros accesibles con formularios reactivos.
- `cash-history-table.component.ts`: tabla/resumen responsive y navegación de páginas.
- `cash-session-detail.drawer.ts` reutiliza el detalle de ventas y el exportador existentes.
- El componente `closed-sessions-list` deja de renderizarse en `/caja` y se elimina cuando su lógica
  haya sido absorbida por la nueva pantalla.

## 6. Estados y errores

- Skeleton al cargar resultados, sin borrar los filtros activos.
- Estado vacío específico: `No hay cierres para estos filtros` con acción para limpiarlos.
- Error de listado con `Reintentar`.
- Error del detalle aislado dentro del panel; la tabla continúa utilizable.
- Un cambio rápido de filtros no debe permitir que una respuesta anterior sobrescriba la nueva.
- Si `closed_by_email` es nulo en un registro histórico, se muestra `Usuario no disponible` y los
  primeros ocho caracteres del UUID como referencia secundaria.

## 7. Seguridad

- Ruta y entrada de menú restringidas a `admin`.
- Toda consulta incluye `tienda_id`; RLS limita además las filas a tiendas activas del usuario.
- `closed_by_email` no interviene en permisos.
- La mutación de cierre continúa únicamente mediante RPC atómico.
- No se expone acceso del cliente a `auth.users`.

## 8. Pruebas y aceptación

- SQL/pgTAP: snapshot del correo, backfill, permisos de la función de responsables y aislamiento por
  tienda.
- Dominio: presets, rangos inclusivos por día, estado de cuadre y paginación.
- Repositorio: filtros enviados, conteo total y mapeo de `closed_by_email`.
- Presentación: reinicio de página al filtrar, respuestas fuera de orden y estados vacío/error.
- E2E con el seed de 100 cierres:
  - `/caja` no contiene la lista larga.
  - `/caja/historial` muestra 20 de 102 y permite avanzar.
  - filtrar un día reduce resultados correctamente.
  - abrir un turno real muestra ventas y movimientos.
  - el responsable es legible y no un UUID aislado.

El trabajo se considera completo cuando un administrador puede encontrar un cierre antiguo sin
Excel, identificar al responsable, revisar el detalle completo y volver a la lista conservando sus
filtros y página.
