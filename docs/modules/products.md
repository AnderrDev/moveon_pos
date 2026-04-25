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

## Use cases
- `CreateProducto`, `UpdateProducto`, `DeactivateProducto`
- `CreateCategoria`, `UpdateCategoria`, `DeactivateCategoria`
- `ListProductos`, `SearchProductos`, `GetProducto`
- `ListCategorias`

## Importación CSV (v1.0)
- Formato esperado: nombre, sku, codigo_barras, categoria, tipo, unidad, precio_venta, costo, iva_tasa, stock_inicial.
- Validación previa con reporte de errores antes de aplicar.
- Stock inicial se aplica como `inventory_movements` tipo `entry`.
