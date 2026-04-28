'use client'

import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { AlertCircle, CheckCircle2, Info, X, AlertTriangle } from 'lucide-react'
import { cn } from '@/shared/lib/utils'

type ToastVariant = 'success' | 'error' | 'warning' | 'info'

interface ToastInput {
  title?: string
  message: string
  variant?: ToastVariant
  durationMs?: number
}

interface ToastItem extends Required<Omit<ToastInput, 'title'>> {
  id: string
  title?: string
}

interface ToastContextValue {
  show: (input: ToastInput) => string
  success: (message: string, title?: string) => string
  error: (message: string, title?: string) => string
  warning: (message: string, title?: string) => string
  info: (message: string, title?: string) => string
  dismiss: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const variantStyles: Record<ToastVariant, string> = {
  success: 'border-green-200 bg-green-50 text-green-950',
  error: 'border-destructive/25 bg-destructive/10 text-destructive',
  warning: 'border-amber-200 bg-amber-50 text-amber-950',
  info: 'border-blue-200 bg-blue-50 text-blue-950',
}

const iconStyles: Record<ToastVariant, string> = {
  success: 'text-green-600',
  error: 'text-destructive',
  warning: 'text-amber-600',
  info: 'text-blue-600',
}

function ToastIcon({ variant }: { variant: ToastVariant }) {
  const className = cn('mt-0.5 h-4 w-4 flex-shrink-0', iconStyles[variant])
  if (variant === 'success') return <CheckCircle2 className={className} />
  if (variant === 'error') return <AlertCircle className={className} />
  if (variant === 'warning') return <AlertTriangle className={className} />
  return <Info className={className} />
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const dismiss = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id))
  }, [])

  const show = useCallback((input: ToastInput) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`
    const item: ToastItem = {
      id,
      title: input.title,
      message: input.message,
      variant: input.variant ?? 'info',
      durationMs: input.durationMs ?? 4000,
    }
    setItems((current) => [...current.slice(-3), item])
    window.setTimeout(() => dismiss(id), item.durationMs)
    return id
  }, [dismiss])

  const value = useMemo<ToastContextValue>(() => ({
    show,
    dismiss,
    success: (message, title) => show({ message, title, variant: 'success' }),
    error: (message, title) => show({ message, title, variant: 'error', durationMs: 5000 }),
    warning: (message, title) => show({ message, title, variant: 'warning' }),
    info: (message, title) => show({ message, title, variant: 'info' }),
  }), [dismiss, show])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="fixed right-4 top-4 z-[70] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2"
        aria-live="polite"
        aria-atomic="true"
      >
        {items.map((item) => (
          <div
            key={item.id}
            className={cn(
              'flex items-start gap-3 rounded-lg border px-4 py-3 shadow-lg ring-1 ring-black/5',
              'animate-in fade-in-0 slide-in-from-top-2 duration-200',
              variantStyles[item.variant],
            )}
          >
            <ToastIcon variant={item.variant} />
            <div className="min-w-0 flex-1">
              {item.title && <p className="text-sm font-semibold leading-5">{item.title}</p>}
              <p className="text-sm leading-5">{item.message}</p>
            </div>
            <button
              type="button"
              onClick={() => dismiss(item.id)}
              className="flex h-8 w-8 items-center justify-center rounded-lg opacity-70 transition hover:bg-black/5 hover:opacity-100"
              aria-label="Cerrar notificación"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast debe usarse dentro de ToastProvider')
  return context
}
