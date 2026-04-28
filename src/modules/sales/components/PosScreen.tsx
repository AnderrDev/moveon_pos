'use client'

import { useState } from 'react'
import { ProductGrid, type PosProduct, type PosCategory } from './ProductGrid'
import { CartPanel } from './CartPanel'
import { PaymentModal } from './PaymentModal'
import { SaleSuccessModal } from './SaleSuccessModal'
import { SalesHistory } from './SalesHistory'
import { useCartStore } from '../store/cart.store'
import { cn } from '@/shared/lib/utils'
import type { IvaRate } from '@/shared/types'
import type { TicketData } from './SaleSuccessModal'

interface Props {
  cashSessionId: string
  initialProducts: PosProduct[]
  categories: PosCategory[]
}

type PanelView = 'cart' | 'history'

export function PosScreen({ cashSessionId, initialProducts, categories }: Props) {
  const [checkoutOpen, setCheckoutOpen]     = useState(false)
  const [panelView, setPanelView]           = useState<PanelView>('cart')
  const [historyRefresh, setHistoryRefresh] = useState(0)
  const [successData, setSuccessData]       = useState<{
    saleId: string; saleNumber: string; total: number; change: number; ticketData: TicketData
  } | null>(null)

  const { addItem, items, totals } = useCartStore()

  function handleProductSelect(product: PosProduct) {
    addItem({
      id:          product.id,
      nombre:      product.nombre,
      sku:         product.sku,
      precioVenta: product.precioVenta,
      ivaTasa:     product.ivaTasa as IvaRate,
    })
    setPanelView('cart')
  }

  function handleSaleSuccess(saleId: string, saleNumber: string, change: number, ticketData: TicketData) {
    setCheckoutOpen(false)
    setSuccessData({ saleId, saleNumber, total: totals.total, change, ticketData })
    setHistoryRefresh((n) => n + 1)
  }

  function handleSuccessClose() {
    setSuccessData(null)
    setPanelView('history')
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-0">

      {/* ── Panel izquierdo — grid de productos ────────────── */}
      <div className="flex flex-1 flex-col gap-0 overflow-hidden">
        {/* Header strip */}
        <div className="flex items-center justify-between border-b px-4 py-3 lg:px-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {initialProducts.length} producto{initialProducts.length !== 1 ? 's' : ''}
          </p>
          {items.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {items.length} ítem{items.length !== 1 ? 's' : ''} en carrito
            </p>
          )}
        </div>

        <div className="flex-1 overflow-hidden p-4 lg:p-5">
          <ProductGrid
            products={initialProducts}
            categories={categories}
            onSelect={handleProductSelect}
          />
        </div>
      </div>

      {/* ── Panel derecho — carrito / historial ────────────── */}
      <aside className="flex w-80 flex-shrink-0 flex-col border-l bg-card xl:w-96">
        {/* Tabs */}
        <div className="flex border-b">
          {(['cart', 'history'] as PanelView[]).map((view) => {
            const label    = view === 'cart' ? 'Carrito' : 'Historial'
            const isActive = panelView === view
            return (
              <button
                key={view}
                onClick={() => setPanelView(view)}
                className={cn(
                  'flex flex-1 items-center justify-center gap-1.5 px-3 py-3 text-xs font-semibold uppercase tracking-wide transition-colors',
                  isActive
                    ? 'border-b-2 border-primary text-primary'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {label}
                {view === 'cart' && items.length > 0 && (
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
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

      {/* Modales */}
      <PaymentModal
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        cashSessionId={cashSessionId}
        onSuccess={handleSaleSuccess}
      />

      {successData && (
        <SaleSuccessModal
          open
          saleNumber={successData.saleNumber}
          total={successData.total}
          change={successData.change}
          ticketData={successData.ticketData}
          onClose={handleSuccessClose}
        />
      )}
    </div>
  )
}
