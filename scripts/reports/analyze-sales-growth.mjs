#!/usr/bin/env node

/**
 * Read-only commercial analysis over Supabase REST.
 *
 * Usage: node scripts/reports/analyze-sales-growth.mjs
 * Secrets are loaded from .env.local and are never printed.
 */

import { readFileSync } from 'node:fs'

const TIME_ZONE = 'America/Bogota'
const PAGE_SIZE = 1000

function loadEnv(path) {
  return Object.fromEntries(
    readFileSync(path, 'utf8')
      .split(/\r?\n/)
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const separator = line.indexOf('=')
        return [line.slice(0, separator), line.slice(separator + 1)]
      })
  )
}

const env = loadEnv('.env.local')
const supabaseUrl = env.SUPABASE_URL
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
}

const headers = {
  apikey: serviceRoleKey,
  Authorization: `Bearer ${serviceRoleKey}`,
}

async function fetchTable(table, select = '*') {
  const rows = []

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const url = new URL(`/rest/v1/${table}`, supabaseUrl)
    url.searchParams.set('select', select)
    url.searchParams.set('limit', String(PAGE_SIZE))
    url.searchParams.set('offset', String(offset))

    const response = await fetch(url, { headers })
    const body = await response.json()

    if (!response.ok) {
      throw new Error(`${table}: ${response.status} ${JSON.stringify(body)}`)
    }

    rows.push(...body)
    if (body.length < PAGE_SIZE) break
  }

  return rows
}

const number = (value) => Number(value ?? 0)
const round = (value, digits = 0) => Number(value.toFixed(digits))
const percent = (numerator, denominator) =>
  denominator === 0 ? null : round((numerator / denominator) * 100, 1)
const growth = (current, previous) =>
  previous === 0 ? null : round(((current - previous) / previous) * 100, 1)
const sumBy = (rows, selector) => rows.reduce((total, row) => total + selector(row), 0)

const localDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})
const localHourFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: TIME_ZONE,
  hour: '2-digit',
  hour12: false,
})
const localTimeFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})
const weekdayFormatter = new Intl.DateTimeFormat('es-CO', {
  timeZone: TIME_ZONE,
  weekday: 'long',
})

function localDate(timestamp) {
  return localDateFormatter.format(new Date(timestamp))
}

function localHour(timestamp) {
  return Number(localHourFormatter.format(new Date(timestamp)).replace('24', '00'))
}

function localMinuteOfDay(timestamp) {
  const parts = Object.fromEntries(
    localTimeFormatter
      .formatToParts(new Date(timestamp))
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value])
  )
  const hour = Number(parts.hour.replace('24', '00'))
  return hour * 60 + Number(parts.minute)
}

function formatMinuteOfDay(value) {
  const hour = Math.floor(value / 60)
  const minute = value % 60
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

function median(values) {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2)
}

function dayNumber(date) {
  return Date.parse(`${date}T00:00:00Z`) / 86_400_000
}

function addDays(date, days) {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

function isoWeekStart(date) {
  const value = new Date(`${date}T00:00:00Z`)
  const daysSinceMonday = (value.getUTCDay() + 6) % 7
  value.setUTCDate(value.getUTCDate() - daysSinceMonday)
  return value.toISOString().slice(0, 10)
}

function summarizeSales(rows) {
  return {
    sales: rows.length,
    revenue: round(sumBy(rows, (sale) => number(sale.total))),
    averageTicket: rows.length ? round(sumBy(rows, (sale) => number(sale.total)) / rows.length) : 0,
  }
}

function groupSales(rows, keySelector) {
  const groups = new Map()
  for (const sale of rows) {
    const key = keySelector(sale)
    const group = groups.get(key) ?? []
    group.push(sale)
    groups.set(key, group)
  }
  return [...groups.entries()].map(([key, sales]) => ({ key, ...summarizeSales(sales) }))
}

const cutoff = new Date()
const today = localDate(cutoff)
const todayNumber = dayNumber(today)

const [
  sales,
  saleItems,
  payments,
  products,
  categories,
  customers,
  loyaltyAccounts,
  loyaltyTransactions,
  loyaltyRewards,
  inventoryMovements,
  cashSessions,
] = await Promise.all([
  fetchTable('sales'),
  fetchTable('sale_items'),
  fetchTable('payments'),
  fetchTable('productos'),
  fetchTable('categorias'),
  fetchTable('clientes'),
  fetchTable('loyalty_accounts'),
  fetchTable('loyalty_transactions'),
  fetchTable('loyalty_rewards'),
  fetchTable('inventory_movements'),
  fetchTable('cash_sessions'),
])

const salesAtCutoff = sales.filter((sale) => new Date(sale.created_at) <= cutoff)
const completedSales = salesAtCutoff.filter((sale) => sale.status === 'completed')
const voidedSales = salesAtCutoff.filter((sale) => sale.status === 'voided')
const completedIds = new Set(completedSales.map((sale) => sale.id))
const completedItems = saleItems.filter((item) => completedIds.has(item.sale_id))
const completedPayments = payments.filter((payment) => completedIds.has(payment.sale_id))
const fullDaySales = completedSales.filter((sale) => localDate(sale.created_at) < today)
const todaySales = completedSales.filter((sale) => localDate(sale.created_at) === today)
const cashSessionById = new Map(cashSessions.map((session) => [session.id, session]))

const productById = new Map(products.map((product) => [product.id, product]))
const categoryById = new Map(categories.map((category) => [category.id, category.nombre]))
const itemsBySale = new Map()
for (const item of completedItems) {
  const items = itemsBySale.get(item.sale_id) ?? []
  items.push(item)
  itemsBySale.set(item.sale_id, items)
}

function salesWindow(startDaysAgo, endDaysAgo) {
  return fullDaySales.filter((sale) => {
    const dateNumber = dayNumber(localDate(sale.created_at))
    return dateNumber >= todayNumber - startDaysAgo && dateNumber < todayNumber - endDaysAgo
  })
}

const recent14 = salesWindow(14, 0)
const previous14 = salesWindow(28, 14)
const recent28 = salesWindow(28, 0)
const previous28 = salesWindow(56, 28)

function compareWindows(current, previous, days) {
  const currentSummary = summarizeSales(current)
  const previousSummary = summarizeSales(previous)
  return {
    days,
    current: currentSummary,
    previous: previousSummary,
    growth: {
      salesPct: growth(currentSummary.sales, previousSummary.sales),
      revenuePct: growth(currentSummary.revenue, previousSummary.revenue),
      averageTicketPct: growth(currentSummary.averageTicket, previousSummary.averageTicket),
    },
    revenuePerDay: {
      current: round(currentSummary.revenue / days),
      previous: round(previousSummary.revenue / days),
    },
  }
}

const daily = groupSales(fullDaySales, (sale) => localDate(sale.created_at)).sort((a, b) =>
  a.key.localeCompare(b.key)
)

const firstFullDate = fullDaySales.length
  ? fullDaySales.map((sale) => localDate(sale.created_at)).sort()[0]
  : today
const weekly = groupSales(fullDaySales, (sale) => isoWeekStart(localDate(sale.created_at)))
  .map((row) => {
    const weekEnd = addDays(row.key, 6)
    return {
      weekStart: row.key,
      weekEnd,
      sales: row.sales,
      revenue: row.revenue,
      averageTicket: row.averageTicket,
      revenuePerDay: round(row.revenue / 7),
      isComplete:
        dayNumber(row.key) >= dayNumber(firstFullDate) && dayNumber(weekEnd) < todayNumber,
    }
  })
  .sort((a, b) => a.weekStart.localeCompare(b.weekStart))
const completeWeeks = weekly.filter((week) => week.isComplete)

const weekdays = groupSales(fullDaySales, (sale) =>
  weekdayFormatter.format(new Date(sale.created_at))
)
  .map((row) => {
    const activeDates = new Set(
      fullDaySales
        .filter((sale) => weekdayFormatter.format(new Date(sale.created_at)) === row.key)
        .map((sale) => localDate(sale.created_at))
    ).size
    return {
      weekday: row.key,
      sales: row.sales,
      revenue: row.revenue,
      averageTicket: row.averageTicket,
      observedDays: activeDates,
      revenuePerObservedDay: activeDates ? round(row.revenue / activeDates) : 0,
      salesPerObservedDay: activeDates ? round(row.sales / activeDates, 1) : 0,
    }
  })
  .sort((a, b) => b.revenuePerObservedDay - a.revenuePerObservedDay)

const hours = groupSales(fullDaySales, (sale) => localHour(sale.created_at))
  .map((row) => ({
    hour: row.key,
    sales: row.sales,
    revenue: row.revenue,
    averageTicket: row.averageTicket,
    revenueSharePct: percent(
      row.revenue,
      sumBy(fullDaySales, (sale) => number(sale.total))
    ),
  }))
  .sort((a, b) => a.hour - b.hour)

const weekdayOccurrences = new Map(weekdays.map((row) => [row.weekday, row.observedDays]))
const weekdayHours = groupSales(
  fullDaySales,
  (sale) => `${weekdayFormatter.format(new Date(sale.created_at))}|${localHour(sale.created_at)}`
)
  .map((row) => {
    const [weekday, hour] = row.key.split('|')
    const occurrences = weekdayOccurrences.get(weekday) ?? 0
    return {
      weekday,
      hour: Number(hour),
      sales: row.sales,
      revenue: row.revenue,
      averageTicket: row.averageTicket,
      salesPerWeekdayOccurrence: occurrences ? round(row.sales / occurrences, 1) : 0,
      revenuePerWeekdayOccurrence: occurrences ? round(row.revenue / occurrences) : 0,
    }
  })
  .sort((a, b) => b.revenuePerWeekdayOccurrence - a.revenuePerWeekdayOccurrence)

const dailyTimelines = [...new Set(fullDaySales.map((sale) => localDate(sale.created_at)))].map(
  (date) => {
    const daySales = fullDaySales.filter((sale) => localDate(sale.created_at) === date)
    const minutes = daySales.map((sale) => localMinuteOfDay(sale.created_at))
    return {
      date,
      weekday: weekdayFormatter.format(new Date(daySales[0].created_at)),
      firstSaleMinute: Math.min(...minutes),
      lastSaleMinute: Math.max(...minutes),
    }
  }
)

function summarizeWeekdayHourRange(rows, predicate, totalRevenue) {
  const selected = rows.filter(predicate)
  const revenue = sumBy(selected, (row) => row.revenue)
  return {
    sales: sumBy(selected, (row) => row.sales),
    revenue: round(revenue),
    revenueSharePct: percent(revenue, totalRevenue),
  }
}

const scheduleByWeekday = weekdays.map((day) => {
  const rows = weekdayHours.filter((row) => row.weekday === day.weekday)
  const timelines = dailyTimelines.filter((row) => row.weekday === day.weekday)
  const firstSaleMedian = median(timelines.map((row) => row.firstSaleMinute))
  const lastSaleMedian = median(timelines.map((row) => row.lastSaleMinute))
  return {
    weekday: day.weekday,
    observedDays: day.observedDays,
    revenue: day.revenue,
    firstSaleMedian: firstSaleMedian === null ? null : formatMinuteOfDay(firstSaleMedian),
    lastSaleMedian: lastSaleMedian === null ? null : formatMinuteOfDay(lastSaleMedian),
    before09: summarizeWeekdayHourRange(rows, (row) => row.hour < 9, day.revenue),
    before10: summarizeWeekdayHourRange(rows, (row) => row.hour < 10, day.revenue),
    from20: summarizeWeekdayHourRange(rows, (row) => row.hour >= 20, day.revenue),
    from21: summarizeWeekdayHourRange(rows, (row) => row.hour >= 21, day.revenue),
  }
})

const operationalDays = [...new Set(fullDaySales.map((sale) => localDate(sale.created_at)))]
  .map((date) => {
    const daySales = fullDaySales.filter((sale) => localDate(sale.created_at) === date)
    const linkedSessions = [
      ...new Set(daySales.map((sale) => sale.cash_session_id).filter(Boolean)),
    ]
      .map((sessionId) => cashSessionById.get(sessionId))
      .filter(Boolean)
    if (linkedSessions.length === 0) return null

    const openedAt = linkedSessions.map((session) => session.opened_at).sort()[0]
    const closedTimestamps = linkedSessions
      .map((session) => session.closed_at)
      .filter(Boolean)
      .sort()
    const closedAt =
      closedTimestamps.at(-1) ??
      daySales
        .map((sale) => sale.created_at)
        .sort()
        .at(-1)
    const firstSaleAt = daySales.map((sale) => sale.created_at).sort()[0]
    const lastSaleAt = daySales
      .map((sale) => sale.created_at)
      .sort()
      .at(-1)
    const openMinute = localMinuteOfDay(openedAt)
    const closeDateOffset = dayNumber(localDate(closedAt)) - dayNumber(date)
    const closeMinute = localMinuteOfDay(closedAt) + Math.max(closeDateOffset, 0) * 1440

    return {
      date,
      weekday: weekdayFormatter.format(new Date(firstSaleAt)),
      sessions: linkedSessions.length,
      openedAt,
      closedAt,
      openingTime: formatMinuteOfDay(openMinute),
      closingTime: formatMinuteOfDay(localMinuteOfDay(closedAt)),
      openMinute,
      closeMinute: Math.min(closeMinute, 1440),
      firstSaleTime: formatMinuteOfDay(localMinuteOfDay(firstSaleAt)),
      lastSaleTime: formatMinuteOfDay(localMinuteOfDay(lastSaleAt)),
      minutesFromOpenToFirstSale: round((new Date(firstSaleAt) - new Date(openedAt)) / 60_000),
      minutesFromLastSaleToClose: round((new Date(closedAt) - new Date(lastSaleAt)) / 60_000),
      sales: daySales.length,
      revenue: round(sumBy(daySales, (sale) => number(sale.total))),
    }
  })
  .filter(Boolean)
  .sort((a, b) => a.date.localeCompare(b.date))

const cashScheduleByWeekday = [...new Set(operationalDays.map((day) => day.weekday))]
  .map((weekday) => {
    const days = operationalDays.filter((day) => day.weekday === weekday)
    const medianOpen = median(days.map((day) => day.openMinute))
    const medianClose = median(days.map((day) => day.closeMinute))
    return {
      weekday,
      days: days.length,
      medianOpeningTime: formatMinuteOfDay(medianOpen),
      earliestOpeningTime: formatMinuteOfDay(Math.min(...days.map((day) => day.openMinute))),
      latestOpeningTime: formatMinuteOfDay(Math.max(...days.map((day) => day.openMinute))),
      medianClosingTime: formatMinuteOfDay(Math.min(medianClose, 1439)),
      medianMinutesToFirstSale: median(days.map((day) => day.minutesFromOpenToFirstSale)),
      openedAtOrBefore10: days.filter((day) => day.openMinute <= 600).length,
      openedAfter10: days.filter((day) => day.openMinute > 600).length,
    }
  })
  .sort(
    (left, right) =>
      weekdays.findIndex((row) => row.weekday === left.weekday) -
      weekdays.findIndex((row) => row.weekday === right.weekday)
  )

const exposureByHour = hours.map((hour) => {
  const exposedHours = sumBy(operationalDays, (day) => {
    const start = Math.max(day.openMinute, hour.hour * 60)
    const end = Math.min(day.closeMinute, (hour.hour + 1) * 60)
    return Math.max(end - start, 0) / 60
  })
  return {
    hour: hour.hour,
    exposedHours: round(exposedHours, 1),
    sales: hour.sales,
    revenue: hour.revenue,
    salesPerOpenHour: exposedHours ? round(hour.sales / exposedHours, 2) : null,
    revenuePerOpenHour: exposedHours ? round(hour.revenue / exposedHours) : null,
  }
})

const paymentGroups = new Map()
for (const payment of completedPayments) {
  const method = payment.metodo
  const current = paymentGroups.get(method) ?? { method, transactions: 0, amount: 0 }
  current.transactions += 1
  current.amount += number(payment.amount)
  paymentGroups.set(method, current)
}
const paymentTotal = sumBy(completedPayments, (payment) => number(payment.amount))
const paymentMix = [...paymentGroups.values()]
  .map((row) => ({
    ...row,
    amount: round(row.amount),
    sharePct: percent(row.amount, paymentTotal),
  }))
  .sort((a, b) => b.amount - a.amount)

function itemNetRevenue(item) {
  return number(item.total)
}

const productGroups = new Map()
for (const item of completedItems) {
  const product = productById.get(item.producto_id)
  const key = item.producto_id ?? item.producto_sku ?? item.producto_nombre
  const current = productGroups.get(key) ?? {
    productId: item.producto_id,
    name: item.producto_nombre,
    sku: item.producto_sku,
    category: categoryById.get(product?.categoria_id) ?? 'Sin categoría',
    type: product?.tipo ?? 'unknown',
    units: 0,
    revenue: 0,
    sales: new Set(),
    capturedCost: 0,
    capturedCostRevenue: 0,
    capturedCostUnits: 0,
  }
  const quantity = number(item.quantity)
  const revenue = itemNetRevenue(item)
  current.units += quantity
  current.revenue += revenue
  current.sales.add(item.sale_id)
  if (item.unit_cost !== null && item.unit_cost !== undefined) {
    current.capturedCost += number(item.unit_cost) * quantity
    current.capturedCostRevenue += revenue
    current.capturedCostUnits += quantity
  }
  productGroups.set(key, current)
}

const productPerformance = [...productGroups.values()]
  .map((row) => ({
    productId: row.productId,
    name: row.name,
    sku: row.sku,
    category: row.category,
    type: row.type,
    units: round(row.units, 2),
    sales: row.sales.size,
    revenue: round(row.revenue),
    revenueSharePct: percent(row.revenue, sumBy(completedItems, itemNetRevenue)),
    capturedCostCoveragePct: percent(row.capturedCostRevenue, row.revenue),
    capturedGrossProfit: round(row.capturedCostRevenue - row.capturedCost),
    capturedGrossMarginPct: percent(
      row.capturedCostRevenue - row.capturedCost,
      row.capturedCostRevenue
    ),
  }))
  .sort((a, b) => b.revenue - a.revenue)

const categoryGroups = new Map()
for (const product of productGroups.values()) {
  const current = categoryGroups.get(product.category) ?? {
    category: product.category,
    units: 0,
    revenue: 0,
    sales: new Set(),
    capturedCost: 0,
    capturedCostRevenue: 0,
  }
  current.units += product.units
  current.revenue += product.revenue
  for (const saleId of product.sales) current.sales.add(saleId)
  current.capturedCost += product.capturedCost
  current.capturedCostRevenue += product.capturedCostRevenue
  categoryGroups.set(product.category, current)
}

const categoryPerformance = [...categoryGroups.values()]
  .map((row) => ({
    category: row.category,
    units: round(row.units, 2),
    sales: row.sales.size,
    revenue: round(row.revenue),
    revenueSharePct: percent(row.revenue, sumBy(completedItems, itemNetRevenue)),
    penetrationPct: percent(row.sales.size, completedSales.length),
    capturedCostCoveragePct: percent(row.capturedCostRevenue, row.revenue),
    capturedGrossProfit: round(row.capturedCostRevenue - row.capturedCost),
    capturedGrossMarginPct: percent(
      row.capturedCostRevenue - row.capturedCost,
      row.capturedCostRevenue
    ),
  }))
  .sort((a, b) => b.revenue - a.revenue)

function aggregatePeriodItems(salesSubset) {
  const saleIds = new Set(salesSubset.map((sale) => sale.id))
  const periodItems = completedItems.filter((item) => saleIds.has(item.sale_id))
  const productRows = new Map()
  const categoryRows = new Map()

  for (const item of periodItems) {
    const product = productById.get(item.producto_id)
    const productKey = item.producto_id ?? item.producto_sku ?? item.producto_nombre
    const category = categoryById.get(product?.categoria_id) ?? 'Sin categoría'
    const quantity = number(item.quantity)
    const revenue = itemNetRevenue(item)
    const productRow = productRows.get(productKey) ?? {
      key: productKey,
      name: item.producto_nombre,
      category,
      units: 0,
      revenue: 0,
    }
    productRow.units += quantity
    productRow.revenue += revenue
    productRows.set(productKey, productRow)

    const categoryRow = categoryRows.get(category) ?? {
      key: category,
      name: category,
      units: 0,
      revenue: 0,
    }
    categoryRow.units += quantity
    categoryRow.revenue += revenue
    categoryRows.set(category, categoryRow)
  }

  return { productRows, categoryRows }
}

function comparePeriodItems(currentSales, previousSales) {
  const current = aggregatePeriodItems(currentSales)
  const previous = aggregatePeriodItems(previousSales)

  function compareMaps(currentRows, previousRows) {
    const keys = new Set([...currentRows.keys(), ...previousRows.keys()])
    return [...keys]
      .map((key) => {
        const currentRow = currentRows.get(key)
        const previousRow = previousRows.get(key)
        const currentRevenue = currentRow?.revenue ?? 0
        const previousRevenue = previousRow?.revenue ?? 0
        const currentUnits = currentRow?.units ?? 0
        const previousUnits = previousRow?.units ?? 0
        return {
          name: currentRow?.name ?? previousRow?.name,
          category: currentRow?.category ?? previousRow?.category,
          currentRevenue: round(currentRevenue),
          previousRevenue: round(previousRevenue),
          revenueChange: round(currentRevenue - previousRevenue),
          revenueGrowthPct: growth(currentRevenue, previousRevenue),
          currentUnits: round(currentUnits, 2),
          previousUnits: round(previousUnits, 2),
          unitsGrowthPct: growth(currentUnits, previousUnits),
        }
      })
      .sort((a, b) => b.revenueChange - a.revenueChange)
  }

  const products = compareMaps(current.productRows, previous.productRows)
  const categories = compareMaps(current.categoryRows, previous.categoryRows)

  return {
    categories,
    topProductGainers: products.slice(0, 15),
    topProductDecliners: [...products]
      .sort((a, b) => a.revenueChange - b.revenueChange)
      .slice(0, 15),
  }
}

const categoryPairs = new Map()
const productPairs = new Map()
for (const [saleId, items] of itemsBySale) {
  const uniqueCategories = [
    ...new Set(
      items.map((item) => {
        const product = productById.get(item.producto_id)
        return categoryById.get(product?.categoria_id) ?? 'Sin categoría'
      })
    ),
  ].sort()
  for (let left = 0; left < uniqueCategories.length; left += 1) {
    for (let right = left + 1; right < uniqueCategories.length; right += 1) {
      const key = `${uniqueCategories[left]} + ${uniqueCategories[right]}`
      categoryPairs.set(key, (categoryPairs.get(key) ?? 0) + 1)
    }
  }

  const uniqueProducts = [...new Set(items.map((item) => item.producto_nombre))].sort()
  for (let left = 0; left < uniqueProducts.length; left += 1) {
    for (let right = left + 1; right < uniqueProducts.length; right += 1) {
      const key = `${uniqueProducts[left]} + ${uniqueProducts[right]}`
      productPairs.set(key, (productPairs.get(key) ?? 0) + 1)
    }
  }
}

const basketRows = completedSales.map((sale) => {
  const items = itemsBySale.get(sale.id) ?? []
  return {
    lines: items.length,
    units: sumBy(items, (item) => number(item.quantity)),
    revenue: number(sale.total),
  }
})
const multiLineSales = basketRows.filter((basket) => basket.lines >= 2)

const discountedSales = completedSales.filter((sale) => number(sale.discount_total) > 0)
const discountTotal = sumBy(completedSales, (sale) => number(sale.discount_total))
const grossBeforeDiscount = sumBy(
  completedSales,
  (sale) => number(sale.total) + number(sale.discount_total)
)

const ticketBands = [
  { label: '<15k', min: 0, max: 15_000 },
  { label: '15k-30k', min: 15_000, max: 30_000 },
  { label: '30k-60k', min: 30_000, max: 60_000 },
  { label: '60k-100k', min: 60_000, max: 100_000 },
  { label: '>=100k', min: 100_000, max: Infinity },
].map((band) => {
  const rows = completedSales.filter(
    (sale) => number(sale.total) >= band.min && number(sale.total) < band.max
  )
  const revenue = sumBy(rows, (sale) => number(sale.total))
  return {
    band: band.label,
    sales: rows.length,
    salesSharePct: percent(rows.length, completedSales.length),
    revenue: round(revenue),
    revenueSharePct: percent(
      revenue,
      sumBy(completedSales, (sale) => number(sale.total))
    ),
    customerCapturePct: percent(rows.filter((sale) => sale.cliente_id).length, rows.length),
  }
})

const recent28Ids = new Set(recent28.map((sale) => sale.id))
const recent28ProductIds = new Set(
  completedItems.filter((item) => recent28Ids.has(item.sale_id)).map((item) => item.producto_id)
)
const activeProducts = products.filter((product) => product.is_active && !product.deleted_at)
const neverSoldActive = activeProducts.filter((product) => !productGroups.has(product.id))
const notSoldRecent28 = activeProducts.filter((product) => !recent28ProductIds.has(product.id))

const stockByProduct = new Map()
for (const movement of inventoryMovements.filter((row) => new Date(row.created_at) <= cutoff)) {
  stockByProduct.set(
    movement.producto_id,
    (stockByProduct.get(movement.producto_id) ?? 0) + number(movement.cantidad)
  )
}
const slowMovingStock = notSoldRecent28
  .filter((product) => !['prepared', 'combo'].includes(product.tipo))
  .map((product) => {
    const stock = stockByProduct.get(product.id) ?? 0
    return {
      name: product.nombre,
      stock: round(stock, 2),
      unitCost: round(number(product.costo)),
      inventoryValue: round(Math.max(stock, 0) * number(product.costo)),
    }
  })
  .filter((product) => product.stock > 0)
  .sort((a, b) => b.inventoryValue - a.inventoryValue)
const neverSoldIds = new Set(neverSoldActive.map((product) => product.id))
const neverSoldStock = slowMovingStock.filter((product) => {
  const source = products.find((candidate) => candidate.nombre === product.name)
  return source && neverSoldIds.has(source.id)
})

const capturedCostItems = completedItems.filter(
  (item) => item.unit_cost !== null && item.unit_cost !== undefined
)
const capturedRevenue = sumBy(capturedCostItems, itemNetRevenue)
const capturedCost = sumBy(
  capturedCostItems,
  (item) => number(item.unit_cost) * number(item.quantity)
)

const clientSales = completedSales.filter((sale) => sale.cliente_id)
const uniqueClientsWithSales = new Set(clientSales.map((sale) => sale.cliente_id)).size

const voidReasons = new Map()
for (const sale of voidedSales) {
  const reason = sale.voided_reason?.trim() || 'Sin motivo'
  voidReasons.set(reason, (voidReasons.get(reason) ?? 0) + 1)
}

const paymentDifference = round(paymentTotal - sumBy(completedSales, (sale) => number(sale.total)))
const itemDifference = round(
  sumBy(completedItems, itemNetRevenue) - sumBy(completedSales, (sale) => number(sale.total))
)

const paymentsBySale = new Map()
for (const payment of completedPayments) {
  const rows = paymentsBySale.get(payment.sale_id) ?? []
  rows.push(payment)
  paymentsBySale.set(payment.sale_id, rows)
}
const paymentMismatches = completedSales
  .map((sale) => {
    const salePayments = paymentsBySale.get(sale.id) ?? []
    const paid = sumBy(salePayments, (payment) => number(payment.amount))
    return {
      saleNumber: sale.sale_number,
      date: localDate(sale.created_at),
      saleTotal: round(number(sale.total)),
      paid: round(paid),
      difference: round(paid - number(sale.total)),
      methods: salePayments.map((payment) => payment.metodo),
    }
  })
  .filter((row) => Math.abs(row.difference) > 1)
  .sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference))

const suspiciousProductMargins = productPerformance
  .filter(
    (product) =>
      product.capturedCostCoveragePct > 0 &&
      (product.capturedGrossProfit < 0 || product.capturedGrossMarginPct < 10)
  )
  .sort((a, b) => a.capturedGrossMarginPct - b.capturedGrossMarginPct)

const report = {
  generatedAt: cutoff.toISOString(),
  timeZone: TIME_ZONE,
  scope: {
    firstCompletedSale: completedSales.length
      ? completedSales.map((sale) => sale.created_at).sort()[0]
      : null,
    lastCompletedSale: completedSales.length
      ? completedSales
          .map((sale) => sale.created_at)
          .sort()
          .at(-1)
      : null,
    allSales: salesAtCutoff.length,
    completedSales: completedSales.length,
    voidedSales: voidedSales.length,
    completedRevenue: round(sumBy(completedSales, (sale) => number(sale.total))),
    todayPartial: { date: today, ...summarizeSales(todaySales) },
  },
  growth: {
    last14VsPrevious14: compareWindows(recent14, previous14, 14),
    last28VsPrevious28: compareWindows(recent28, previous28, 28),
    itemMixLast14VsPrevious14: comparePeriodItems(recent14, previous14),
    itemMixLast28VsPrevious28: comparePeriodItems(recent28, previous28),
    recentDaily: daily.slice(-21),
    weekly,
    bestCompleteWeeks: [...completeWeeks].sort((a, b) => b.revenue - a.revenue),
  },
  demand: {
    weekdays,
    hours,
    weekdayHours,
    scheduleByWeekday,
    ticketBands,
    baskets: {
      averageLines: round(sumBy(basketRows, (basket) => basket.lines) / basketRows.length, 2),
      averageUnits: round(sumBy(basketRows, (basket) => basket.units) / basketRows.length, 2),
      multiLineSales: multiLineSales.length,
      multiLineRatePct: percent(multiLineSales.length, basketRows.length),
      multiLineAverageTicket: multiLineSales.length
        ? round(sumBy(multiLineSales, (basket) => basket.revenue) / multiLineSales.length)
        : 0,
      singleLineAverageTicket:
        basketRows.length - multiLineSales.length
          ? round(
              sumBy(
                basketRows.filter((basket) => basket.lines < 2),
                (basket) => basket.revenue
              ) /
                (basketRows.length - multiLineSales.length)
            )
          : 0,
    },
  },
  operations: {
    cashScheduleByWeekday,
    sundayOperationalDays: operationalDays.filter((day) => day.weekday === 'domingo'),
    exposureByHour,
  },
  assortment: {
    categories: categoryPerformance,
    topProductsByRevenue: productPerformance.slice(0, 20),
    topProductsByUnits: [...productPerformance].sort((a, b) => b.units - a.units).slice(0, 20),
    topCategoryPairs: [...categoryPairs.entries()]
      .map(([pair, sales]) => ({ pair, sales }))
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 15),
    topProductPairs: [...productPairs.entries()]
      .map(([pair, sales]) => ({ pair, sales }))
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 15),
    activeProducts: activeProducts.length,
    neverSoldActiveCount: neverSoldActive.length,
    neverSoldActive: neverSoldActive.map((product) => product.nombre).sort(),
    notSoldRecent28Count: notSoldRecent28.length,
    notSoldRecent28: notSoldRecent28.map((product) => product.nombre).sort(),
    slowMovingStockValue: round(sumBy(slowMovingStock, (product) => product.inventoryValue)),
    slowMovingStock: slowMovingStock.slice(0, 25),
    neverSoldStockValue: round(sumBy(neverSoldStock, (product) => product.inventoryValue)),
  },
  profitability: {
    capturedCostRevenueCoveragePct: percent(capturedRevenue, sumBy(completedItems, itemNetRevenue)),
    capturedRevenue: round(capturedRevenue),
    capturedCost: round(capturedCost),
    capturedGrossProfit: round(capturedRevenue - capturedCost),
    capturedGrossMarginPct: percent(capturedRevenue - capturedCost, capturedRevenue),
    suspiciousProductMargins,
    note: 'Gross margin is only calculated for sale lines with unit_cost captured; it is before operating expenses and tax adjustments.',
  },
  commercialLevers: {
    payments: paymentMix,
    discounts: {
      sales: discountedSales.length,
      salesRatePct: percent(discountedSales.length, completedSales.length),
      total: round(discountTotal),
      rateOnGrossPct: percent(discountTotal, grossBeforeDiscount),
      averagePerDiscountedSale: discountedSales.length
        ? round(discountTotal / discountedSales.length)
        : 0,
      itemDiscountTotal: round(sumBy(completedSales, (sale) => number(sale.item_discount_total))),
      globalDiscountTotal: round(
        sumBy(completedSales, (sale) => number(sale.global_discount_total))
      ),
      loyaltyDiscountTotal: round(
        sumBy(completedSales, (sale) => number(sale.loyalty_discount_total))
      ),
    },
    customers: {
      customersRegistered: customers.length,
      salesWithCustomer: clientSales.length,
      salesWithCustomerPct: percent(clientSales.length, completedSales.length),
      revenueWithCustomerPct: percent(
        sumBy(clientSales, (sale) => number(sale.total)),
        sumBy(completedSales, (sale) => number(sale.total))
      ),
      uniqueClientsWithSales,
    },
    loyalty: {
      accounts: loyaltyAccounts.length,
      transactions: loyaltyTransactions.length,
      rewards: loyaltyRewards.length,
      rewardsByStatus: Object.fromEntries(
        [...new Set(loyaltyRewards.map((reward) => reward.status))].map((status) => [
          status,
          loyaltyRewards.filter((reward) => reward.status === status).length,
        ])
      ),
    },
  },
  controls: {
    voidRatePct: percent(voidedSales.length, salesAtCutoff.length),
    voidedValue: round(sumBy(voidedSales, (sale) => number(sale.total))),
    voidReasons: [...voidReasons.entries()]
      .map(([reason, sales]) => ({ reason, sales }))
      .sort((a, b) => b.sales - a.sales),
    paymentMinusSales: paymentDifference,
    paymentMismatches,
    itemsMinusSales: itemDifference,
  },
}

console.log(JSON.stringify(report, null, 2))
