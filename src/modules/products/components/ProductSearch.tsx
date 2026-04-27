'use client'

import { useState, useEffect, useRef, useTransition } from 'react'
import { searchProductsAction, type ProductSearchResult } from '../application/actions/search-products.action'
import { cn } from '@/shared/lib/utils'

function formatCOP(value: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value)
}

interface Props {
  onSelect: (product: ProductSearchResult) => void
  placeholder?: string
  autoFocus?: boolean
}

export function ProductSearch({ onSelect, placeholder = 'Buscar por nombre, SKU o código de barras…', autoFocus }: Props) {
  const [query, setQuery]           = useState('')
  const [results, setResults]       = useState<ProductSearchResult[]>([])
  const [open, setOpen]             = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [isPending, startTransition] = useTransition()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef    = useRef<HTMLInputElement>(null)
  const listRef     = useRef<HTMLUListElement>(null)

  // Detect barcode scanner: >6 chars arriving within 100ms
  const lastInputTime = useRef(Date.now())
  const inputBuffer   = useRef('')

  useEffect(() => {
    if (query.length < 2) {
      setResults([])
      setOpen(false)
      return
    }

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      startTransition(async () => {
        const data = await searchProductsAction(query)
        setResults(data)
        setOpen(data.length > 0)
        setActiveIndex(-1)
      })
    }, 200)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query])

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value
    const now   = Date.now()

    // Scanner detection: rapid burst of characters
    if (now - lastInputTime.current < 100) {
      inputBuffer.current += value.slice(-1)
    } else {
      inputBuffer.current = value
    }
    lastInputTime.current = now

    setQuery(value)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault()
      selectProduct(results[activeIndex])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  function selectProduct(product: ProductSearchResult) {
    onSelect(product)
    setQuery('')
    setResults([])
    setOpen(false)
    inputRef.current?.focus()
  }

  return (
    <div className="relative">
      <div className="relative">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        >
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.75"/>
          <path d="M16.5 16.5L21 21" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          autoFocus={autoFocus}
          placeholder={placeholder}
          className={cn(
            'h-11 w-full rounded-xl border bg-background pl-10 pr-4 text-sm',
            'placeholder:text-muted-foreground',
            'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0',
            'transition-shadow',
            isPending && 'opacity-70',
          )}
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls="product-search-list"
          role="combobox"
        />
        {isPending && (
          <div className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2">
            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-muted border-t-primary" />
          </div>
        )}
      </div>

      {open && results.length > 0 && (
        <ul
          id="product-search-list"
          ref={listRef}
          role="listbox"
          className="absolute z-50 mt-1.5 w-full overflow-hidden rounded-xl border bg-card shadow-lg ring-1 ring-border/40"
        >
          {results.map((product, i) => (
            <li
              key={product.id}
              role="option"
              aria-selected={i === activeIndex}
              onMouseDown={() => selectProduct(product)}
              onMouseEnter={() => setActiveIndex(i)}
              className={cn(
                'flex cursor-pointer items-center justify-between px-4 py-3 text-sm transition-colors',
                i === activeIndex ? 'bg-primary text-white' : 'hover:bg-muted/60',
                i > 0 && 'border-t',
              )}
            >
              <div className="min-w-0 flex-1">
                <p className={cn('truncate font-medium', i === activeIndex ? 'text-white' : 'text-foreground')}>
                  {product.nombre}
                </p>
                {(product.sku || product.codigoBarras) && (
                  <p className={cn('mt-0.5 font-mono text-xs', i === activeIndex ? 'text-white/70' : 'text-muted-foreground')}>
                    {product.sku ?? product.codigoBarras}
                  </p>
                )}
              </div>
              <div className="ml-4 shrink-0 text-right">
                <p className={cn('font-semibold tabular-nums', i === activeIndex ? 'text-white' : 'text-foreground')}>
                  {formatCOP(product.precioVenta)}
                </p>
                <p className={cn('text-xs tabular-nums', i === activeIndex ? 'text-white/70' : 'text-muted-foreground')}>
                  IVA {product.ivaTasa}%
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
