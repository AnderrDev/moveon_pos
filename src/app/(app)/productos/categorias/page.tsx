import { redirect } from 'next/navigation'
import { getAuthContext } from '@/shared/lib/auth-context'
import { SupabaseCategoriaRepository } from '@/modules/products/infrastructure/repositories/supabase-categoria.repository'
import { SupabaseProductRepository } from '@/modules/products/infrastructure/repositories/supabase-product.repository'
import { listCategorias } from '@/modules/products/application/use-cases/list-categorias.use-case'
import { listProductos } from '@/modules/products/application/use-cases/list-productos.use-case'
import { PageHeader } from '@/shared/components/layout/PageHeader'
import { Badge } from '@/shared/components/ui/Badge'
import { AddCategoriaButton } from '@/modules/products/components/AddCategoriaButton'
import { CategoriaActions } from '@/modules/products/components/CategoriaActions'
import { ProductsSubNav } from '@/modules/products/components/ProductsSubNav'

export default async function CategoriasPage() {
  const auth = await getAuthContext()
  if (!auth) redirect('/login')

  const categoriaRepo = new SupabaseCategoriaRepository()
  const productoRepo  = new SupabaseProductRepository()

  const [categoriasResult, productosResult] = await Promise.all([
    listCategorias(categoriaRepo, auth.tiendaId),
    listProductos(productoRepo, { tiendaId: auth.tiendaId }),
  ])

  const categorias = categoriasResult.ok ? categoriasResult.value : []
  const productos  = productosResult.ok  ? productosResult.value  : []

  const productCounts = productos.reduce<Record<string, number>>((acc, p) => {
    if (p.categoriaId) acc[p.categoriaId] = (acc[p.categoriaId] ?? 0) + 1
    return acc
  }, {})

  const active   = categorias.filter((c) => c.isActive)
  const inactive = categorias.filter((c) => !c.isActive)

  return (
    <>
      <PageHeader
        title="Categorías"
        description={`${active.length} activa${active.length !== 1 ? 's' : ''} · ${categorias.length} en total`}
      >
        <AddCategoriaButton />
      </PageHeader>

      <ProductsSubNav />

      {categorias.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed bg-card py-20 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-muted">
            <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-muted-foreground" aria-hidden>
              <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
              <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
              <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
              <rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
          </div>
          <p className="text-sm font-semibold text-foreground">Sin categorías aún</p>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">
            Crea tu primera categoría para organizar el catálogo.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nombre</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Productos</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Estado</th>
                <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {[...active, ...inactive].map((categoria) => {
                const count = productCounts[categoria.id] ?? 0
                return (
                  <tr key={categoria.id} className="transition-colors hover:bg-muted/30">
                    <td className="px-5 py-4 font-medium text-foreground">{categoria.nombre}</td>
                    <td className="px-5 py-4">
                      {count > 0 ? (
                        <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground">
                          {count} producto{count !== 1 ? 's' : ''}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground/50">Sin productos</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <Badge variant={categoria.isActive ? 'success' : 'outline'}>
                        {categoria.isActive ? 'Activa' : 'Inactiva'}
                      </Badge>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <CategoriaActions categoria={categoria} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
