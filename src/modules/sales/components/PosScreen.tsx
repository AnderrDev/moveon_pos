'use client'

import { useState } from 'react'
import { ProductSearch } from '@/modules/products/components/ProductSearch'
import { CartPanel } from './CartPanel'
import { PaymentModal } from './PaymentModal'
import { SaleSuccessModal } from './SaleSuccessModal'
import { SalesHistory } from './SalesHistory'
import { useCartStore } from '../store/cart.store'
import { cn } from '@/shared/lib/utils'
import type { ProductSearchResult } from '@/modules/products/application/actions/search-products.action'
import type { IvaRate } from '@/shared/types'

interface Props {
  cashSessionId: string
}

type PanelView = 'cart' | 'history'

export function PosScreen({ cashSessionId }: Props) {
  const [checkoutOpen, setCheckoutOpen]   = useState(false)
  const [panelView, setPanelView]         = useState<PanelView>('cart')
  const [historyRefresh, setHistoryRefresh] = useState(0)
  const [successData, setSuccessData]     = useState<{
    saleId: string; saleNumber: string; total: number; change: number
  } | null>(null)

  const { addItem, items, totals } = useCartStore()

  function handleProductSelect(product: ProductSearchResult) {
    addItem({
      id:          product.id,
      nombre:      product.nombre,
      sku:         product.sku,
      precioVenta: product.precioVenta,
      ivaTasa:     product.ivaTasa as IvaRate,
    })
    // Asegurarse de que el carrito esté visible al agregar
    setPanelView('cart')
  }

  function handleSaleSuccess(saleId: string, saleNumber: string, change: number) {
    setCheckoutOpen(false)
    setSuccessData({ saleId, saleNumber, total: totals.total, change })
    setHistoryRefresh((n) => n + 1)
  }

  function handleSuccessClose() {
    setSuccessData(null)
    setPanelView('history')
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-0">
      {/* Panel izquierdo — búsqueda */}
      <div className="flex flex-1 flex-col gap-4 overflow-hidden p-4 lg:p-6">
        <ProductSearch
          onSelect={handleProductSelect}
          placeholder="Buscar producto por nombre, SKU o código de barras…"
          autoFocus
        />

        <div className="flex flex-1 items-center justify-center">
          {items.length === 0 ? (
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
                <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7 text-muted-foreground" aria-hidden>
                  <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.75"/>
                  <path d="M16.5 16.5L21 21" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
                </svg>
              </div>
              <p className="text-sm text-muted-foreground">Busca un producto para comenzar la venta</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {items.length} ítem{items.length !== 1 ? 's' : ''} · Total{' '}
              {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(totals.total)}
            </p>
          )}
        </div>
      </div>

      {/* Panel derecho — carrito / historial con tabs */}
      <aside className="flex w-80 flex-shrink-0 flex-col border-l bg-card">
        {/* Tabs */}
        <div className="flex border-b">
          {(['cart', 'history'] as PanelView[]).map((view) => {
            const label = view === 'cart' ? 'Carrito' : 'Historial'
            const isActive = panelView === view
            return (
              <button
                key={view}
                onClick={() => setPanelView(view)}
                className={cn(
                  'flex-1 px-3 py-3 text-xs font-semibold uppercase tracking-wide transition-colors',
                  isActive
                    ? 'border-b-2 border-primary text-primary'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {label}
                {view === 'cart' && items.length > 0 && (
                  <span className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-white font-bold">
                    {items.length}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        <div className="flex-1 overflow-hidden">
          {panelView === 'cart' ? (
            <CartPanel onCheckout={() => setCheckoutOpen(true)} />
          ) : (
            <SalesHistory cashSessionId={cashSessionId} refreshTrigger={historyRefresh} />
          )}
        </div>
      </aside>

      {/* Modal de pago */}
      <PaymentModal
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        cashSessionId={cashSessionId}
        onSuccess={handleSaleSuccess}
      />

      {/* Modal de éxito */}
      {successData && (
        <SaleSuccessModal
          open
          saleNumber={successData.saleNumber}
          total={successData.total}
          change={successData.change}
          onClose={handleSuccessClose}
        />
      )}
    </div>
  )
}
