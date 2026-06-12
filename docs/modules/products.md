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

## Informacion para recomendacion

- El administrador puede completar **Para que sirve** y **A quien se recomienda** al crear o editar un producto.
- La card del POS ofrece una accion secundaria **Ver informacion** que no agrega el producto al carrito.
- La informacion sigue disponible cuando el producto no tiene stock.
- Si ambos campos estan vacios, el POS muestra un estado pendiente en vez de inventar contenido.
- La ficha incluye un aviso para consultar a un profesional ante condiciones medicas, embarazo o uso de medicamentos.

## Use cases
- `CreateProducto`, `UpdateProducto`, `DeactivateProducto`
- `CreateCategoria`, `UpdateCategoria`, `DeactivateCategoria`
- `ListProductos`, `SearchProductos`, `GetProducto`
- `ListCategorias`

## Importación CSV (v1.0) — Migración desde Siigo (PLAN-18)

Script CLI local que importa el catálogo de Siigo a Supabase. Toda la lógica de
parseo/validación/mapeo vive en el **módulo puro** `src/modules/products/import/siigo-csv.ts`
(TS, sin Node/Supabase/Angular, testeable con vitest). El **script** `scripts/import-siigo-csv.mjs`
es el único lugar que usa el SERVICE ROLE y conecta a Supabase.

### Header del CSV (case-insensitive, se hace `trim`)

```
nombre, sku, codigo_barras, categoria, tipo, unidad, precio_venta, costo, iva_tasa, stock_inicial
```

| Columna         | Obligatoria | Reglas |
|-----------------|-------------|--------|
| `nombre`        | Sí          | 2–100 caracteres. |
| `sku`           | No          | Se pasa a mayúsculas; letras/números/guiones (≥3 chars). Único por tienda. |
| `codigo_barras` | No          | Texto libre. Único por tienda. |
| `categoria`     | No          | Vacío → producto sin categoría. Se crea si no existe (por `tienda_id, nombre`). |
| `tipo`          | No          | `simple` \| `prepared` \| `ingredient`. Vacío → `simple`. Otro valor → error. |
| `unidad`        | No          | Vacío → `und`. |
| `precio_venta`  | Sí          | Entero > 0. Formato COP: `$ 110.000` → `110000`. Centavos/decimales → error. |
| `costo`         | No          | Vacío → sin costo. Entero ≥ 0 (mismo parseo COP). |
| `iva_tasa`      | Sí          | `0`, `5` o `19`. Otro (ej. `16`) → error. |
| `stock_inicial` | No          | Vacío → `0`. Entero ≥ 0. Negativo/decimal → error. |

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
