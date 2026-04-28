import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
export { formatCurrency, formatShortDate, formatTime } from './format'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generateIdempotencyKey(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}
