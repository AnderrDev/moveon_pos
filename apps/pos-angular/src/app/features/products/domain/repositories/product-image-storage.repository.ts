/**
 * Contrato de almacenamiento de imágenes de producto (patrón Adapter,
 * ADR 0015 §6.5). Abstract class para servir de token de DI sin importar
 * Angular (ADR 0015 §6.1). La implementación (Supabase Storage) vive en
 * `data/datasources/product-image-storage.service.ts`.
 */
export abstract class ProductImageStorage {
  /** Valida el archivo antes de subir. Devuelve un mensaje de error o null si es válido. */
  abstract validate(file: File): string | null

  /** Sube el archivo al almacenamiento de la tienda y devuelve la URL pública. */
  abstract upload(file: File, tiendaId: string): Promise<string>

  /**
   * Elimina del almacenamiento una imagen a partir de su URL pública.
   * Ignora URLs externas (imágenes cargadas por migración desde CDNs de terceros).
   */
  abstract removeByUrl(url: string): Promise<void>
}
