'use client'

import { cn } from '@/shared/lib/utils'

interface FieldWrapperProps {
  label: string
  error?: string
  description?: string
  required?: boolean
  className?: string
  children: React.ReactNode
}

/**
 * Componente interno de layout para campos de formulario.
 * Responsabilidad única: renderizar label + campo + descripción + error.
 * No se exporta directamente — úsalo dentro de los FormXxx.
 *
 * SRP: este componente no sabe nada de RHF, Zod ni validación.
 */
export function FieldWrapper({
  label,
  error,
  description,
  required,
  className,
  children,
}: FieldWrapperProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label className="text-sm font-semibold text-foreground">
        {label}
        {required && <span className="ml-0.5 text-destructive" aria-hidden> *</span>}
      </label>

      {children}

      {description && !error && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}

      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
