import { describe, expect, it } from 'vitest'
import { PosCartStore } from '@angular-app/features/pos/presentation/services/pos-cart.store'
import type { PosProduct } from '@angular-app/features/pos/presentation/services/pos.types'

const CH_PLUS = { id: 'opt-chp', grupo: 'Proteína', nombre: 'CH+', precioExtra: 0, esDefault: true }
const BIPRO = { id: 'opt-bipro', grupo: 'Proteína', nombre: 'Bipro', precioExtra: 2000, esDefault: false }

function batido(): PosProduct {
  return {
    id: 'batido-leche',
    nombre: 'BATIDO EN LECHE',
    sku: null,
    codigoBarras: null,
    precioVenta: 13_000,
    costo: null,
    ivaTasa: 0,
    categoriaId: null,
    paraQueSirve: null,
    recomendadoPara: null,
    tipo: 'prepared',
    participaFidelizacion: true,
    stockDisponible: null,
    components: [],
    options: [CH_PLUS, BIPRO],
  }
}

function toCartOption(option: typeof CH_PLUS) {
  return { id: option.id, nombre: option.nombre, precioExtra: option.precioExtra }
}

describe('PosCartStore.updateOption', () => {
  it('cambia la proteína de la línea y recalcula el precio', () => {
    const cart = new PosCartStore()
    cart.addItem(batido(), toCartOption(CH_PLUS))

    cart.updateOption('batido-leche:opt-chp', toCartOption(BIPRO), 13_000)

    const items = cart.items()
    expect(items).toHaveLength(1)
    expect(items[0].key).toBe('batido-leche:opt-bipro')
    expect(items[0].option?.nombre).toBe('Bipro')
    expect(items[0].unitPrice).toBe(15_000)
    expect(cart.totals().total).toBe(15_000)
  })

  it('fusiona la línea cuando ya existe otra con la misma proteína', () => {
    const cart = new PosCartStore()
    cart.addItem(batido(), toCartOption(CH_PLUS))
    cart.addItem(batido(), toCartOption(BIPRO))
    cart.addItem(batido(), toCartOption(BIPRO))

    cart.updateOption('batido-leche:opt-chp', toCartOption(BIPRO), 13_000)

    const items = cart.items()
    expect(items).toHaveLength(1)
    expect(items[0].key).toBe('batido-leche:opt-bipro')
    expect(items[0].quantity).toBe(3)
    expect(cart.totals().total).toBe(45_000)
  })

  it('recorta el descuento manual al precio nuevo cuando baja de precio', () => {
    const cart = new PosCartStore()
    cart.addItem(batido(), toCartOption(BIPRO))
    cart.updateDiscount('batido-leche:opt-bipro', 15_000)
    expect(cart.totals().total).toBe(0)

    cart.updateOption('batido-leche:opt-bipro', toCartOption(CH_PLUS), 13_000)

    const item = cart.items()[0]
    expect(item.unitPrice).toBe(13_000)
    expect(item.discountAmount).toBe(13_000)
    expect(cart.totals().total).toBe(0)
  })

  it('el canje MOVE ON Club sigue a la línea que cambió de proteína', () => {
    const cart = new PosCartStore()
    cart.addItem(batido(), toCartOption(CH_PLUS))
    cart.setCliente('cliente-1', 'Ana')
    cart.applyLoyaltyReward('reward-1', 13_000, cart.items()[0])
    expect(cart.loyaltyRedemption()?.itemKey).toBe('batido-leche:opt-chp')

    cart.updateOption('batido-leche:opt-chp', toCartOption(BIPRO), 13_000)

    expect(cart.loyaltyRedemption()?.itemKey).toBe('batido-leche:opt-bipro')
    // El batido con Bipro cuesta más que la recompensa: el cliente paga la
    // diferencia (RN-LF08).
    expect(cart.totals().total).toBe(2000)
  })

  it('ignora el cambio si la opción es la misma', () => {
    const cart = new PosCartStore()
    cart.addItem(batido(), toCartOption(CH_PLUS))

    cart.updateOption('batido-leche:opt-chp', toCartOption(CH_PLUS), 13_000)

    expect(cart.items()).toHaveLength(1)
    expect(cart.items()[0].key).toBe('batido-leche:opt-chp')
  })
})

describe('PosCartStore.addItem con opción por defecto', () => {
  it('acumula unidades del mismo batido con la misma proteína', () => {
    const cart = new PosCartStore()
    cart.addItem(batido(), toCartOption(CH_PLUS))
    cart.addItem(batido(), toCartOption(CH_PLUS))

    expect(cart.items()).toHaveLength(1)
    expect(cart.items()[0].quantity).toBe(2)
    expect(cart.totals().total).toBe(26_000)
  })

  it('separa en dos líneas el mismo batido con proteínas distintas', () => {
    const cart = new PosCartStore()
    cart.addItem(batido(), toCartOption(CH_PLUS))
    cart.addItem(batido(), toCartOption(BIPRO))

    expect(cart.items()).toHaveLength(2)
    expect(cart.totals().total).toBe(28_000)
  })
})
