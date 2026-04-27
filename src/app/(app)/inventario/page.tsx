import { redirect } from 'next/navigation'
import { getAuthContext } from '@/shared/lib/auth-context'
import { SupabaseInventoryRepository } from '@/modules/inventory/infrastructure/repositories/supabase-inventory.repository'
import { SupabaseProductRepository } from '@/modules/products/infrastructure/repositories/supabase-product.repository'
import { PageHeader } from '@/shared/components/layout/PageHeader'
import { RegisterEntryDialog } from '@/modules/inventory/components/RegisterEntryDialog'
import { StockTable } from '@/modules/inventory/components/StockTable'
import type { InventoryMovement } from '@/modules/inventory/domain/entities/inventory.entity'

export default async function InventarioPage() {
  const auth = await getAuthContext()
  if (!auth) redirect('/login')

  const invRepo     = new SupabaseInventoryRepository()
  const productRepo = new SupabaseProductRepository()

  const [stockResult, productosResult] = await Promise.all([
    invRepo.getStockLevels(auth.tiendaId),
    productRepo.search({ tiendaId: auth.tiendaId, soloActivos: true, limit: 200 }),
  ])

  const stockLevels = stockResult.ok  ? stockResult.value  : []
  const productos   = productosResult.ok ? productosResult.value : []

  // Mapa productId → product
  const productMap = Object.fromEntries(productos.map((p) => [p.id, p]))

  // Kardex de todos los productos (últimos 50 por producto)
  const kardexMap: Record<string, InventoryMovement[]> = {}
  await Promise.all(
    stockLevels.map(async (sl) => {
      const r = await invRepo.getKardex(sl.productId, auth.tiendaId, 50)
      if (r.ok) kardexMap[sl.productId] = r.value
    }),
  )

  // Combinar stock + product info para renderizar
  const rows = stockLevels
    .filter((sl) => productMap[sl.productId])
    .map((sl) => ({ stockLevel: sl, product: productMap[sl.productId] }))
    .sort((a, b) => {
      // Primero los de stock bajo, luego alfabético
      if (a.stockLevel.isLow !== b.stockLevel.isLow) return a.stockLevel.isLow ? -1 : 1
      return a.product.nombre.localeCompare(b.product.nombre)
    })

  const lowCount = rows.filter((r) => r.stockLevel.isLow).length

  const productosParaEntrada = productos.map((p) => ({
    id:     p.id,
    nombre: p.nombre,
    sku:    p.sku,
  }))

  return (
    <>
      <PageHeader
        title="Inventario"
        description={
          lowCount > 0
            ? `${rows.length} producto${rows.length !== 1 ? 's' : ''} · ${lowCount} con stock bajo`
            : `${rows.length} producto${rows.length !== 1 ? 's' : ''} · Todo en orden`
        }
      >
        <RegisterEntryDialog products={productosParaEntrada} />
      </PageHeader>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed bg-card py-20 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-muted">
            <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-muted-foreground" aria-hidden>
              <path d="M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M16 3H8L6 7h12l-2-4z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <p className="text-sm font-semibold">Sin productos con stock</p>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">
            Crea productos y registra entradas para ver el inventario aquí.
          </p>
        </div>
      ) : (
        <StockTable rows={rows} kardexMap={kardexMap} />
      )}
    </>
  )
}
