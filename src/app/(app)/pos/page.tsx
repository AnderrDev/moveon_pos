import { redirect } from 'next/navigation'
import { getAuthContext } from '@/shared/lib/auth-context'
import { SupabaseCashRegisterRepository } from '@/modules/cash-register/infrastructure/repositories/supabase-cash-register.repository'
import { SupabaseProductRepository } from '@/modules/products/infrastructure/repositories/supabase-product.repository'
import { SupabaseCategoriaRepository } from '@/modules/products/infrastructure/repositories/supabase-categoria.repository'
import { PosScreen } from '@/modules/sales/components/PosScreen'
import { PageHeader } from '@/shared/components/layout/PageHeader'
import { Badge } from '@/shared/components/ui/Badge'

export default async function PosPage() {
  const auth = await getAuthContext()
  if (!auth) redirect('/login')

  const cashRepo     = new SupabaseCashRegisterRepository()
  const productRepo  = new SupabaseProductRepository()
  const categoriaRepo = new SupabaseCategoriaRepository()

  const [sessionResult, productsResult, categoriasResult] = await Promise.all([
    cashRepo.getOpenSession(auth.tiendaId),
    productRepo.search({ tiendaId: auth.tiendaId, soloActivos: true, limit: 200 }),
    categoriaRepo.findAll(auth.tiendaId),
  ])

  const session    = sessionResult.ok    ? sessionResult.value    : null
  const productos  = productsResult.ok   ? productsResult.value   : []
  const categorias = categoriasResult.ok ? categoriasResult.value : []

  if (!session) {
    return (
      <>
        <PageHeader title="Punto de Venta" description="No hay caja abierta">
          <Badge variant="outline">Caja cerrada</Badge>
        </PageHeader>
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed bg-card py-20 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-muted">
            <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-muted-foreground" aria-hidden>
              <rect x="2" y="7" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M16 11a4 4 0 11-8 0" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
          </div>
          <p className="text-sm font-semibold text-foreground">Caja cerrada</p>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">
            Abre la caja desde la sección <strong>Caja</strong> antes de comenzar a vender.
          </p>
          <a
            href="/caja"
            className="mt-4 inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:brightness-110"
          >
            Ir a Caja
          </a>
        </div>
      </>
    )
  }

  const initialProducts = productos.map((p) => ({
    id:           p.id,
    nombre:       p.nombre,
    sku:          p.sku,
    codigoBarras: p.codigoBarras,
    precioVenta:  p.precioVenta,
    ivaTasa:      p.ivaTasa,
    categoriaId:  p.categoriaId,
  }))

  const categories = categorias
    .filter((c) => c.isActive)
    .map((c) => ({ id: c.id, nombre: c.nombre }))

  return (
    <>
      <PageHeader
        title="Punto de Venta"
        description={`Turno abierto · Caja ${session.openingAmount.toLocaleString('es-CO')}`}
      >
        <Badge variant="success">Caja abierta</Badge>
      </PageHeader>
      <PosScreen
        cashSessionId={session.id}
        initialProducts={initialProducts}
        categories={categories}
      />
    </>
  )
}
