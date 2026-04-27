'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { Route } from 'next'
import { cn } from '@/shared/lib/utils'

const tabs: { label: string; href: Route }[] = [
  { label: 'Catálogo',    href: '/productos' as Route },
  { label: 'Categorías',  href: '/productos/categorias' as Route },
]

export function ProductsSubNav() {
  const pathname = usePathname()

  return (
    <div className="mb-6 flex gap-1 border-b border-border">
      {tabs.map((tab) => {
        const isActive = pathname === tab.href
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              'px-4 py-2.5 text-sm font-medium -mb-px border-b-2 transition-colors duration-150',
              isActive
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border',
            )}
          >
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}
