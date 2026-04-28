'use client'

import { useState, useRef, useCallback } from 'react'
import { cn } from '@/shared/lib/utils'
import { formatCurrency as formatCOP } from '@/shared/lib/format'

export type PosProduct = {
  id: string
  nombre: string
  sku: string | null
  codigoBarras: string | null
  precioVenta: number
  ivaTasa: number
  categoriaId: string | null
}

export type PosCategory = {
  id: string
  nombre: string
}

interface Props {
  products: PosProduct[]
  categories: PosCategory[]
  onSelect: (product: PosProduct) => void
}

export function ProductGrid({ products, categories, onSelect }: Props) {
  const [query, setQuery]                   = useState('')
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [flashId, setFlashId]               = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  /* ── Filtrado client-side ─────────────────────────────── */
  const q = query.toLowerCase().trim()
  const filtered = products.filter((p) => {
    const matchesCat = activeCategory === null || p.categoriaId === activeCategory
    if (!q) return matchesCat
    return (
      matchesCat &&
      (p.nombre.toLowerCase().includes(q) ||
        (p.sku?.toLowerCase().includes(q) ?? false) ||
        p.codigoBarras === query.trim())
    )
  })

  const handleSelect = useCallback(
    (product: PosProduct) => {
      setFlashId(product.id)
      onSelect(product)
      setTimeout(() => setFlashId(null), 250)
    },
    [onSelect],
  )

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value
    setQuery(value)

    // Auto-select en coincidencia exacta de código de barras
    const trimmed = value.trim()
    if (trimmed.length >= 6) {
      const barcodeMatch = products.find((p) => p.codigoBarras === trimmed)
      if (barcodeMatch) {
        handleSelect(barcodeMatch)
        setQuery('')
      }
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && filtered.length === 1) {
      e.preventDefault()
      handleSelect(filtered[0])
      setQuery('')
    }
  }

  /* ── Render ───────────────────────────────────────────── */
  return (
    <div className="flex h-full flex-col gap-3">

      {/* Búsqueda */}
      <div className="relative">
        <svg
          viewBox="0 0 24 24" fill="none"
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        >
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.75" />
          <path d="M16.5 16.5L21 21" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        </svg>
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          autoFocus
          placeholder="Buscar por nombre, SKU o código de barras…"
          style={{ touchAction: 'manipulation' }}
          className={cn(
            'h-11 w-full rounded-xl border bg-background pl-10 pr-9 text-sm',
            'placeholder:text-muted-foreground',
            'focus:outline-none focus:ring-2 focus:ring-ring',
            'transition-shadow',
          )}
        />
        {query && (
          <button
            onClick={() => { setQuery(''); inputRef.current?.focus() }}
            aria-label="Limpiar búsqueda"
            className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <svg viewBox="0 0 16 16" fill="none" className="h-3 w-3" aria-hidden>
              <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>

      {/* Chips de categoría */}
      {categories.length > 0 && (
        <div
          className="flex gap-2 overflow-x-auto pb-1"
          style={{ scrollbarWidth: 'none' }}
        >
          <button
            onClick={() => setActiveCategory(null)}
            className={cn(
              'shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all duration-150',
              activeCategory === null
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-muted text-muted-foreground hover:bg-muted/70',
            )}
          >
            Todos
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(activeCategory === cat.id ? null : cat.id)}
              className={cn(
                'shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all duration-150',
                activeCategory === cat.id
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted text-muted-foreground hover:bg-muted/70',
              )}
            >
              {cat.nombre}
            </button>
          ))}
        </div>
      )}

      {/* Conteo y grid */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        {filtered.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center gap-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-muted-foreground" aria-hidden>
                <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.75" />
                <path d="M16.5 16.5L21 21" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
              </svg>
            </div>
            <p className="text-sm text-muted-foreground">
              {q ? `Sin resultados para "${query}"` : 'Sin productos disponibles'}
            </p>
          </div>
        ) : (
          <>
            {q && (
              <p className="mb-2 text-xs text-muted-foreground">
                {filtered.length} resultado{filtered.length !== 1 ? 's' : ''} para &ldquo;{query}&rdquo;
              </p>
            )}
            <div className="grid grid-cols-2 gap-2 pb-4 sm:grid-cols-3 xl:grid-cols-4">
              {filtered.map((product) => (
                <button
                  key={product.id}
                  onClick={() => handleSelect(product)}
                  style={{ touchAction: 'manipulation' }}
                  className={cn(
                    'group relative flex min-h-[96px] cursor-pointer flex-col items-start rounded-xl border bg-card p-3.5 text-left',
                    'transition-all duration-150',
                    'hover:border-primary/50 hover:bg-primary/5 hover:shadow-sm',
                    'active:scale-[0.96]',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    flashId === product.id
                      ? 'scale-[0.96] border-primary bg-primary/10'
                      : '',
                  )}
                >
                  {/* Nombre */}
                  <p className="line-clamp-2 text-sm font-semibold leading-snug text-foreground transition-colors group-hover:text-primary">
                    {product.nombre}
                  </p>
                  {product.sku && (
                    <p className="mt-0.5 font-mono text-[10px] leading-none text-muted-foreground">
                      {product.sku}
                    </p>
                  )}

                  {/* Precio */}
                  <div className="mt-auto pt-2">
                    <p className="text-base font-bold tabular-nums text-primary">
                      {formatCOP(product.precioVenta)}
                    </p>
                    {product.ivaTasa > 0 && (
                      <p className="text-[10px] tabular-nums text-muted-foreground">
                        +IVA {product.ivaTasa}%
                      </p>
                    )}
                  </div>

                  {/* Icono + (visible en hover) */}
                  <span
                    aria-hidden
                    className={cn(
                      'absolute right-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded-full',
                      'bg-primary text-primary-foreground',
                      'scale-75 opacity-0 transition-all duration-150',
                      'group-hover:scale-100 group-hover:opacity-100',
                    )}
                  >
                    <svg viewBox="0 0 16 16" fill="none" className="h-3 w-3" aria-hidden>
                      <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
