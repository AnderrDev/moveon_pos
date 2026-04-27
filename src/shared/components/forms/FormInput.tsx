'use client'

import { Controller, type FieldValues } from 'react-hook-form'
import { cn } from '@/shared/lib/utils'
import { FieldWrapper } from './FieldWrapper'
import type { FieldBaseProps } from './types'

export interface FormInputProps<TValues extends FieldValues> extends FieldBaseProps<TValues> {
  placeholder?: string
  type?: 'text' | 'email' | 'password' | 'search' | 'tel' | 'url'
  autoComplete?: string
  maxLength?: number
}

/**
 * Campo de texto genérico.
 * Usa internamente Controller de RHF — no expone `register` al módulo.
 */
export function FormInput<TValues extends FieldValues>({
  control,
  name,
  label,
  placeholder,
  type = 'text',
  disabled,
  required,
  description,
  autoComplete,
  maxLength,
  className,
}: FormInputProps<TValues>) {
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
            {...field}
            type={type}
            placeholder={placeholder}
            disabled={disabled}
            autoComplete={autoComplete}
            maxLength={maxLength}
            value={field.value ?? ''}
            className={cn(
              'h-11 w-full rounded-lg border border-input bg-card px-3.5 py-2 text-sm shadow-sm',
              'placeholder:text-muted-foreground/60',
              'transition-colors duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
              'disabled:cursor-not-allowed disabled:opacity-50',
              fieldState.error
                ? 'border-destructive focus-visible:ring-destructive/40'
                : 'hover:border-ring/40',
            )}
          />
        </FieldWrapper>
      )}
    />
  )
}
