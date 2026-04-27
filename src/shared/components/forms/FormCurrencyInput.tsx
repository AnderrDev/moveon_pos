'use client'

import { useState } from 'react'
import { Controller, type FieldValues } from 'react-hook-form'
import { formatCurrency } from '@/shared/lib/utils'
import { cn } from '@/shared/lib/utils'
import { FieldWrapper } from './FieldWrapper'
import type { FieldBaseProps } from './types'

export interface FormCurrencyInputProps<TValues extends FieldValues>
  extends FieldBaseProps<TValues> {
  placeholder?: string
  /** Valor máximo permitido en pesos (default: 100_000_000) */
  max?: number
}

/**
 * Campo de entrada de valores monetarios en COP (pesos colombianos).
 *
 * Comportamiento:
 * - Muestra el valor formateado ($1.500.000) cuando no está en foco
 * - Al enfocar: muestra el número crudo para edición (1500000)
 * - Almacena internamente como number entero (sin centavos)
 * - Rechaza caracteres no numéricos durante la edición
 *
 * El schema Zod del DTO debe usar moneySchema (number int).
 */
export function FormCurrencyInput<TValues extends FieldValues>({
  control,
  name,
  label,
  placeholder = 'Ej: 25000',
  disabled,
  required,
  description,
  max = 100_000_000,
  className,
}: FormCurrencyInputProps<TValues>) {
  const [isFocused, setIsFocused] = useState(false)

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const numericValue: number | undefined = field.value

        // Valor mostrado: formateado fuera de foco, crudo dentro de foco
        const displayValue = isFocused
          ? (numericValue ?? '') === 0 ? '' : String(numericValue ?? '')
          : numericValue != null && numericValue > 0
            ? formatCurrency(numericValue)
            : ''

        return (
          <FieldWrapper
            label={label}
            error={fieldState.error?.message}
            description={description}
            required={required}
            className={className}
          >
            <div className="relative">
              {/* Hidden input lleva el valor numérico real al FormData */}
              <input type="hidden" name={field.name} value={numericValue ?? ''} />

              {!isFocused && numericValue == null && (
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  $
                </span>
              )}
              <input
                type="text"
                inputMode="numeric"
                placeholder={isFocused ? placeholder : '$ ' + placeholder}
                disabled={disabled}
                ref={field.ref}
                value={displayValue}
                onFocus={() => setIsFocused(true)}
                onBlur={() => {
                  setIsFocused(false)
                  field.onBlur()
                }}
                onChange={(e) => {
                  const raw = e.target.value.replace(/\D/g, '')
                  if (raw === '') {
                    field.onChange(undefined)
                    return
                  }
                  const parsed = parseInt(raw, 10)
                  if (!isNaN(parsed) && parsed <= max) {
                    field.onChange(parsed)
                  }
                }}
                className={cn(
                  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
                  'placeholder:text-muted-foreground',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                  fieldState.error && 'border-destructive focus-visible:ring-destructive',
                )}
              />
            </div>
          </FieldWrapper>
        )
      }}
    />
  )
}
