# Módulo: products (Productos y Categorías)

## Responsabilidad

CRUD de catálogo: categorías y productos. Búsqueda.

## Entidades

Ver `/docs/03-data-model.md` tablas `categorias` y `productos`.

## Reglas

- RN-P01: SKU y código de barras únicos por tienda.
- RN-P02: Cambios de precio se auditan en `audit_logs`.
- RN-P03: Producto inactivo no aparece en POS pero sí en reportes históricos.
- RN-P04: Tipo `prepared` (batidos) en MVP se trata como producto simple. Recetas en v1.2.

- RN-P05: `para_que_sirve` y `recomendado_para` son informacion comercial opcional, de maximo 800 caracteres cada una, basada en la ficha oficial del fabricante.
- RN-P06: La taxonomia operativa del POS separa proteinas, creatinas, pre-entrenos, aminoacidos y recuperacion, bienestar y salud, termogenicos, ganadores de peso, energizantes, alimentos proteicos, batidos e ingredientes para batidos.
- RN-P07: Al crear un producto se puede registrar inventario inicial opcional. Producto y movimiento `entry` se crean en una sola transaccion; el costo unitario usa el costo del producto y la ubicacion por defecto es `bodega`.
- RN-P09: Tipo `combo` (ADR 0018): promoción que se vende como UN producto con precio fijo propio (`precio_venta`) y una sola línea en el ticket. No lleva inventario propio: al venderlo se descuenta el stock de los productos incluidos, declarados en `product_components` igual que los componentes de un preparado. Su disponibilidad es derivada — `min(floor(stock / cantidad))` del producto incluido más escaso — y el servidor no bloquea la venta por faltantes (advertir, no bloquear). Un combo no puede contener otro combo ni un batido (ninguno rastrea stock propio), no admite opciones de venta (ADR 0017), no acepta inventario inicial y no se puede crear por importación CSV. Se activa y desactiva con `is_active`; no tiene fechas de vigencia. No aparece en el catálogo público.
- RN-P08 (revisada 2026-09-04): `productos.proveedor_id` referencia la tabla `proveedores` (id, tienda_id, nombre, is_active — sin contacto ni condiciones de pago, alcance mínimo). Se usa para filtrar el inventario por proveedor y ver faltantes al armar el siguiente pedido. Reemplaza el texto libre original (migración `20260904020000`, backfill desde los valores distintos ya usados en `productos.proveedor`); si el caso de uso crece (contactos, condiciones de pago), se extiende esta misma tabla. En el formulario de producto el campo es un selector con opción "+ Nuevo proveedor..." que crea el proveedor al vuelo (mismo flujo rápido que el texto libre, sin duplicados/errores de tipeo).

## Informacion para recomendacion

- El administrador puede completar **Para que sirve** y **A quien se recomienda** al crear o editar un producto.
- La card del POS ofrece una accion secundaria **Ver informacion** que no agrega el producto al carrito.
- La informacion sigue disponible cuando el producto no tiene stock.
- Si ambos campos estan vacios, el POS muestra un estado pendiente en vez de inventar contenido.
- La ficha incluye un aviso para consultar a un profesional ante condiciones medicas, embarazo o uso de medicamentos.
- Los textos describen familias de producto con lenguaje prudente. No deben prometer curas, perdida de grasa ni resultados deportivos garantizados.
- Batidos, frutas, toppings y demas ingredientes pueden agruparse para facilitar la venta, pero no requieren contenido de recomendacion.
- Los productos `prepared` no admiten inventario inicial porque no rastrean stock en el MVP.

## Use cases

- `CreateProducto`, `UpdateProducto`, `DeactivateProducto`
- `CreateCategoria`, `UpdateCategoria`, `DeactivateCategoria`
- `ListProductos`, `SearchProductos`, `GetProducto`
- `ListCategorias`

## Importación CSV (v1.0) — Migración desde Siigo (PLAN-18)

Script CLI local que importa el catálogo de Siigo a Supabase. Toda la lógica de
parseo/validación/mapeo vive en el **módulo puro** `apps/pos-angular/src/app/features/products/data/import/siigo-csv.ts`
(TS, sin Node/Supabase/Angular, testeable con vitest). El **script** `scripts/import-siigo-csv.mjs`
es el único lugar que usa el SERVICE ROLE y conecta a Supabase.

### Header del CSV (case-insensitive, se hace `trim`)

```
nombre, sku, codigo_barras, categoria, tipo, unidad, precio_venta, costo, iva_tasa, stock_inicial
```

| Columna         | Obligatoria | Reglas                                                                          |
| --------------- | ----------- | ------------------------------------------------------------------------------- |
| `nombre`        | Sí          | 2–100 caracteres.                                                               |
| `sku`           | No          | Se pasa a mayúsculas; letras/números/guiones (≥3 chars). Único por tienda.      |
| `codigo_barras` | No          | Texto libre. Único por tienda.                                                  |
| `categoria`     | No          | Vacío → producto sin categoría. Se crea si no existe (por `tienda_id, nombre`). |
| `tipo`          | No          | `simple` \| `prepared` \| `ingredient`. Vacío → `simple`. Otro valor → error.   |
| `unidad`        | No          | Vacío → `und`.                                                                  |
| `precio_venta`  | Sí          | Entero > 0. Formato COP: `$ 110.000` → `110000`. Centavos/decimales → error.    |
| `costo`         | No          | Vacío → sin costo. Entero ≥ 0 (mismo parseo COP).                               |
| `iva_tasa`      | Sí          | `0`, `5` o `19`. Otro (ej. `16`) → error.                                       |
| `stock_inicial` | No          | Vacío → `0`. Entero ≥ 0. Negativo/decimal → error.                              |

Validaciones cross-row: `sku`, `codigo_barras` y `nombre` (este último
case-insensitive) deben ser únicos dentro del archivo; el duplicado se reporta
en la ocurrencia posterior citando la primera línea.

### Comando y flags

```bash
node scripts/import-siigo-csv.mjs <ruta-csv> [--tienda-id <uuid>] [--created-by <uuid>] [--dry-run]
```

- `<ruta-csv>` — posicional, obligatorio.
- `--tienda-id` — default `a1b2c3d4-0000-0000-0000-000000000001` (se imprime cuál se usa).
- `--created-by` — uuid para `inventory_movements.created_by` (NOT NULL). Si no se
  pasa, se busca el admin activo de la tienda (`user_tiendas`); si no hay → aborta.
- `--dry-run` — valida + reporta (con lecturas para detectar duplicados existentes);
  **no escribe nada**.

El script lee `SUPABASE_URL` (con fallback a `NEXT_PUBLIC_SUPABASE_URL`) y
`SUPABASE_SERVICE_ROLE_KEY` de `.env.local`. No hay secretos hardcodeados.

### Dry-run y reporte

- Siempre valida primero. Con errores de fila → reporte por línea y **exit ≠ 0
  sin escribir** (aunque no sea dry-run).
- Solo con errores = 0 y sin `--dry-run` se aplica.
- Resumen: `N categorías nuevas, M productos nuevos, K duplicados omitidos, J movimientos`.

### Idempotencia (no destructiva, sin `--overwrite`)

- **Categorías:** se insertan solo las faltantes por `(tienda_id, nombre)`.
- **Productos existentes** (match por `sku` o `codigo_barras` en la tienda) →
  se **omiten y reportan como "duplicado"**; nunca se actualizan ni sobrescriben,
  y no generan movimiento de stock.
- **Stock inicial:** se aplica como `inventory_movements` tipo `entry` en `bodega`
  (cantidad positiva, `motivo = 'Stock inicial migración Siigo'`, `referencia_tipo = 'siigo_import'`)
  solo para productos nuevos de la corrida con `stock_inicial > 0`. El stock nunca
  se modifica directamente.
- Orden de escritura: categorías → productos → movimientos, en lotes de ~100. Sin
  transacción única: ante un error se detiene y reporta lo ya escrito.

## Pantalla única de catálogo y stock (Ola 2, 2026-10-24)

- `/productos` reúne lo que antes estaba repartido con `/inventario` (que ahora redirige aquí): costo, precio, stock en punto de venta y bodega, mínimo y alertas (Agotado / Stock bajo / Inactivo). Preparados y combos muestran "Sin stock propio" y no ofrecen acciones de stock.
- Lógica de stock por fila en `presentation/services/product-stock.ts` (pura, con tests en `tests/unit/features/products/product-stock.test.ts`).
- **Costo bloqueado en edición** para productos con stock propio que ya tienen costo: solo cambia con una entrada con costo o con la corrección de costo del kardex (ambas auditadas). Si el producto no tiene costo registrado, o es preparado o combo, el costo se sigue editando en el formulario.

## Filtros de la página de productos

- Búsqueda por nombre/SKU/código de barras, filtro por categoría, filtro por proveedor
  (incluye "Sin proveedor") y filtro por estado (activos/inactivos/todos). El filtro de
  proveedor usa `proveedorId` (RN-P08) — mismo criterio que ya tenía el filtro de inventario.

## Exportación Excel

- La pantalla de productos permite descargar las filas filtradas en `.xlsx`.
- Incluye categoría, información comercial, costo, precio, IVA, stock mínimo y estado.
- Productos y categorías son rutas exclusivas de `admin`; por tanto, el costo no se expone a cajeros.
- No se exportan UUID, `tienda_id` ni campos técnicos.


## Presentación sin IVA (2026-10-17)

Desde 2026-10-17 se omite IVA del formulario, tabla y exportación de productos. Se conserva el control interno y su mapeo: editar conserva la tasa existente y crear usa el valor predeterminado existente (0). No cambia el contrato de importación Siigo ni el cálculo de ventas.

## Listado completo sin tope (2026-10-24)

`ProductRepository.listProducts` sin término de búsqueda devuelve el catálogo completo, paginado con `fetchAllPages` (orden `nombre`, `id`). Antes un `.limit(200)` fijo cortaba en silencio el catálogo del POS (vía `ProductsCacheStore`), inventario y reportes al pasar de 200 productos (había 144). Con término de búsqueda se mantiene un tope de 200 resultados (`PRODUCT_SEARCH_LIMIT`). Test: `tests/unit/features/products/list-products-pagination.test.ts`.

## Recetas y opciones atómicas (2026-10-24, `20261024000600`–`000700`)

- `saveComponents` → `save_product_components_atomic` y `saveOptions` → `save_product_options_atomic`: una sola transacción cada una (antes delete+insert y select+upsert+update desde el cliente; un fallo a mitad dejaba el producto sin receta u opciones parciales).
- Solo admin. Validan tienda, que el producto sea `prepared`/`combo` (componentes) o `prepared` (opciones), cantidades > 0, sin repetidos, sin autorreferencia, y que ningún componente sea `prepared`/`combo`. Auditan `product.components_saved` / `product.options_saved`.
- Opciones: primero liberan `es_default` del producto y luego hacen upsert por (producto, grupo, nombre) — corrige el choque con `ux_product_options_default` al mover la predeterminada a una opción anterior en la lista. Las quitadas se desactivan (ADR 0017 §2.2).
- Desde `000700`, `product_components` y `product_options` no admiten escritura directa (solo lectura + RPC).
- Pruebas: `supabase/tests/atomic-product-components-options.test.sql`, `tests/unit/features/products/save-components-options-rpc.test.ts`.
