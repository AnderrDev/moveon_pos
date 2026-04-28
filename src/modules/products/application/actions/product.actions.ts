'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/infrastructure/supabase/server'
import { getAuthContext } from '@/shared/lib/auth-context'
import { createProductSchema, updateProductSchema } from '../dtos/product.dto'
import type { CreateProductDto, UpdateProductDto } from '../dtos/product.dto'

// Nota: @supabase/ssr v0.5 no resuelve correctamente los tipos Insert/Update
// a través de createServerClient. Los datos están validados con Zod antes de
// llegar aquí, y la seguridad se garantiza con RLS en Supabase.
/* eslint-disable @typescript-eslint/no-explicit-any */

export type ProductActionState = {
  status?: 'idle' | 'success' | 'error'
  message?: string
  error: string | null
}
const OK = (message: string): ProductActionState => ({ status: 'success', message, error: null })
const FAIL = (error: string): ProductActionState => ({ status: 'error', error })

// ── Crear ─────────────────────────────────────────────────────────────────────

export async function createProductAction(
  _prev: ProductActionState,
  formData: FormData,
): Promise<ProductActionState> {
  const auth = await getAuthContext()
  if (!auth) return FAIL('No autenticado')
  if (auth.rol !== 'admin') return FAIL('Solo el admin puede crear productos')

  const raw: CreateProductDto = {
    tiendaId:     auth.tiendaId,
    nombre:       String(formData.get('nombre') ?? ''),
    sku:          (formData.get('sku') as string) || undefined,
    codigoBarras: (formData.get('codigoBarras') as string) || undefined,
    categoriaId:  (formData.get('categoriaId') as string) || undefined,
    tipo:         formData.get('tipo') as CreateProductDto['tipo'],
    unidad:       String(formData.get('unidad') ?? 'und'),
    precioVenta:  Number(formData.get('precioVenta')),
    costo:        formData.get('costo') ? Number(formData.get('costo')) : undefined,
    ivaTasa:      Number(formData.get('ivaTasa')) as CreateProductDto['ivaTasa'],
    stockMinimo:  Number(formData.get('stockMinimo') ?? 0),
    isActive:     formData.get('isActive') !== 'false',
  }

  const parsed = createProductSchema.safeParse(raw)
  if (!parsed.success) return FAIL(parsed.error.errors[0]?.message ?? 'Datos inválidos')

  const supabase = await createClient()
  const db = supabase as any

  const { data: inserted, error } = await db
    .from('productos')
    .insert({
      tienda_id:     parsed.data.tiendaId,
      nombre:        parsed.data.nombre,
      sku:           parsed.data.sku ?? null,
      codigo_barras: parsed.data.codigoBarras ?? null,
      categoria_id:  parsed.data.categoriaId ?? null,
      tipo:          parsed.data.tipo,
      unidad:        parsed.data.unidad,
      precio_venta:  parsed.data.precioVenta,
      costo:         parsed.data.costo ?? null,
      iva_tasa:      parsed.data.ivaTasa,
      stock_minimo:  parsed.data.stockMinimo,
      is_active:     parsed.data.isActive,
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') {
      if (error.message.includes('sku'))           return FAIL('El SKU ya existe en esta tienda')
      if (error.message.includes('codigo_barras')) return FAIL('El código de barras ya existe en esta tienda')
    }
    return FAIL('No se pudo crear el producto')
  }

  // RN-P02: Auditar precio al crear
  if (inserted?.id) {
    await db.from('audit_logs').insert({
      tienda_id:   auth.tiendaId,
      user_id:     auth.userId,
      entity_type: 'producto',
      entity_id:   inserted.id,
      action:      'product.price_changed',
      metadata:    { precio_anterior: null, precio_nuevo: parsed.data.precioVenta },
    })
  }

  revalidatePath('/productos')
  return OK('Producto creado correctamente')
}

// ── Actualizar ────────────────────────────────────────────────────────────────

export async function updateProductAction(
  id: string,
  precioAnterior: number,
  _prev: ProductActionState,
  formData: FormData,
): Promise<ProductActionState> {
  const auth = await getAuthContext()
  if (!auth) return FAIL('No autenticado')
  if (auth.rol !== 'admin') return FAIL('Solo el admin puede actualizar productos')

  const raw: UpdateProductDto = {
    nombre:       String(formData.get('nombre') ?? ''),
    sku:          (formData.get('sku') as string) || undefined,
    codigoBarras: (formData.get('codigoBarras') as string) || undefined,
    categoriaId:  (formData.get('categoriaId') as string) || undefined,
    tipo:         formData.get('tipo') as UpdateProductDto['tipo'],
    unidad:       String(formData.get('unidad') ?? 'und'),
    precioVenta:  Number(formData.get('precioVenta')),
    costo:        formData.get('costo') ? Number(formData.get('costo')) : undefined,
    ivaTasa:      Number(formData.get('ivaTasa')) as UpdateProductDto['ivaTasa'],
    stockMinimo:  Number(formData.get('stockMinimo') ?? 0),
    isActive:     formData.get('isActive') !== 'false',
  }

  const parsed = updateProductSchema.safeParse(raw)
  if (!parsed.success) return FAIL(parsed.error.errors[0]?.message ?? 'Datos inválidos')

  const supabase = await createClient()
  const db = supabase as any

  const { error } = await db
    .from('productos')
    .update({
      nombre:        parsed.data.nombre,
      sku:           parsed.data.sku ?? null,
      codigo_barras: parsed.data.codigoBarras ?? null,
      categoria_id:  parsed.data.categoriaId ?? null,
      tipo:          parsed.data.tipo,
      unidad:        parsed.data.unidad,
      precio_venta:  parsed.data.precioVenta,
      costo:         parsed.data.costo ?? null,
      iva_tasa:      parsed.data.ivaTasa,
      stock_minimo:  parsed.data.stockMinimo,
      is_active:     parsed.data.isActive,
    })
    .eq('id', id)
    .eq('tienda_id', auth.tiendaId)

  if (error) {
    if (error.code === '23505') {
      if (error.message.includes('sku'))           return FAIL('El SKU ya existe en esta tienda')
      if (error.message.includes('codigo_barras')) return FAIL('El código de barras ya existe en esta tienda')
    }
    return FAIL('No se pudo actualizar el producto')
  }

  // RN-P02: Auditar cambio de precio
  if (parsed.data.precioVenta !== undefined && parsed.data.precioVenta !== precioAnterior) {
    await db.from('audit_logs').insert({
      tienda_id:   auth.tiendaId,
      user_id:     auth.userId,
      entity_type: 'producto',
      entity_id:   id,
      action:      'product.price_changed',
      metadata:    { precio_anterior: precioAnterior, precio_nuevo: parsed.data.precioVenta },
    })
  }

  revalidatePath('/productos')
  return OK('Producto actualizado correctamente')
}

// ── Activar / Desactivar ──────────────────────────────────────────────────────

export async function toggleProductActiveAction(
  id: string,
  isActive: boolean,
): Promise<ProductActionState> {
  const auth = await getAuthContext()
  if (!auth) return FAIL('No autenticado')
  if (auth.rol !== 'admin') return FAIL('Solo el admin puede activar o desactivar productos')

  const supabase = await createClient()
  const { error } = await (supabase as any)
    .from('productos')
    .update({ is_active: isActive })
    .eq('id', id)
    .eq('tienda_id', auth.tiendaId)

  if (error) return FAIL('No se pudo actualizar el producto')

  revalidatePath('/productos')
  return OK(isActive ? 'Producto activado' : 'Producto desactivado')
}
