import { inject, Injectable } from '@angular/core'
import { SupabaseClientService } from '@angular-app/core/supabase/supabase-client.service'
import { ProductImageStorage } from '@angular-app/features/products/domain/repositories/product-image-storage.repository'

const BUCKET = 'product-images'

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
}

/**
 * Sube y elimina imágenes de producto en el bucket público `product-images`.
 * La UI recibe la URL pública resultante y la guarda en `productos.image_url`.
 * Las reglas de formato y tamaño las valida el use-case `uploadProductImage`.
 */
@Injectable({ providedIn: 'root' })
export class ProductImageStorageService extends ProductImageStorage {
  private readonly supabaseClient = inject(SupabaseClientService)

  /**
   * Sube el archivo a `product-images/<tiendaId>/<uuid>.<ext>` y devuelve la URL pública.
   */
  async upload(file: File, tiendaId: string): Promise<string> {
    const ext = EXT_BY_MIME[file.type] ?? 'bin'
    const path = `${tiendaId}/${crypto.randomUUID()}.${ext}`

    const { error } = await this.supabaseClient.supabase.storage
      .from(BUCKET)
      .upload(path, file, { cacheControl: '31536000', upsert: false, contentType: file.type })

    if (error) throw new Error(error.message)

    const { data } = this.supabaseClient.supabase.storage.from(BUCKET).getPublicUrl(path)
    return data.publicUrl
  }

  /**
   * Elimina de Storage una imagen subida a este bucket a partir de su URL pública.
   * Ignora URLs externas (imágenes cargadas por migración desde CDNs de terceros).
   */
  async removeByUrl(url: string): Promise<void> {
    const path = this.pathFromPublicUrl(url)
    if (!path) return
    await this.supabaseClient.supabase.storage.from(BUCKET).remove([path])
  }

  private pathFromPublicUrl(url: string): string | null {
    const marker = `/storage/v1/object/public/${BUCKET}/`
    const idx = url.indexOf(marker)
    if (idx === -1) return null
    return decodeURIComponent(url.slice(idx + marker.length).split('?')[0])
  }
}
