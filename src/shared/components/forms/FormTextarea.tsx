'use client'

import { Controller, type FieldValues } from 'react-hook-form'
import { cn } from '@/shared/lib/utils'
import { FieldWrapper } from './FieldWrapper'
import type { FieldBaseProps } from './types'

export interface FormTextareaProps<TValues extends FieldValues> extends FieldBaseProps<TValues> {
  placeholder?: string
  rows?: number
  maxLength?: number
  resize?: 'none' | 'vertical' | 'horizontal' | 'both'
}

export function FormTextarea<TValues extends FieldValues>({
  control,
  name,
  label,
  placeholder,
  rows = 3,
  disabled,
  required,
  description,
  maxLength,
  resize = 'vertical',
  className,
}: FormTextareaProps<TValues>) {
  const resizeClass = {
    none: 'resize-none',
    vertical: 'resize-y',
    horizontal: 'resize-x',
    both: 'resize',
  }[resize]

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
          <textarea
            {...field}
            placeholder={placeholder}
            rows={rows}
            disabled={disabled}
            maxLength={maxLength}
            value={field.value ?? ''}
            className={cn(
              'w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
              'placeholder:text-muted-foreground',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
              'disabled:cursor-not-allowed disabled:opacity-50',
              resizeClass,
              fieldState.error && 'border-destructive focus-visible:ring-destructive',
            )}
          />
        </FieldWrapper>
      )}
    />
  )
}
