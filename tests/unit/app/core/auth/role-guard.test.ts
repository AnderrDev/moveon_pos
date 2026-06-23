import { describe, it, expect } from 'vitest'
// Pure decision function extracted to role-policy.ts so it runs in node without TestBed.
import {
  canActivateForRole,
  canCorrectCashSessionOpening,
  canCorrectPayment,
  canViewClosedSessions,
} from '../../../../../apps/pos-angular/src/app/core/auth/role-policy'

describe('canActivateForRole', () => {
  it('permite admin cuando la ruta admite admin', () => {
    expect(canActivateForRole('admin', ['admin'])).toBe(true)
  })

  it('niega cajero cuando la ruta solo admite admin', () => {
    expect(canActivateForRole('cajero', ['admin'])).toBe(false)
  })

  it('niega contexto sin rol (null)', () => {
    expect(canActivateForRole(null, ['admin'])).toBe(false)
  })

  it('permite ambos roles cuando la lista los incluye', () => {
    expect(canActivateForRole('admin', ['admin', 'cajero'])).toBe(true)
    expect(canActivateForRole('cajero', ['admin', 'cajero'])).toBe(true)
  })

  it('niega cuando la lista de roles permitidos está vacía', () => {
    expect(canActivateForRole('admin', [])).toBe(false)
  })
})

describe('canCorrectPayment', () => {
  it('permite corregir pago a admin', () => {
    expect(canCorrectPayment('admin')).toBe(true)
  })

  it('niega corregir pago a cajero', () => {
    expect(canCorrectPayment('cajero')).toBe(false)
  })

  it('niega corregir pago a contexto sin rol (null)', () => {
    expect(canCorrectPayment(null)).toBe(false)
  })
})

describe('canCorrectCashSessionOpening', () => {
  it('permite corregir apertura a admin', () => {
    expect(canCorrectCashSessionOpening('admin')).toBe(true)
  })

  it('permite corregir apertura a cajero (caja compartida, no admin-only)', () => {
    expect(canCorrectCashSessionOpening('cajero')).toBe(true)
  })

  it('niega corregir apertura a contexto sin rol (null)', () => {
    expect(canCorrectCashSessionOpening(null)).toBe(false)
  })
})

describe('canViewClosedSessions', () => {
  it('permite ver turnos cerrados a admin', () => {
    expect(canViewClosedSessions('admin')).toBe(true)
  })

  it('niega ver turnos cerrados a cajero', () => {
    expect(canViewClosedSessions('cajero')).toBe(false)
  })

  it('niega ver turnos cerrados a contexto sin rol (null)', () => {
    expect(canViewClosedSessions(null)).toBe(false)
  })
})
