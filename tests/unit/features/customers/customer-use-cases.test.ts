import { describe, expect, it } from 'vitest'
import { createCustomer } from '@angular-app/features/customers/domain/usecases/create-customer.use-case'
import { updateCustomer } from '@angular-app/features/customers/domain/usecases/update-customer.use-case'
import { deleteCustomer } from '@angular-app/features/customers/domain/usecases/delete-customer.use-case'
import type { Cliente } from '@angular-app/features/customers/domain/entities/cliente.entity'

const tiendaId = 'tienda-1'
const now = new Date('2026-07-17T00:00:00.000Z')

const cliente: Cliente = {
  id: 'cliente-1',
  tiendaId,
  tipoDocumento: null,
  numeroDocumento: null,
  nombre: 'Ana Ramirez',
  email: null,
  telefono: '3012244006',
  celularNormalizado: '3012244006',
  activo: true,
  autorizaFidelizacion: true,
  aceptaMensajesPromocionales: false,
  createdAt: now,
  updatedAt: now,
}

describe('createCustomer', () => {
  it('crea el cliente cuando los datos son válidos', async () => {
    const repo = { create: async () => cliente }
    const result = await createCustomer({ repo, tiendaId }, { nombre: 'Ana Ramirez', telefono: '3012244006' })
    expect(result).toEqual({ ok: true, value: cliente })
  })

  it('rechaza nombre demasiado corto sin llamar al repositorio', async () => {
    let called = false
    const repo = { create: async () => { called = true; return cliente } }
    const result = await createCustomer({ repo, tiendaId }, { nombre: 'A' })
    expect(result.ok).toBe(false)
    expect(called).toBe(false)
  })

  it('exige celular colombiano válido si autoriza fidelización (RN-CL04)', async () => {
    const repo = { create: async () => cliente }
    const result = await createCustomer(
      { repo, tiendaId },
      { nombre: 'Ana Ramirez', autorizaFidelizacion: true, telefono: '123' },
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.message).toMatch(/celular colombiano válido/)
  })

  it('permite autorizar fidelización con celular válido', async () => {
    const repo = { create: async () => cliente }
    const result = await createCustomer(
      { repo, tiendaId },
      { nombre: 'Ana Ramirez', autorizaFidelizacion: true, telefono: '3012244006' },
    )
    expect(result.ok).toBe(true)
  })
})

describe('updateCustomer', () => {
  it('actualiza el cliente cuando los datos son válidos', async () => {
    const repo = { update: async () => cliente }
    const result = await updateCustomer({ repo, tiendaId }, cliente.id, { nombre: 'Ana Ramirez' })
    expect(result).toEqual({ ok: true, value: cliente })
  })

  it('rechaza datos inválidos sin llamar al repositorio', async () => {
    let called = false
    const repo = { update: async () => { called = true; return cliente } }
    const result = await updateCustomer({ repo, tiendaId }, cliente.id, { nombre: '' })
    expect(result.ok).toBe(false)
    expect(called).toBe(false)
  })
})

describe('deleteCustomer', () => {
  it('delega en el repositorio con los ids correctos', async () => {
    let received: [string, string] | null = null
    const repo = {
      delete: async (id: string, tid: string) => {
        received = [id, tid]
      },
    }
    await deleteCustomer({ repo }, cliente.id, tiendaId)
    expect(received).toEqual([cliente.id, tiendaId])
  })
})
