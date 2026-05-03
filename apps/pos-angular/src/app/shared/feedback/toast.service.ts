import { Injectable, signal } from '@angular/core'

export type ToastVariant = 'success' | 'error' | 'warning' | 'info'

export interface ToastInput {
  title?: string
  message: string
  variant?: ToastVariant
  durationMs?: number
}

export interface ToastItem extends Required<Omit<ToastInput, 'title'>> {
  id: string
  title?: string
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly state = signal<ToastItem[]>([])
  readonly items = this.state.asReadonly()

  show(input: ToastInput): string {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`
    const item: ToastItem = {
      id,
      title: input.title,
      message: input.message,
      variant: input.variant ?? 'info',
      durationMs: input.durationMs ?? 4000,
    }
    this.state.update((current) => [...current.slice(-3), item])
    window.setTimeout(() => this.dismiss(id), item.durationMs)
    return id
  }

  success(message: string, title?: string): string {
    return this.show({ message, title, variant: 'success' })
  }

  error(message: string, title?: string): string {
    return this.show({ message, title, variant: 'error', durationMs: 5000 })
  }

  warning(message: string, title?: string): string {
    return this.show({ message, title, variant: 'warning' })
  }

  info(message: string, title?: string): string {
    return this.show({ message, title, variant: 'info' })
  }

  dismiss(id: string): void {
    this.state.update((current) => current.filter((item) => item.id !== id))
  }
}
