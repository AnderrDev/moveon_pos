'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { Route } from 'next'
import {
  ShoppingCart,
  Package,
  BarChart3,
  Archive,
  DollarSign,
  Users,
  LogOut,
  Dumbbell,
} from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { signOutAction } from '@/modules/auth/application/actions/sign-out.action'

interface NavItem {
  label: string
  href: Route
  icon: React.ElementType
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Punto de Venta', href: '/pos'        as Route, icon: ShoppingCart },
  { label: 'Productos',      href: '/productos'  as Route, icon: Package },
  { label: 'Inventario',     href: '/inventario' as Route, icon: Archive },
  { label: 'Caja',           href: '/caja'       as Route, icon: DollarSign },
  { label: 'Clientes',       href: '/clientes'   as Route, icon: Users },
  { label: 'Reportes',       href: '/reportes'   as Route, icon: BarChart3 },
]

interface SidebarProps {
  userEmail: string | undefined
}

export function Sidebar({ userEmail }: SidebarProps) {
  const pathname = usePathname()
  const userInitial = (userEmail?.[0] ?? 'U').toUpperCase()
  const userName = userEmail?.split('@')[0] ?? 'Usuario'

  return (
    <aside className="flex w-64 flex-shrink-0 flex-col bg-sidebar border-r border-sidebar-border">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-[1.125rem] border-b border-sidebar-border">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary shadow-sm">
          <Dumbbell className="h-[1.1rem] w-[1.1rem] text-white" />
        </div>
        <div>
          <p className="font-display font-bold text-white text-[13px] leading-none tracking-wide">
            MOVEONAPP
          </p>
          <p className="mt-[3px] text-[11px] text-sidebar-muted font-medium">
            Punto de Venta
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        <p className="mb-2.5 px-2 text-[10px] font-bold uppercase tracking-[0.12em] text-sidebar-muted">
          Módulos
        </p>
        {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(`${href}/`)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium',
                'transition-all duration-150',
                isActive
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-sidebar-fg hover:bg-sidebar-hover hover:text-white',
              )}
            >
              <Icon
                className={cn(
                  'h-4 w-4 flex-shrink-0 transition-colors duration-150',
                  isActive
                    ? 'text-white/90'
                    : 'text-sidebar-muted group-hover:text-white/80',
                )}
              />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* User + Logout */}
      <div className="px-3 py-4 border-t border-sidebar-border">
        <div className="mb-2 flex items-center gap-3 rounded-lg px-2 py-2">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white uppercase ring-2 ring-primary/30">
            {userInitial}
          </div>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-white">{userName}</p>
            <p className="text-[11px] text-sidebar-muted">Operador</p>
          </div>
        </div>

        <form action={signOutAction}>
          <button
            type="submit"
            className={cn(
              'group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium',
              'text-sidebar-muted transition-all duration-150',
              'hover:bg-sidebar-hover hover:text-white',
            )}
          >
            <LogOut className="h-4 w-4 flex-shrink-0 transition-colors group-hover:text-white/80" />
            Cerrar sesión
          </button>
        </form>
      </div>
    </aside>
  )
}
