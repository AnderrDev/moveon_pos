'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/shared/lib/utils'

interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: React.ReactNode
  className?: string
  isBusy?: boolean
}

export function Dialog({ open, onClose, title, description, children, className, isBusy = false }: DialogProps) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape' && !isBusy) onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose, isBusy])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        onClick={() => { if (!isBusy) onClose() }}
        aria-hidden
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal
        aria-labelledby="dialog-title"
        className={cn(
          'relative z-10 w-full max-w-md overflow-hidden rounded-2xl bg-card shadow-2xl',
          'ring-1 ring-border/60',
          'animate-in fade-in-0 zoom-in-95 duration-150',
          className,
        )}
      >
        {/* Orange top accent */}
        <div className="h-1 w-full overflow-hidden bg-primary/25">
          <div className={cn('h-full bg-primary', isBusy && 'animate-pulse')} />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between border-b px-6 pt-5 pb-4">
          <div>
            <h2 id="dialog-title" className="font-display text-lg font-bold leading-none">
              {title}
            </h2>
            {description && (
              <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            disabled={isBusy}
            className="ml-4 flex-shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}
