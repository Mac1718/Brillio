import { ASSET_STATUSES, formatGb, repairGroup, warrantyState } from './normalize'
import { formatMonthLabel, sum } from './format'

export const hasField = (dataset, key) => dataset?.mapping?.[key] != null

/** Quantity-aware count: one row can represent several physical units. */
export const unitsOf = (asset) => (Number.isFinite(asset?.units) && asset.units > 0 ? asset.units : 1)

const countBy = (list, getter, weigher = () => 1) => {
  const map = new Map()
  list.forEach((item) => {
    const key = getter(item)
    if (key == null || key === '') return
    map.set(key, (map.get(key) || 0) + weigher(item))
  })
  return [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
}

const sumBy = (list, getter, selector, weigher = () => 1) => {
  const map = new Map()
  list.forEach((item) => {
    const key = getter(item)
    if (key == null || key === '') return
    const amount = selector(item)
    if (!Number.isFinite(amount)) return
    map.set(key, (map.get(key) || 0) + amount * weigher(item))
  })
  return [...map.entries()].map(([name, value]) => ({ name, value: Math.round(value) })).sort((a, b) => b.value - a.value)
}

const topWithOther = (rows, limit = 8) => {
  if (rows.length <= limit) return rows
  const top = rows.slice(0, limit)
  const rest = rows.slice(limit).reduce((total, row) => total + row.value, 0)
  return [...top, { name: 'Other', value: rest }]
}

export function categoryDistribution(assets) {
  return countBy(assets, (a) => a.category, unitsOf)
}

export function statusDistribution(assets) {
  return countBy(assets, (a) => a.status, unitsOf)
}

export function departmentDistribution(assets) {
  return countBy(assets, (a) => a.department, unitsOf)
}

export function brandDistribution(assets) {
  return topWithOther(countBy(assets, (a) => a.brand || null, unitsOf), 8)
}

export function locationDistribution(assets) {
  return topWithOther(countBy(assets, (a) => a.location || null, unitsOf), 8)
}

export function purchaseTrend(assets, granularity = 'year') {
  const map = new Map()
  let dated = 0
  assets.forEach((asset) => {
    if (!asset.purchaseDate) return
    dated += unitsOf(asset)
    const year = asset.purchaseDate.getFullYear()
    const key = granularity === 'year' ? String(year) : `${year}-${String(asset.purchaseDate.getMonth() + 1).padStart(2, '0')}`
    if (!map.has(key)) map.set(key, { name: key, count: 0, value: 0 })
    const entry = map.get(key)
    entry.count += unitsOf(asset)
    if (Number.isFinite(asset.price)) entry.value += asset.price * unitsOf(asset)
  })
  const rows = [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
  return {
    dated,
    rows: rows.map((row) => ({
      ...row,
      label: granularity === 'year' ? row.name : formatMonthLabel(row.name),
      value: Math.round(row.value),
    })),
  }
}

export function costByCategory(assets) {
  return topWithOther(sumBy(assets, (a) => a.category, (a) => a.price, unitsOf), 9)
}

export function costByDepartment(assets) {
  return topWithOther(sumBy(assets, (a) => a.department, (a) => a.price, unitsOf), 10)
}

const STORAGE_BUCKETS = [
  { name: '≤ 256 GB', min: 0, max: 256 },
  { name: '257–512 GB', min: 256, max: 512 },
  { name: '513 GB – 1 TB', min: 512.1, max: 1024 },
  { name: '1 – 2 TB', min: 1024.1, max: 2048 },
  { name: '> 2 TB', min: 2048.1, max: Infinity },
]

function bucketize(assets, getter, buckets) {
  const result = buckets.map((bucket) => ({ name: bucket.name, value: 0 }))
  assets.forEach((asset) => {
    const item = getter(asset)
    if (!item) return
    const index = buckets.findIndex((bucket) => item.gb > bucket.min && item.gb <= bucket.max)
    if (index >= 0) result[index].value += unitsOf(asset)
  })
  return result
}

export function storageDistribution(assets) {
  return bucketize(assets, (a) => a.storage, STORAGE_BUCKETS)
}

export function ramDistribution(assets) {
  return countBy(assets, (a) => (a.ram ? formatGb(a.ram.gb) : null), unitsOf).sort((a, b) => parseFloat(a.name) - parseFloat(b.name))
}

export function storageTypeDistribution(assets) {
  const map = new Map()
  assets.forEach((asset) => {
    const raw = asset.storageType || (asset.category === 'SSD' ? 'SSD' : asset.category === 'Hard Disk' ? 'HDD' : null)
    if (!raw) return
    const upper = String(raw).toUpperCase()
    const key = upper.includes('SSD') || upper.includes('NVME') ? 'SSD' : upper.includes('HDD') ? 'HDD' : String(raw)
    map.set(key, (map.get(key) || 0) + unitsOf(asset))
  })
  return [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
}

export function warrantyStats(assets, alertDays, now = new Date()) {
  const result = { active: 0, expiring: 0, expired: 0, unknown: 0 }
  assets.forEach((asset) => {
    result[warrantyState(asset, alertDays, now)] += unitsOf(asset)
  })
  return result
}

export function warrantySummary(assets, alertDays, now = new Date()) {
  const result = warrantyStats(assets, alertDays, now)
  return [
    { name: 'Active', value: result.active },
    { name: 'Expiring soon', value: result.expiring },
    { name: 'Expired', value: result.expired },
    { name: 'No warranty date', value: result.unknown },
  ].filter((row) => row.value > 0)
}

export function expiringAssets(assets, alertDays, now = new Date(), limit = 100) {
  return assets
    .filter((asset) => ['expiring', 'expired'].includes(warrantyState(asset, alertDays, now)))
    .sort((a, b) => a.warrantyEnd - b.warrantyEnd)
    .slice(0, limit)
}

export function allocationSummary(assets, dataset) {
  if (!hasField(dataset, 'employee') && !hasField(dataset, 'status')) return null
  let assigned = 0
  let total = 0
  assets.forEach((asset) => {
    total += unitsOf(asset)
    const isAssigned = asset.status === 'Assigned' || Boolean(asset.employee)
    if (isAssigned) assigned += unitsOf(asset)
  })
  return [
    { name: 'Assigned', value: assigned },
    { name: 'Unassigned', value: Math.max(0, total - assigned) },
  ]
}

export function departmentSummary(assets) {
  const map = new Map()
  assets.forEach((asset) => {
    const key = asset.department || 'Unspecified'
    if (!map.has(key)) {
      map.set(key, { name: key, total: 0, assigned: 0, available: 0, maintenance: 0, damaged: 0, cost: 0, currentValue: 0 })
    }
    const row = map.get(key)
    const units = unitsOf(asset)
    row.total += units
    if (asset.status === 'Assigned') row.assigned += units
    if (asset.status === 'Available') row.available += units
    if (asset.status === 'Maintenance') row.maintenance += units
    if (asset.status === 'Damaged') row.damaged += units
    if (Number.isFinite(asset.price)) row.cost += asset.price * units
    if (Number.isFinite(asset.currentValue)) row.currentValue += asset.currentValue * units
  })
  return [...map.values()]
    .map((row) => ({ ...row, cost: Math.round(row.cost), currentValue: Math.round(row.currentValue) }))
    .sort((a, b) => b.total - a.total)
}

/** Maintenance information carried on the asset rows themselves. */
export function maintenanceSummary(assets) {
  const records = assets.filter((asset) => asset.lastMaintenance || asset.maintenanceCost != null || asset.repairStatus)
  const totalCost = sum(records, (a) => a.maintenanceCost)
  const stages = { Pending: 0, Completed: 0, Other: 0, Unknown: 0 }
  records.forEach((asset) => {
    stages[repairGroup(asset.repairStatus)] += 1
  })
  return {
    records,
    totalCost,
    pending: stages.Pending,
    completed: stages.Completed,
    repairStatuses: countBy(records, (a) => a.repairStatus || null),
    source: 'asset',
  }
}

/** Maintenance sheet records (separate worksheet, when present). */
export function worksheetMaintenance(records) {
  const stages = { Pending: 0, Completed: 0, Other: 0, Unknown: 0 }
  records.forEach((record) => {
    stages[record.stage] = (stages[record.stage] || 0) + 1
  })
  return {
    records,
    totalCost: sum(records, (record) => record.cost),
    pending: stages.Pending,
    completed: stages.Completed,
    repairStatuses: countBy(records, (record) => record.statusRaw || null),
    source: 'worksheet',
  }
}

export function deviceInventory(assets) {
  const byCategory = countBy(assets, (a) => a.category, unitsOf)
  const get = (name) => byCategory.find((row) => row.name === name)?.value || 0
  return {
    Desktop: get('Desktop'),
    Laptop: get('Laptop'),
    Monitor: get('Monitor'),
    Printer: get('Printer'),
    'Hard Disk': get('Hard Disk'),
    SSD: get('SSD'),
    Keyboard: get('Keyboard'),
    Mouse: get('Mouse'),
    Server: get('Server'),
    Tablet: get('Tablet'),
    'Docking Station': get('Docking Station'),
  }
}

export function specsByModel(assets, limit = 100) {
  const map = new Map()
  assets.forEach((asset) => {
    const key = [asset.brand, asset.model].filter(Boolean).join(' ') || asset.category || 'Unspecified'
    if (!map.has(key)) map.set(key, { name: key, count: 0, ram: 0, ramCount: 0, storage: 0, storageCount: 0, processors: new Map(), totalValue: 0 })
    const row = map.get(key)
    const units = unitsOf(asset)
    row.count += units
    if (asset.ram) {
      row.ram += asset.ram.gb
      row.ramCount += 1
    }
    if (asset.storage) {
      row.storage += asset.storage.gb
      row.storageCount += 1
    }
    if (asset.processor) row.processors.set(asset.processor, (row.processors.get(asset.processor) || 0) + 1)
    if (Number.isFinite(asset.currentValue)) row.totalValue += asset.currentValue * units
  })
  return [...map.entries()]
    .map(([name, row]) => ({
      name,
      count: row.count,
      avgRam: row.ramCount ? row.ram / row.ramCount : null,
      avgStorage: row.storageCount ? row.storage / row.storageCount : null,
      processors: [...row.processors.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([p]) => p),
      totalValue: Math.round(row.totalValue),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}

export const isHighPriority = (ticket) => /(high|urgent|critical|p1|sev(erity)? ?1|immediate)/i.test(ticket?.priority || '')

export function ticketSummary(tickets) {
  if (!tickets.length) return null
  const counts = { Open: 0, Pending: 0, Resolved: 0, Other: 0 }
  tickets.forEach((ticket) => {
    counts[ticket.status] += 1
  })
  const resolvedWithTime = tickets.filter((t) => t.resolutionHours != null)
  const highPriority = tickets.filter(isHighPriority)
  return {
    total: tickets.length,
    ...counts,
    highPriority: highPriority.length,
    highPriorityOpen: highPriority.filter((t) => t.status !== 'Resolved').length,
    avgResolution: resolvedWithTime.length
      ? resolvedWithTime.reduce((total, t) => total + t.resolutionHours, 0) / resolvedWithTime.length
      : null,
    avgResolutionSamples: resolvedWithTime.length,
    categories: countBy(tickets, (t) => t.category),
    departments: countBy(tickets, (t) => t.department || 'Unspecified'),
    byAssignee: topWithOther(countBy(tickets, (t) => (t.assignee ? t.assignee : 'Unassigned')), 8),
    byPriority: countBy(tickets, (t) => t.priority || null),
  }
}

export function financialSummary(assets, tickets = []) {
  const priced = assets.filter((a) => Number.isFinite(a.price))
  const valued = assets.filter((a) => Number.isFinite(a.currentValue))
  const purchase = sum(priced, (a) => a.price * unitsOf(a))
  const book = sum(valued, (a) => a.currentValue * unitsOf(a))
  const maintenance = sum(assets, (a) => a.maintenanceCost)
  const support = sum(tickets, (t) => t.cost)
  const pricedUnits = sum(priced, unitsOf)
  return {
    purchase: Math.round(purchase),
    book: Math.round(book),
    depreciation: Math.round(Math.max(0, purchase - book)),
    maintenance: Math.round(maintenance),
    support: Math.round(support),
    pricedCount: priced.length,
    pricedUnits,
    valuedCount: valued.length,
    avgPrice: pricedUnits ? purchase / pricedUnits : null,
  }
}

export function statusCounts(assets) {
  const counts = {}
  ASSET_STATUSES.forEach((status) => {
    counts[status] = 0
  })
  assets.forEach((asset) => {
    counts[asset.status] = (counts[asset.status] || 0) + unitsOf(asset)
  })
  return counts
}

export function computeKpiCards(assets, dataset) {
  const total = assets.reduce((count, asset) => count + unitsOf(asset), 0)
  const status = statusCounts(assets)
  const categories = new Map()
  assets.forEach((asset) => {
    if (asset.category) categories.set(asset.category, (categories.get(asset.category) || 0) + unitsOf(asset))
  })
  const share = (count) => (total ? `${Math.round((count / total) * 100)}% of assets` : '')
  const hasQuantity = hasField(dataset, 'quantity')
  const cards = [
    {
      key: 'total',
      label: 'Total IT Assets',
      value: total,
      format: 'number',
      foot: hasQuantity
        ? `${assets.length} rows × quantity`
        : hasField(dataset, 'category')
          ? `${categories.size} categor${categories.size === 1 ? 'y' : 'ies'}`
          : `${dataset?.headers?.length || 0} source columns`,
    },
  ]

  if (hasField(dataset, 'category')) {
    ;[
      ['desktop', 'Total Desktops', 'Desktop'],
      ['laptop', 'Total Laptops', 'Laptop'],
      ['monitor', 'Total Monitors', 'Monitor'],
      ['printer', 'Total Printers', 'Printer'],
      ['hdd', 'Total Hard Disks', 'Hard Disk'],
      ['ssd', 'Total SSDs', 'SSD'],
    ].forEach(([key, label, category]) => {
      const count = categories.get(category) || 0
      if (count > 0) cards.push({ key, label, value: count, format: 'number', foot: share(count) })
    })
  }

  const priced = assets.filter((asset) => Number.isFinite(asset.price))
  if (hasField(dataset, 'price') && priced.length) {
    const pricedUnits = priced.reduce((count, asset) => count + unitsOf(asset), 0)
    const value = sum(priced, (asset) => asset.price * unitsOf(asset))
    cards.push({
      key: 'value',
      label: 'Total Asset Value',
      value,
      format: 'currency',
      foot: hasQuantity ? `${pricedUnits} units` : `${priced.length} priced assets`,
      title: 'Sum of purchase price × quantity across all priced rows',
    })
  }

  const hasStatus = hasField(dataset, 'status')
  const hasEmployee = hasField(dataset, 'employee')
  if (hasStatus || hasEmployee) {
    const assigned = assets.reduce(
      (count, asset) => count + (asset.status === 'Assigned' || Boolean(asset.employee) ? unitsOf(asset) : 0),
      0,
    )
    cards.push({ key: 'assigned', label: 'Assigned Assets', value: assigned, format: 'number', foot: share(assigned) }, {
      key: 'available',
      label: 'Available Assets',
      value: hasStatus ? status.Available : Math.max(0, total - assigned),
      format: 'number',
      foot: hasStatus ? share(status.Available) : 'no assignee',
    })
  }
  if (hasStatus) {
    cards.push(
      { key: 'maintenance', label: 'Assets Under Maintenance', value: status.Maintenance, format: 'number', foot: share(status.Maintenance) },
      { key: 'damaged', label: 'Damaged Assets', value: status.Damaged, format: 'number', foot: share(status.Damaged) },
      { key: 'retired', label: 'Retired Assets', value: status.Retired, format: 'number', foot: share(status.Retired) },
    )
  }
  return cards
}

export function topAssets(assets, limit = 10) {
  return assets
    .filter((asset) => Number.isFinite(asset.price))
    .sort((a, b) => b.price - a.price)
    .slice(0, limit)
}
