import type { Control, FieldPath, FieldValues } from 'react-hook-form'

/**
 * Props base que comparten TODOS los campos del sistema de formularios.
 * Principio ISP: solo contiene lo verdaderamente común.
 * Cada FormXxx extiende esta interfaz con sus props específicas.
 */
export interface FieldBaseProps<TValues extends FieldValues> {
  control: Control<TValues>
  name: FieldPath<TValues>
  label: string
  disabled?: boolean
  required?: boolean
  /** Texto de ayuda que aparece debajo del campo */
  description?: string
  className?: string
}

/** Opción para FormSelect y FormCombobox */
export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}
