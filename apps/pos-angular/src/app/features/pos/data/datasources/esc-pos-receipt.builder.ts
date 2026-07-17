import type { Sale } from '@angular-app/features/sales/domain/entities/sale.entity'
import { getPaymentMethodLabel } from '@/shared/lib/payment-methods'

const ESC = '\x1b'
const GS = '\x1d'

export const ESC_POS_RECEIPT_COLUMNS = 32

export interface EscPosReceiptStore {
  titulo: string
  nit: string | null
  direccion: string | null
  ciudad: string | null
  telefono: string | null
  mensajePie: string | null
  mostrarNit: boolean
  mostrarDireccion: boolean
  mostrarTelefono: boolean
  mostrarIva: boolean
}

export interface EscPosReceiptCustomer {
  nombre: string
  tipoDocumento: string | null
  numeroDocumento: string | null
}

export interface EscPosReceiptInput {
  sale: Sale
  store: EscPosReceiptStore
  customer: EscPosReceiptCustomer | null
  cashierEmail: string | null
  change: number
}

const COMMAND = {
  initialize: `${ESC}@`,
  alignLeft: `${ESC}a\x00`,
  alignCenter: `${ESC}a\x01`,
  boldOn: `${ESC}E\x01`,
  boldOff: `${ESC}E\x00`,
  feedThreeLines: `${ESC}d\x03`,
  fullCut: `${GS}V\x00`,
} as const

export function buildEscPosReceipt(input: EscPosReceiptInput): string {
  const { sale, store } = input
  const taxSummary = summarizeTaxes(sale)
  const output: string[] = [COMMAND.initialize, COMMAND.alignCenter, COMMAND.boldOn]

  output.push(...lines(store.titulo), COMMAND.boldOff)
  if (store.mostrarNit && store.nit) output.push(...lines(`NIT ${store.nit}`))
  if (store.mostrarDireccion && store.direccion) {
    output.push(...lines([store.direccion, store.ciudad].filter(Boolean).join(' - ')))
  }
  if (store.mostrarTelefono && store.telefono) output.push(...lines(`Tel. ${store.telefono}`))

  if (sale.status === 'voided') {
    output.push(...lines('*** VENTA ANULADA ***'))
  }

  output.push(COMMAND.alignLeft)
  output.push(...pairLines('Venta:', sale.saleNumber))
  output.push(...pairLines('Fecha:', formatReceiptDate(sale.createdAt)))
  if (input.cashierEmail) output.push(...pairLines('Cajero:', input.cashierEmail))
  if (input.customer) {
    const document =
      input.customer.tipoDocumento && input.customer.numeroDocumento
        ? ` (${input.customer.tipoDocumento} ${input.customer.numeroDocumento})`
        : ''
    output.push(...pairLines('Cliente:', `${input.customer.nombre}${document}`))
  }

  output.push(divider())
  for (const item of sale.items) {
    output.push(COMMAND.boldOn, ...lines(item.productoNombre), COMMAND.boldOff)
    output.push(
      ...pairLines(
        `${formatQuantity(item.quantity)} x ${formatMoney(item.unitPrice)}`,
        formatMoney(item.total)
      )
    )
    if (store.mostrarIva && item.taxRate > 0) {
      output.push(...pairLines(`  IVA ${formatTaxRate(item.taxRate)}%`, formatMoney(itemTax(item))))
    }
  }

  output.push(divider())
  output.push(...pairLines('Subtotal', formatMoney(sale.subtotal)))
  if (sale.discountTotal > 0) {
    if (sale.itemDiscountTotal > 0) {
      output.push(...pairLines('Desc. productos', `-${formatMoney(sale.itemDiscountTotal)}`))
    }
    if (sale.globalDiscountTotal > 0) {
      output.push(...pairLines('Desc. global', `-${formatMoney(sale.globalDiscountTotal)}`))
    }
  }
  if (store.mostrarIva) {
    for (const tax of taxSummary) {
      output.push(...pairLines(`IVA ${formatTaxRate(tax.rate)}%`, formatMoney(tax.amount)))
    }
    if (taxSummary.length === 0 && sale.taxTotal > 0) {
      output.push(...pairLines('IVA', formatMoney(sale.taxTotal)))
    }
  }
  output.push(COMMAND.boldOn, ...pairLines('TOTAL', formatMoney(sale.total)), COMMAND.boldOff)

  output.push(divider(), COMMAND.boldOn, ...lines('PAGOS'), COMMAND.boldOff)
  for (const payment of sale.payments) {
    const label = payment.referencia
      ? `${getPaymentMethodLabel(payment.metodo)} ${payment.referencia}`
      : getPaymentMethodLabel(payment.metodo)
    output.push(...pairLines(label, formatMoney(payment.amount)))
  }
  if (input.change > 0) {
    output.push(COMMAND.boldOn, ...pairLines('Cambio', formatMoney(input.change)), COMMAND.boldOff)
  }

  if (store.mensajePie) {
    output.push(COMMAND.alignCenter, ...lines(store.mensajePie), COMMAND.alignLeft)
  }

  output.push(COMMAND.feedThreeLines, COMMAND.fullCut)
  return output.join('')
}

export function buildEscPosTestReceipt(store: EscPosReceiptStore): string {
  const output: string[] = [COMMAND.initialize, COMMAND.alignCenter, COMMAND.boldOn]

  output.push(...lines(store.titulo), COMMAND.boldOff)
  if (store.mostrarNit && store.nit) output.push(...lines(`NIT ${store.nit}`))
  if (store.mostrarDireccion && store.direccion) {
    output.push(...lines([store.direccion, store.ciudad].filter(Boolean).join(' - ')))
  }
  if (store.mostrarTelefono && store.telefono) output.push(...lines(`Tel. ${store.telefono}`))

  output.push(...lines('PRUEBA DE IMPRESION'), COMMAND.alignLeft, divider())
  output.push(...pairLines('Producto ejemplo', formatMoney(22_000)))
  if (store.mostrarIva) output.push(...pairLines('IVA 19%', formatMoney(4_180)))
  output.push(COMMAND.boldOn, ...pairLines('TOTAL', formatMoney(26_180)), COMMAND.boldOff)

  if (store.mensajePie) {
    output.push(COMMAND.alignCenter, ...lines(store.mensajePie), COMMAND.alignLeft)
  }

  output.push(COMMAND.feedThreeLines, COMMAND.fullCut)
  return output.join('')
}

function lines(value: string): string[] {
  return wrapText(value).map((line) => `${line}\n`)
}

function pairLines(leftValue: string, rightValue: string): string[] {
  const left = sanitizeText(leftValue)
  const right = sanitizeText(rightValue)
  const spaces = ESC_POS_RECEIPT_COLUMNS - left.length - right.length
  if (spaces >= 1) return [`${left}${' '.repeat(spaces)}${right}\n`]

  return [
    ...wrapText(left).map((line) => `${line}\n`),
    ...wrapText(right).map((line) => `${line.padStart(ESC_POS_RECEIPT_COLUMNS)}\n`),
  ]
}

function wrapText(value: string): string[] {
  const text = sanitizeText(value)
  if (!text) return []

  const result: string[] = []
  let current = ''
  for (const word of text.split(' ')) {
    if (word.length > ESC_POS_RECEIPT_COLUMNS) {
      if (current) result.push(current)
      for (let index = 0; index < word.length; index += ESC_POS_RECEIPT_COLUMNS) {
        result.push(word.slice(index, index + ESC_POS_RECEIPT_COLUMNS))
      }
      current = ''
      continue
    }

    const candidate = current ? `${current} ${word}` : word
    if (candidate.length <= ESC_POS_RECEIPT_COLUMNS) {
      current = candidate
    } else {
      result.push(current)
      current = word
    }
  }
  if (current) result.push(current)
  return result
}

function sanitizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u00d7]/g, 'x')
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .replace(/[\u00b7]/g, '-')
    .replace(/[^\x20-\x7e]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function divider(): string {
  return `${'-'.repeat(ESC_POS_RECEIPT_COLUMNS)}\n`
}

function formatMoney(value: number): string {
  return `$ ${Math.round(value).toLocaleString('es-CO')}`
}

function formatQuantity(value: number): string {
  return Number.isInteger(value) ? String(value) : String(value).replace('.', ',')
}

function summarizeTaxes(sale: Sale): { rate: number; amount: number }[] {
  const byRate = new Map<number, number>()
  for (const item of sale.items) {
    if (item.taxRate <= 0) continue
    byRate.set(item.taxRate, (byRate.get(item.taxRate) ?? 0) + itemTax(item))
  }
  return [...byRate.entries()]
    .map(([rate, amount]) => ({ rate, amount }))
    .filter((tax) => tax.amount > 0)
    .sort((left, right) => left.rate - right.rate)
}

function itemTax(item: Sale['items'][number]): number {
  if (item.taxAmount > 0) return item.taxAmount
  const taxableAmount = Math.max(0, item.unitPrice * item.quantity - item.discountAmount)
  return Math.round((taxableAmount * item.taxRate) / 100)
}

function formatTaxRate(value: number): string {
  return Number.isInteger(value) ? String(value) : String(value).replace('.', ',')
}

function formatReceiptDate(value: Date): string {
  return value.toLocaleString('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
