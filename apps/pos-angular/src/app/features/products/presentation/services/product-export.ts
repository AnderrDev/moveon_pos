import type { Categoria, Product } from '@angular-app/features/products/domain/entities/product.entity'
import type { ExcelWorkbookDefinition } from '@angular-app/shared/services/export/excel-export.service'
import { buildExportFilename } from '@angular-app/shared/services/export/export-filename'
import {
  productStockStatus,
  type ProductStock,
  type ProductStockStatus,
} from '@angular-app/features/products/presentation/services/product-stock'

const PRODUCT_TYPE_LABELS: Record<Product['tipo'], string> = {
  simple: 'Simple',
  prepared: 'Preparado',
  ingredient: 'Ingrediente',
  combo: 'Combo',
}

const STOCK_STATUS_LABELS: Record<ProductStockStatus, string> = {
  out: 'Agotado',
  low: 'Stock bajo',
  ok: 'Disponible',
  none: 'Sin stock propio',
}

/**
 * Catálogo con su stock (la hoja reemplaza a la que exportaba /inventario).
 * Sin `stock` para un producto, sus columnas de stock salen vacías.
 */
export function buildProductsWorkbook(
  products: readonly Product[],
  categories: readonly Categoria[],
  query: string,
  stock: ReadonlyMap<string, ProductStock> = new Map()
): ExcelWorkbookDefinition {
  const categoryNames = new Map(categories.map((category) => [category.id, category.nombre]))
  const normalizedQuery = query.trim()

  return {
    filename: buildExportFilename('productos'),
    sheets: [
      {
        name: 'Productos',
        title: 'Catálogo de productos',
        subtitle: normalizedQuery
          ? `${products.length} productos · Filtro: ${normalizedQuery}`
          : `${products.length} productos`,
        columns: [
          { header: 'Producto', width: 34 },
          { header: 'Categoría', width: 22 },
          { header: 'SKU', width: 16 },
          { header: 'Código de barras', width: 20 },
          { header: 'Proveedor', width: 24 },
          { header: 'Tipo', width: 14 },
          { header: 'Unidad', width: 12 },
          { header: 'Para qué sirve', width: 42 },
          { header: 'Recomendado para', width: 42 },
          { header: 'Costo', width: 16, format: 'currency' },
          { header: 'Precio de venta', width: 18, format: 'currency' },
          { header: 'Punto de venta', width: 16, format: 'integer' },
          { header: 'Bodega', width: 12, format: 'integer' },
          { header: 'Stock total', width: 14, format: 'integer' },
          { header: 'Stock mínimo', width: 14, format: 'integer' },
          { header: 'Estado del stock', width: 18 },
          { header: 'Estado', width: 12 },
          { header: 'Creado', width: 18, format: 'date' },
          { header: 'Actualizado', width: 18, format: 'date' },
        ],
        rows: products.map((product) => {
          const productStock = stock.get(product.id)
          const tracked = productStock?.tracksStock ? productStock : null
          return [
          product.nombre,
          product.categoriaId
            ? (categoryNames.get(product.categoriaId) ?? 'Sin categoría')
            : 'Sin categoría',
          product.sku,
          product.codigoBarras,
          product.proveedorNombre,
          PRODUCT_TYPE_LABELS[product.tipo],
          product.unidad,
          product.paraQueSirve,
          product.recomendadoPara,
          product.costo,
          product.precioVenta,
          tracked?.puntoVentaStock ?? null,
          tracked?.bodegaStock ?? null,
          tracked?.totalStock ?? null,
          product.stockMinimo,
          productStock ? STOCK_STATUS_LABELS[productStockStatus(productStock)] : null,
          product.isActive ? 'Activo' : 'Inactivo',
          product.createdAt,
          product.updatedAt,
        ]
        }),
      },
    ],
  }
}

export function buildCategoriesWorkbook(categories: readonly Categoria[]): ExcelWorkbookDefinition {
  return {
    filename: buildExportFilename('categorias'),
    sheets: [
      {
        name: 'Categorías',
        title: 'Categorías de productos',
        subtitle: `${categories.length} categorías`,
        columns: [
          { header: 'Categoría', width: 32 },
          { header: 'Orden', width: 12, format: 'integer' },
          { header: 'Estado', width: 14 },
          { header: 'Creada', width: 18, format: 'date' },
          { header: 'Actualizada', width: 18, format: 'date' },
        ],
        rows: categories.map((category) => [
          category.nombre,
          category.orden,
          category.isActive ? 'Activa' : 'Inactiva',
          category.createdAt,
          category.updatedAt,
        ]),
      },
    ],
  }
}
