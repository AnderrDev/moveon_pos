'use client'

import { Controller, type FieldValues } from 'react-hook-form'
import { cn } from '@/shared/lib/utils'
import { FieldWrapper } from './FieldWrapper'
import type { FieldBaseProps, SelectOption } from './types'

export interface FormSelectProps<TValues extends FieldValues> extends FieldBaseProps<TValues> {
  options: SelectOption[]
  placeholder?: string
}

export function FormSelect<TValues extends FieldValues>({
  control,
  name,
  label,
  options,
  placeholder = 'Selecciona una opción',
  disabled,
  required,
  description,
  className,
}: FormSelectProps<TValues>) {
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
          <select
            {...field}
            disabled={disabled}
            value={field.value ?? ''}
            className={cn(
              'h-11 w-full rounded-lg border border-input bg-card px-3.5 py-2 text-sm shadow-sm',
              'transition-colors duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
              'disabled:cursor-not-allowed disabled:opacity-50',
              !field.value && 'text-muted-foreground',
              fieldState.error
                ? 'border-destructive focus-visible:ring-destructive/40'
                : 'hover:border-ring/40',
            )}
          >
            <option value="" disabled>
              {placeholder}
            </option>
            {options.map((opt) => (
              <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                {opt.label}
              </option>
            ))}
          </select>
        </FieldWrapper>
      )}
    />
  )
}
