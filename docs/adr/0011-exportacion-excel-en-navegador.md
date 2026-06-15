# ADR 0011 - Exportacion de vistas operativas a Excel en el navegador

**Fecha:** 2026-06-14
**Estado:** Aceptado
**Decisores:** Dueno del negocio + equipo MOVEONAPP

## Contexto

Las pantallas de productos, inventario, clientes, caja y reportes presentan informacion tabular que resulta mas facil de revisar, filtrar y compartir en una hoja de calculo. La aplicacion ya carga estas vistas aplicando autenticacion, RLS, tienda y filtros de negocio, por lo que consultar directamente tablas SQL para exportarlas duplicaria reglas y podria exponer columnas tecnicas o sensibles.

El volumen operativo actual es pequeno: menos de cien productos y entre cincuenta y cien ventas diarias. No se necesita procesamiento en servidor ni trabajos asincronos para generar los archivos.

## Decision

Generar archivos `.xlsx` en el navegador mediante **ExcelJS 4.4**, cargado con `import()` dinamico solo cuando el usuario solicita una descarga.

- Un servicio Angular compartido recibe definiciones tabulares ya autorizadas y no consulta Supabase.
- Cada feature transforma sus entidades o view models a filas con encabezados legibles.
- Las exportaciones respetan los filtros activos de la pantalla.
- Los libros detallados pueden contener varias hojas, por ejemplo ventas, productos, pagos y movimientos de caja.
- Los archivos incluyen autofiltros, encabezados congelados, anchos controlados y formatos reales de fecha, porcentaje y moneda COP.
- No se exportan `tienda_id`, UUID internos, claves de idempotencia ni otras columnas tecnicas.
- La descarga masiva de clientes y cualquier columna de costo se limita al rol `admin`.
- Los nombres siguen el patron `moveonapp-<contenido>-YYYY-MM-DD.xlsx`.

## Consecuencias

### Positivas

- No se agregan endpoints, Edge Functions ni almacenamiento de archivos.
- La exportacion reutiliza exactamente los datos y permisos de la vista actual.
- Los libros funcionan sin conexion adicional una vez cargados los datos.
- La dependencia no aumenta el bundle inicial porque se carga bajo demanda.

### Negativas

- Generar libros muy grandes consumiria memoria en el navegador; no es un riesgo con el volumen actual.
- ExcelJS agrega una dependencia orientada exclusivamente a exportacion.
- Los archivos son una fotografia del momento y no se actualizan automaticamente.

## Alternativas consideradas

| Alternativa                   | Razon para descartarla                                                                                                             |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| CSV                           | No conserva varias hojas, formatos, filtros ni tipos de fecha y moneda.                                                            |
| Generacion en Edge Function   | Agrega infraestructura y duplica autorizacion para el volumen actual.                                                              |
| Exportar tablas SQL completas | Expone estructura interna y omite reglas de presentacion y permisos.                                                               |
| SheetJS Community Edition     | Es adecuada para exportaciones simples, pero ExcelJS ofrece una API mas directa para estilos y libros operativos con varias hojas. |

## Referencias

- ExcelJS: https://github.com/exceljs/exceljs
- SheetJS, exportacion desde Angular: https://docs.sheetjs.com/docs/demos/frontend/angular/
