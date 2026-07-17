import { describe, expect, it } from 'vitest'
import {
  isoDate,
  addDays,
  weekStart,
  monthStart,
  monthEnd,
  prevMonthStart,
  resolvePreset,
} from '@angular-app/features/reports/presentation/services/report-period.helpers'

// ─── isoDate ──────────────────────────────────────────────────────────────

describe('isoDate', () => {
  it('formatea una fecha a YYYY-MM-DD en la zona horaria indicada', () => {
    const date = new Date('2026-06-15T12:00:00Z')
    expect(isoDate(date, 'America/Bogota')).toBe('2026-06-15')
  })

  it('America/Bogota y UTC difieren cerca de la medianoche local (frontera de día)', () => {
    // 2026-06-16T02:00:00Z = 2026-06-15 21:00 en Bogotá (UTC-5) — mismo día UTC,
    // pero distinto si nos acercamos a la medianoche UTC.
    const nearMidnightUtc = new Date('2026-06-16T03:00:00Z')
    const bogota = isoDate(nearMidnightUtc, 'America/Bogota')
    const utc = isoDate(nearMidnightUtc, 'UTC')

    expect(utc).toBe('2026-06-16')
    expect(bogota).toBe('2026-06-15')
    expect(bogota).not.toBe(utc)
  })
})

// ─── addDays ──────────────────────────────────────────────────────────────

describe('addDays', () => {
  it('suma días a una fecha ISO', () => {
    expect(addDays('2026-06-15', 5)).toBe('2026-06-20')
  })

  it('resta días con un valor negativo', () => {
    expect(addDays('2026-06-15', -5)).toBe('2026-06-10')
  })

  it('cruza el límite de mes correctamente', () => {
    expect(addDays('2026-06-29', 3)).toBe('2026-07-02')
  })
})

// ─── weekStart ────────────────────────────────────────────────────────────

describe('weekStart', () => {
  it('devuelve el mismo lunes si la fecha ya es lunes', () => {
    // 2026-06-15 es lunes
    expect(weekStart('2026-06-15')).toBe('2026-06-15')
  })

  it('devuelve el lunes de la semana para un día entre semana', () => {
    // 2026-06-18 es jueves de esa misma semana
    expect(weekStart('2026-06-18')).toBe('2026-06-15')
  })

  it('caso borde domingo: mapea al lunes ANTERIOR (no al siguiente)', () => {
    // 2026-06-21 es domingo; el lunes de su semana ISO es 2026-06-15
    expect(weekStart('2026-06-21')).toBe('2026-06-15')
  })
})

// ─── monthStart / monthEnd ──────────────────────────────────────────────────

describe('monthStart', () => {
  it('devuelve el primer día del mes', () => {
    expect(monthStart('2026-06-15')).toBe('2026-06-01')
  })
})

describe('monthEnd', () => {
  it('mes de 31 días', () => {
    expect(monthEnd('2026-07-10')).toBe('2026-07-31')
  })

  it('mes de 30 días', () => {
    expect(monthEnd('2026-06-10')).toBe('2026-06-30')
  })

  it('febrero no bisiesto (2026)', () => {
    expect(monthEnd('2026-02-10')).toBe('2026-02-28')
  })

  it('febrero bisiesto (2028)', () => {
    expect(monthEnd('2028-02-10')).toBe('2028-02-29')
  })
})

// ─── prevMonthStart ───────────────────────────────────────────────────────

describe('prevMonthStart', () => {
  it('devuelve el primer día del mes anterior', () => {
    expect(prevMonthStart('2026-06-15')).toBe('2026-05-01')
  })

  it('caso borde enero: retrocede a diciembre del año anterior', () => {
    expect(prevMonthStart('2026-01-10')).toBe('2025-12-01')
  })
})

// ─── resolvePreset ──────────────────────────────────────────────────────────

describe('resolvePreset', () => {
  const today = '2026-06-18' // jueves

  it('today: from y to son el mismo día', () => {
    expect(resolvePreset(today, 'today')).toEqual({ from: today, to: today })
  })

  it('week: from es el lunes de la semana, to es today', () => {
    expect(resolvePreset(today, 'week')).toEqual({ from: '2026-06-15', to: today })
  })

  it('month: from es el primer día del mes, to es today', () => {
    expect(resolvePreset(today, 'month')).toEqual({ from: '2026-06-01', to: today })
  })

  it('prev-month: from es el primer día del mes anterior, to es el último día de ese mes', () => {
    expect(resolvePreset(today, 'prev-month')).toEqual({ from: '2026-05-01', to: '2026-05-31' })
  })

  it('prev-month en enero retrocede al diciembre anterior', () => {
    expect(resolvePreset('2026-01-15', 'prev-month')).toEqual({
      from: '2025-12-01',
      to: '2025-12-31',
    })
  })
})
