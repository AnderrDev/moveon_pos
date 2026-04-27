import { redirect } from 'next/navigation'
import { getAuthContext } from '@/shared/lib/auth-context'
import { SupabaseProductRepository } from '@/modules/products/infrastructure/repositories/supabase-product.repository'
import { SupabaseCategoriaRepository } from '@/modules/products/infrastructure/repositories/supabase-categoria.repository'
import { listProductos } from '@/modules/products/application/use-cases/list-productos.use-case'
import { listCategorias } from '@/modules/products/application/use-cases/list-categorias.use-case'
import { PageHeader } from '@/shared/components/layout/PageHeader'
import { Badge } from '@/shared/components/ui/Badge'
import { AddProductoButton } from '@/modules/products/components/AddProductoButton'
import { ProductoActions } from '@/modules/products/components/ProductoActions'
import { ProductsSubNav } from '@/modules/products/components/ProductsSubNav'

function formatCOP(value: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value)
}

export default async function ProductosPage() {
  const auth = await getAuthContext()
  if (!auth) redirect('/login')

  const productoRepo = new SupabaseProductRepository()
  const categoriaRepo = new SupabaseCategoriaRepository()

  const [productosResult, categoriasResult] = await Promise.all([
    listProductos(productoRepo, { tiendaId: auth.tiendaId }),
    listCategorias(categoriaRepo, auth.tiendaId),
  ])

  const productos  = productosResult.ok  ? productosResult.value  : []
  const categorias = categoriasResult.ok ? categoriasResult.value : []

  const categoriaMap = Object.fromEntries(categorias.map((c) => [c.id, c.nombre]))
  const activos   = productos.filter((p) => p.isActive).length
  const inactivos = productos.length - activos

  return (
    <>
      <PageHeader
        title="Productos"
        description={`${activos} activo${activos !== 1 ? 's' : ''}${inactivos > 0 ? ` · ${inactivos} inactivo${inactivos !== 1 ? 's' : ''}` : ''}`}
      >
        <AddProductoButton categorias={categorias} />
      </PageHeader>

      <ProductsSubNav />

      {productos.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed bg-card py-20 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-muted">
            <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-muted-foreground" aria-hidden>
              <path d="M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M16 3H8L6 7h12l-2-4z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <p className="text-sm font-semibold">Sin productos aún</p>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">
            Crea tu primer producto para comenzar a vender.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nombre</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">SKU</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Categoría</th>
                <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Precio</th>
                <th className="px-5 py-3.5 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">IVA</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Estado</th>
                <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {productos.map((product) => (
                <tr key={product.id} className="transition-colors hover:bg-muted/30">
                  <td className="px-5 py-4">
                    <div className="font-medium text-foreground">{product.nombre}</div>
                    {product.codigoBarras && (
                      <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">{product.codigoBarras}</div>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    {product.sku ? (
                      <code className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs text-foreground/70">
                        {product.sku}
                      </code>
                    ) : (
                      <span className="text-muted-foreground/50">—</span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-sm text-muted-foreground">
                    {product.categoriaId ? (categoriaMap[product.categoriaId] ?? '—') : (
                      <span className="text-muted-foreground/50">—</span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-right font-semibold tabular-nums text-foreground">
                    {formatCOP(product.precioVenta)}
                  </td>
                  <td className="px-5 py-4 text-center">
                    <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
                      {product.ivaTasa}%
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <Badge variant={product.isActive ? 'success' : 'outline'}>
                      {product.isActive ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <ProductoActions product={product} categorias={categorias} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
