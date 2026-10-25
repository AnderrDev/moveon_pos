import { describe, expect, it } from 'vitest'
import { compactCount, compactMoney, niceTicks, shareLabel, sharePct } from '@/shared/lib/chart-scale'

describe('escalas de gráficas', () => {
  it('marca el eje con números redondos que cubren el máximo', () => {
    expect(niceTicks(1_180_000)).toEqual([0, 500_000, 1_000_000, 1_500_000])
    expect(niceTicks(9)).toEqual([0, 2.5, 5, 7.5, 10])
    expect(niceTicks(40)).toEqual([0, 10, 20, 30, 40])
    expect(niceTicks(0)).toEqual([0, 1])
  })

  it('escribe montos en corto', () => {
    expect(compactMoney(850)).toBe('$850')
    expect(compactMoney(12_400)).toBe('$12 mil')
    expect(compactMoney(1_234_000)).toBe('$1,2 M')
    expect(compactMoney(15_400_000)).toBe('$15 M')
    expect(compactMoney(-250_000)).toBe('−$250 mil')
    expect(compactCount(1_250)).toBe('1,3 mil')
    expect(compactCount(42)).toBe('42')
  })

  it('calcula la participación', () => {
    expect(sharePct(25, 200)).toBe(13)
    expect(sharePct(5, 0)).toBe(0)
    expect(shareLabel(201_000, 80_450_000)).toBe('<1')
    expect(shareLabel(0, 100)).toBe('0')
    expect(shareLabel(50, 100)).toBe('50')
  })
})
