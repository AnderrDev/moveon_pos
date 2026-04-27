'use client'

import { Controller, type FieldValues } from 'react-hook-form'
import { cn } from '@/shared/lib/utils'
import { FieldWrapper } from './FieldWrapper'
import type { FieldBaseProps } from './types'

export interface FormNumberInputProps<TValues extends FieldValues> extends FieldBaseProps<TValues> {
  placeholder?: string
  min?: number
  max?: number
  step?: number
}

/**
 * Campo numérico. Almacena el valor como number en el formulario.
 * Para valores monetarios usa FormCurrencyInput.
 */
export function FormNumberInput<TValues extends FieldValues>({
  control,
  name,
  label,
  placeholder,
  min,
  max,
  step = 1,
  disabled,
  required,
  description,
  className,
}: FormNumberInputProps<TValues>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <FieldWrapper
          label={label}
          error={fieldState.error?.message}
          description={description}
          required={required}
          className={className}
        >
          <input
            type="number"
            placeholder={placeholder}
            disabled={disabled}
            min={min}
            max={max}
            step={step}
            value={field.value ?? ''}
            onChange={(e) => {
              const val = e.target.value
              field.onChange(val === '' ? undefined : Number(val))
            }}
            onBlur={field.onBlur}
            name={field.name}
            ref={field.ref}
            className={cn(
              'w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
              'placeholder:text-muted-foreground',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
              'disabled:cursor-not-allowed disabled:opacity-50',
              '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
              fieldState.error && 'border-destructive focus-visible:ring-destructive',
            )}
          />
        </FieldWrapper>
      )}
    />
  )
}
