'use client'

import { Controller, type FieldValues } from 'react-hook-form'
import { cn } from '@/shared/lib/utils'
import type { FieldBaseProps } from './types'

export interface FormCheckboxProps<TValues extends FieldValues>
  extends Omit<FieldBaseProps<TValues>, 'required'> {
  /** Texto descriptivo que aparece junto al checkbox (si es distinto del label) */
  checkLabel?: string
}

/**
 * Checkbox con layout horizontal (label inline).
 * Diseño diferente a los otros campos: label va al lado, no arriba.
 * El error aparece debajo del checkbox.
 */
export function FormCheckbox<TValues extends FieldValues>({
  control,
  name,
  label,
  checkLabel,
  disabled,
  description,
  className,
}: FormCheckboxProps<TValues>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <div className={cn('flex flex-col gap-1', className)}>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={field.value ?? false}
              onChange={(e) => field.onChange(e.target.checked)}
              onBlur={field.onBlur}
              name={field.name}
              ref={field.ref}
              disabled={disabled}
              className={cn(
                'h-4 w-4 rounded border border-input',
                'accent-primary',
                'disabled:cursor-not-allowed disabled:opacity-50',
                fieldState.error && 'border-destructive',
              )}
            />
            <span className="text-sm font-medium text-foreground">
              {checkLabel ?? label}
            </span>
          </label>

          {description && !fieldState.error && (
            <p className="ml-6 text-xs text-muted-foreground">{description}</p>
          )}

          {fieldState.error && (
            <p className="ml-6 text-xs text-destructive" role="alert">
              {fieldState.error.message}
            </p>
          )}
        </div>
      )}
    />
  )
}
