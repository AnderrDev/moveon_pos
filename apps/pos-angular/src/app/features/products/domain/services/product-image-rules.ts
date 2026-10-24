/**
 * Reglas de la imagen de un producto (TS puro). Antes vivían en el adaptador
 * de Supabase Storage; son de negocio, así que las aplica el use-case
 * `uploadProductImage` antes de subir.
 */
export const PRODUCT_IMAGE_MAX_BYTES = 5 * 1024 * 1024 // 5 MiB

export const PRODUCT_IMAGE_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'] as const

/** Devuelve el motivo del rechazo, o `null` si la imagen es válida. */
export function validateProductImage(file: { type: string; size: number }): string | null {
  if (!(PRODUCT_IMAGE_ALLOWED_TYPES as readonly string[]).includes(file.type)) {
    return 'Formato no permitido. Usa JPG, PNG, WebP o AVIF.'
  }
  if (file.size > PRODUCT_IMAGE_MAX_BYTES) {
    return 'La imagen supera el tamaño máximo de 5 MB.'
  }
  return null
}
