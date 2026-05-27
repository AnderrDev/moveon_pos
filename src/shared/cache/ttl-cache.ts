export interface TtlCacheOptions {
  ttlMs: number
  now?: () => number
}

export interface EnsureOptions {
  force?: boolean
  ttlMs?: number
}

/**
 * Cache de un solo valor por scope (key string) con TTL e in-flight coalescing.
 *
 * Uso típico: cargas asíncronas (red/DB) que se piden desde múltiples lugares
 * y deben coalescerse en una sola petición mientras estén en vuelo, y devolver
 * el valor cacheado mientras esté fresco.
 */
export class TtlCache<T> {
  private value: T | null = null
  private loadedAt = 0
  private scope: string | null = null
  private inflight: Promise<T> | null = null
  private inflightScope: string | null = null

  constructor(private readonly options: TtlCacheOptions) {}

  private now(): number {
    return this.options.now ? this.options.now() : Date.now()
  }

  get current(): T | null {
    return this.value
  }

  isFresh(scope: string, ttlMs?: number): boolean {
    const ttl = ttlMs ?? this.options.ttlMs
    return this.value !== null && this.scope === scope && this.now() - this.loadedAt < ttl
  }

  set(scope: string, value: T): void {
    this.value = value
    this.scope = scope
    this.loadedAt = this.now()
  }

  invalidate(): void {
    this.value = null
    this.loadedAt = 0
    this.scope = null
    this.inflight = null
    this.inflightScope = null
  }

  async ensure(
    scope: string,
    loader: () => Promise<T>,
    options: EnsureOptions = {},
  ): Promise<T> {
    if (!options.force && this.isFresh(scope, options.ttlMs)) {
      return this.value as T
    }
    if (this.inflight && this.inflightScope === scope) {
      return this.inflight
    }

    this.inflightScope = scope
    const pending = loader()
      .then((data) => {
        this.value = data
        this.scope = scope
        this.loadedAt = this.now()
        return data
      })
      .finally(() => {
        if (this.inflight === pending) {
          this.inflight = null
          this.inflightScope = null
        }
      })
    this.inflight = pending
    return pending
  }
}
