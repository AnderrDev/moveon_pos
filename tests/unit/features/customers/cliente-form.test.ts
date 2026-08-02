import { describe, expect, it } from 'vitest'
import {
  clienteFormSchema,
  createClienteFormDefaults,
} from '@angular-app/features/customers/presentation/forms/cliente-form.factory'
import { clienteFormMapper } from '@angular-app/features/customers/presentation/forms/cliente-form.mapper'
import type { Cliente } from '@angular-app/features/customers/domain/entities/cliente.entity'

const tiendaId = '11111111-1111-4111-8111-111111111111'
const now = new Date('2026-07-21T00:00:00.000Z')

const cliente: Cliente = {
  id: 'cliente-1',
  tiendaId,
  tipoDocumento: 'CC',
  numeroDocumento: '1023456789',
  nombre: 'María Rodríguez',
  email: 'maria@example.com',
  telefono: '3001234567',
  celularNormalizado: '3001234567',
  activo: true,
  autorizaFidelizacion: true,
  aceptaMensajesPromocionales: true,
  createdAt: now,
  updatedAt: now,
}

describe('clienteFormSchema', () => {
  const valid = {
    nombre: 'María Rodríguez',
    tipoDocumento: 'CC',
    numeroDocumento: '1023456789',
    email: 'maria@example.com',
    telefono: '3001234567',
    autorizaFidelizacion: false,
    aceptaMensajesPromocionales: false,
  }

  it('acepta un cliente con datos completos', () => {
    expect(clienteFormSchema.safeParse(valid).success).toBe(true)
  })

  it('acepta un cliente mínimo con solo nombre', () => {
    expect(
      clienteFormSchema.safeParse({ ...createClienteFormDefaults(), nombre: 'María' }).success,
    ).toBe(true)
  })

  it('rechaza nombre demasiado corto o demasiado largo', () => {
    expect(clienteFormSchema.safeParse({ ...valid, nombre: 'M' }).success).toBe(false)
    expect(clienteFormSchema.safeParse({ ...valid, nombre: 'x'.repeat(101) }).success).toBe(false)
  })

  it('rechaza email inválido pero acepta email vacío', () => {
    expect(clienteFormSchema.safeParse({ ...valid, email: 'no-es-email' }).success).toBe(false)
    expect(clienteFormSchema.safeParse({ ...valid, email: '' }).success).toBe(true)
  })

  it('RN-CL04/RN-CL06: exige celular colombiano válido si autoriza fidelización', () => {
    const sinCelular = clienteFormSchema.safeParse({
      ...valid,
      autorizaFidelizacion: true,
      telefono: '',
    })
    expect(sinCelular.success).toBe(false)
    if (!sinCelular.success) {
      expect(sinCelular.error.issues[0]?.path).toEqual(['telefono'])
    }

    const fijo = clienteFormSchema.safeParse({
      ...valid,
      autorizaFidelizacion: true,
      telefono: '6015550000',
    })
    expect(fijo.success).toBe(false)
  })

  it('acepta fidelización con celular en formato +57 con espacios', () => {
    expect(
      clienteFormSchema.safeParse({
        ...valid,
        autorizaFidelizacion: true,
        telefono: '+57 300 123 4567',
      }).success,
    ).toBe(true)
  })

  it('no exige celular cuando no autoriza fidelización', () => {
    expect(
      clienteFormSchema.safeParse({ ...valid, autorizaFidelizacion: false, telefono: '' }).success,
    ).toBe(true)
  })
})

describe('createClienteFormDefaults', () => {
  it('devuelve valores vacíos con fidelización desactivada', () => {
    expect(createClienteFormDefaults()).toEqual({
      nombre: '',
      tipoDocumento: '',
      numeroDocumento: '',
      email: '',
      telefono: '',
      autorizaFidelizacion: false,
      aceptaMensajesPromocionales: false,
    })
  })

  it('permite sobreescribir todos los valores iniciales', () => {
    const overrides = {
      nombre: 'María',
      tipoDocumento: 'CC',
      numeroDocumento: '1023456789',
      email: 'maria@example.com',
      telefono: '3001234567',
      autorizaFidelizacion: true,
      aceptaMensajesPromocionales: true,
    }
    expect(createClienteFormDefaults(overrides)).toEqual(overrides)
  })
})

describe('clienteFormMapper.toFormValue', () => {
  it('convierte el cliente a valores de formulario', () => {
    expect(clienteFormMapper.toFormValue(cliente)).toEqual({
      nombre: 'María Rodríguez',
      tipoDocumento: 'CC',
      numeroDocumento: '1023456789',
      email: 'maria@example.com',
      telefono: '3001234567',
      autorizaFidelizacion: true,
      aceptaMensajesPromocionales: true,
    })
  })

  it('usa cadenas vacías para campos null', () => {
    expect(
      clienteFormMapper.toFormValue({
        ...cliente,
        tipoDocumento: null,
        numeroDocumento: null,
        email: null,
        telefono: null,
        autorizaFidelizacion: false,
        aceptaMensajesPromocionales: false,
      }),
    ).toEqual({
      nombre: 'María Rodríguez',
      tipoDocumento: '',
      numeroDocumento: '',
      email: '',
      telefono: '',
      autorizaFidelizacion: false,
      aceptaMensajesPromocionales: false,
    })
  })

  it('devuelve defaults cuando no hay cliente (modo creación)', () => {
    expect(clienteFormMapper.toFormValue(null)).toEqual(createClienteFormDefaults())
    expect(clienteFormMapper.toFormValue()).toEqual(createClienteFormDefaults())
  })
})

describe('clienteFormMapper.toPayload', () => {
  it('limpia strings y conserva los flags de fidelización', () => {
    expect(
      clienteFormMapper.toPayload({
        nombre: '  María Rodríguez  ',
        tipoDocumento: 'CC',
        numeroDocumento: ' 1023456789 ',
        email: ' maria@example.com ',
        telefono: ' 3001234567 ',
        autorizaFidelizacion: true,
        aceptaMensajesPromocionales: false,
      }),
    ).toEqual({
      nombre: 'María Rodríguez',
      tipoDocumento: 'CC',
      numeroDocumento: '1023456789',
      email: 'maria@example.com',
      telefono: '3001234567',
      autorizaFidelizacion: true,
      aceptaMensajesPromocionales: false,
    })
  })

  it('convierte campos vacíos u opcionales en undefined', () => {
    const payload = clienteFormMapper.toPayload({
      nombre: 'María',
      tipoDocumento: '',
      numeroDocumento: '   ',
      email: '',
      telefono: '  ',
      autorizaFidelizacion: false,
      aceptaMensajesPromocionales: false,
    })
    expect(payload.tipoDocumento).toBeUndefined()
    expect(payload.numeroDocumento).toBeUndefined()
    expect(payload.email).toBeUndefined()
    expect(payload.telefono).toBeUndefined()
  })

  it('trata email undefined como ausente', () => {
    const payload = clienteFormMapper.toPayload({
      nombre: 'María',
      tipoDocumento: '',
      numeroDocumento: '',
      email: undefined,
      telefono: '',
      autorizaFidelizacion: false,
      aceptaMensajesPromocionales: false,
    })
    expect(payload.email).toBeUndefined()
  })
})
