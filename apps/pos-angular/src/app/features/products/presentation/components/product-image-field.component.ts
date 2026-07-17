import {
  ChangeDetectionStrategy,
  Component,
  forwardRef,
  inject,
  input,
  signal,
} from '@angular/core'
import { NG_VALUE_ACCESSOR, type ControlValueAccessor } from '@angular/forms'
import { getErrorMessage } from '@/shared/lib/error-message'
import { ProductImageStorageService } from '@angular-app/features/products/data/datasources/product-image-storage.service'

/**
 * Campo de imagen de producto para el formulario del admin.
 *
 * Es un ControlValueAccessor: el valor del control es la URL pública de la imagen
 * (o '' si no hay). Sube archivos a Supabase Storage vía {@link ProductImageStorageService}
 * y también admite pegar una URL externa manualmente (compatibilidad con las
 * imágenes cargadas desde CDNs de terceros).
 */
@Component({
  selector: 'mo-product-image-field',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => ProductImageFieldComponent),
      multi: true,
    },
  ],
  template: `
    <div class="flex flex-col gap-1.5">
      <span class="text-foreground text-sm font-semibold">Imagen del producto</span>

      <div class="flex items-start gap-4">
        <!-- Preview / placeholder -->
        <div
          class="border-input bg-card relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border"
        >
          @if (value()) {
            <img [src]="value()" alt="Imagen del producto" class="h-full w-full object-contain" />
          } @else {
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="text-muted-foreground/50 h-8 w-8">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="9" cy="9" r="2" />
              <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
            </svg>
          }

          @if (uploading()) {
            <div class="bg-background/70 absolute inset-0 flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" class="text-primary h-6 w-6 animate-spin">
                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" class="opacity-25" />
                <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
              </svg>
            </div>
          }
        </div>

        <div class="flex min-w-0 flex-1 flex-col gap-2">
          <div class="flex flex-wrap gap-2">
            <button
              type="button"
              [disabled]="disabled() || uploading()"
              (click)="fileInput.click()"
              class="border-input bg-card hover:bg-accent disabled:opacity-50 inline-flex h-9 items-center rounded-lg border px-3 text-sm font-medium transition-colors"
            >
              {{ value() ? 'Cambiar imagen' : 'Subir imagen' }}
            </button>
            @if (value()) {
              <button
                type="button"
                [disabled]="disabled() || uploading()"
                (click)="clear()"
                class="text-muted-foreground hover:text-destructive disabled:opacity-50 inline-flex h-9 items-center rounded-lg px-2 text-sm font-medium transition-colors"
              >
                Quitar
              </button>
            }
          </div>

          <input
            #fileInput
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            class="hidden"
            (change)="onFileSelected($event)"
          />

          <input
            type="url"
            [value]="value()"
            [disabled]="disabled() || uploading()"
            (input)="onUrlInput($any($event.target).value)"
            placeholder="o pega una URL de imagen"
            class="border-input bg-card focus:ring-ring h-9 w-full rounded-lg border px-3 text-xs outline-none focus:ring-2 disabled:opacity-50"
          />

          @if (error()) {
            <p class="text-destructive text-xs" role="alert">{{ error() }}</p>
          } @else {
            <p class="text-muted-foreground text-xs">JPG, PNG, WebP o AVIF · máx. 5 MB</p>
          }
        </div>
      </div>
    </div>
  `,
})
export class ProductImageFieldComponent implements ControlValueAccessor {
  private readonly storage = inject(ProductImageStorageService)

  /** Tienda dueña del producto; define la carpeta destino en Storage. */
  readonly tiendaId = input.required<string>()

  readonly value = signal('')
  readonly uploading = signal(false)
  readonly error = signal<string | null>(null)
  readonly disabled = signal(false)

  private onChange: (value: string) => void = () => undefined
  private onTouched: () => void = () => undefined

  writeValue(value: string | null): void {
    this.value.set(value ?? '')
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled)
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    input.value = '' // permite re-seleccionar el mismo archivo
    if (!file) return

    const validationError = this.storage.validate(file)
    if (validationError) {
      this.error.set(validationError)
      return
    }

    this.error.set(null)
    this.uploading.set(true)
    try {
      const url = await this.storage.upload(file, this.tiendaId())
      this.setValue(url)
    } catch (err) {
      this.error.set(getErrorMessage(err, 'No se pudo subir la imagen'))
    } finally {
      this.uploading.set(false)
      this.onTouched()
    }
  }

  onUrlInput(url: string): void {
    this.error.set(null)
    this.setValue(url.trim())
  }

  clear(): void {
    this.error.set(null)
    this.setValue('')
    this.onTouched()
  }

  private setValue(url: string): void {
    this.value.set(url)
    this.onChange(url)
  }
}
