import { describe, expect, it } from 'vitest'
import { uploadProductImage } from '@angular-app/features/products/domain/usecases/upload-product-image.use-case'
import { validateProductImage } from '@angular-app/features/products/domain/services/product-image-rules'

const tiendaId = '11111111-1111-4111-8111-111111111111'
const image = (type: string, size: number) => ({ type, size }) as unknown as File

describe('validateProductImage', () => {
  it('acepta los formatos permitidos hasta 5 MB', () => {
    expect(validateProductImage({ type: 'image/webp', size: 5 * 1024 * 1024 })).toBeNull()
  })

  it('rechaza formatos no permitidos y archivos grandes', () => {
    expect(validateProductImage({ type: 'image/gif', size: 10 })).toMatch(/Formato no permitido/)
    expect(validateProductImage({ type: 'image/png', size: 5 * 1024 * 1024 + 1 })).toMatch(/5 MB/)
  })
})

describe('uploadProductImage', () => {
  it('sube una imagen válida y devuelve su URL', async () => {
    let received: [unknown, string] | null = null
    const storage = { upload: async (file: File, tid: string) => { received = [file, tid]; return 'https://cdn/img.webp' } }
    const file = image('image/webp', 1000)
    const result = await uploadProductImage({ storage }, file, tiendaId)
    expect(result).toEqual({ ok: true, value: 'https://cdn/img.webp' })
    expect(received).toEqual([file, tiendaId])
  })

  it('no sube una imagen inválida ni con una tienda inválida', async () => {
    let called = false
    const storage = { upload: async () => { called = true; return '' } }
    expect((await uploadProductImage({ storage }, image('image/gif', 10), tiendaId)).ok).toBe(false)
    expect((await uploadProductImage({ storage }, image('image/png', 10), 'tienda-1')).ok).toBe(false)
    expect(called).toBe(false)
  })
})
