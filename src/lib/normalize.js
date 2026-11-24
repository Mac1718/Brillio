import { titleCase } from './format'

export const ASSET_STATUSES = ['Available', 'Assigned', 'Maintenance', 'Damaged', 'Retired']
export const TICKET_STATUSES = ['Open', 'Pending', 'Resolved', 'Other']

export function parseNumber(value) {
  if (value == null || value === '') return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const text = String(value).trim()
  if (!text) return null
  const negative = /^\(.*\)$/.test(text)
  const cleaned = text.replace(/[^0-9.,-]/g, '')
  if (!cleaned || !/\d/.test(cleaned)) return null
  let normalized = cleaned
  const hasComma = cleaned.includes(',')
  const hasDot = cleaned.includes('.')
  if (hasComma && hasDot) {
    // Whichever separator comes last is the decimal separator.
    normalized =
      cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')
        ? cleaned.replace(/\./g, '').replace(/,/g, '.')
        : cleaned.replace(/,/g, '')
  } else if (hasComma) {
    // "1,180" and Indian grouping are thousands; "12,5" is a decimal comma.
    const grouped = /^-?\d{1,3}(,\d{3})+$/.test(cleaned) || /^-?\d{1,2}(,\d{2})+,\d{3}$/.test(cleaned)
    normalized = grouped ? cleaned.replace(/,/g, '') : cleaned.replace(/,/g, '.')
  } else if (hasDot) {
    // "1.234.567" uses dots as thousands separators.
    if (/^-?\d{1,3}(\.\d{3}){2,}$/.test(cleaned)) normalized = cleaned.replace(/\./g, '')
  }
  const number = Number(normalized)
  if (!Number.isFinite(number)) return null
  return negative ? -number : number
}

const UNIT_GB = { b: 1 / 1024 ** 3, kb: 1 / 1024 ** 2, mb: 1 / 1024, gb: 1, tb: 1024, pb: 1024 * 1024 }

/** Parses "512GB SSD", "1 TB", "16GB (2x8GB)" into { gb, label }. */
export function parseStorage(value) {
  if (value == null || value === '') return null
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value <= 0) return null
    return { gb: value, label: formatGb(value) }
  }
  const text = String(value)
  const matches = [...text.matchAll(/(\d+(?:[.,]\d+)?)\s*(tb|gb|mb|kb|b)?\b/gi)]
  if (!matches.length) return null
  let best = null
  matches.forEach((match) => {
    const amount = Number(match[1].replace(',', '.'))
    if (!Number.isFinite(amount)) return
    const unit = (match[2] || 'gb').toLowerCase()
    const gb = amount * (UNIT_GB[unit] ?? 1)
    if (!best || gb > best.gb) best = { gb, amount, unit }
  })
  if (!best) return null
  return { gb: Math.round(best.gb * 10) / 10, label: formatGb(best.gb) }
}

export function formatGb(gb) {
  if (gb >= 1024) {
    const tb = gb / 1024
    return `${Number.isInteger(tb) ? tb : tb.toFixed(1)} TB`
  }
  return `${Math.round(gb)} GB`
}

export function parseDate(value, order = 'dmy') {
  if (value == null || value === '') return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  if (typeof value === 'number') {
    if (value >= 1900 && value <= 2200 && Number.isInteger(value)) return new Date(value, 0, 1)
    if (value > 200 && value < 80000) {
      const parsed = new Date(Math.round((value - 25569) * 86400 * 1000))
      return Number.isNaN(parsed.getTime()) ? null : parsed
    }
    return null
  }
  const text = String(value).trim()
  if (!text) return null

  const iso = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/)
  if (iso) return safeDate(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]))

  const numeric = text.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/)
  if (numeric) {
    const a = Number(numeric[1])
    const b = Number(numeric[2])
    let year = Number(numeric[3])
    if (year < 100) year += year > 70 ? 1900 : 2000
    const dayFirst = order === 'dmy' ? a <= 12 && b <= 12 ? true : a > 12 : a > 12 && b <= 12
    const month = dayFirst ? b : a
    const day = dayFirst ? a : b
    return safeDate(year, month - 1, day)
  }

  const parsed = new Date(text)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function safeDate(year, month, day) {
  const date = new Date(year, month, day)
  if (Number.isNaN(date.getTime())) return null
  if (date.getMonth() !== month) return null
  return date
}

const CATEGORY_RULES = [
  ['Desktop', ['desktop', 'workstation', 'system unit', 'all in one', 'allinone', 'aio', 'mini pc', 'tower', 'thin client', 'cpu']],
  ['Laptop', ['laptop', 'notebook', 'macbook', 'chromebook', 'ultrabook']],
  ['Monitor', ['monitor', 'display monitor', 'display', 'screen']],
  ['Printer', ['printer', 'multifunction', 'mfp', 'scanner', 'plotter', 'copier']],
  ['Tablet', ['tablet', 'ipad']],
  ['Server', ['server']],
  ['Network', ['router', 'switch', 'firewall', 'access point', 'modem', 'network']],
  ['Hard Disk', ['hard disk', 'hard drive', 'hdd', 'external drive']],
  ['SSD', ['ssd', 'solid state']],
  ['Keyboard', ['keyboard']],
  ['Mouse', ['mouse']],
  ['Docking Station', ['docking', 'dock']],
  ['UPS', ['ups', 'battery backup']],
  ['Peripheral', ['webcam', 'headset', 'headphone', 'projector', 'speaker', 'cable', 'adapter', 'charger', 'ram', 'memory']],
]

export function canonicalCategory(raw) {
  const text = String(raw ?? '').toLowerCase().trim()
  if (!text) return null
  let best = null
  CATEGORY_RULES.forEach(([label, keywords]) => {
    keywords.forEach((keyword) => {
      if (text.includes(keyword) && (!best || keyword.length > best.keyword.length)) {
        best = { label, keyword }
      }
    })
  })
  if (best) return best.label
  const cleaned = titleCase(text)
  return cleaned.length > 28 ? 'Other' : cleaned
}

export function canonicalStatus(raw, employee) {
  const text = String(raw ?? '').toLowerCase().trim()
  if (text) {
    if (/(retire|dispos|scrap|written off|end of life|\beol\b)/.test(text)) return 'Retired'
    if (/(damag|broken|faulty|defect|not working|dead|out of order)/.test(text)) return 'Damaged'
    if (/(maintenance|under repair|repair|service|diagnos|rma)/.test(text)) return 'Maintenance'
    if (/(available|in stock|spare|unassigned|idle|free|ready|in store)/.test(text)) return 'Available'
    if (/(assign|in use|in-use|issued|allocated|deployed|active|working)/.test(text)) return 'Assigned'
    return 'Other'
  }
  const hasEmployee = String(employee ?? '').trim() !== ''
  if (hasEmployee) return 'Assigned'
  return 'Available'
}

export function buildAssets(dataset, settings) {
  if (!dataset) return []
  const mapping = dataset.mapping || {}
  const order = settings.dateOrder === 'auto' ? dataset.dateOrder || 'dmy' : settings.dateOrder
  const get = (cells, key) => {
    const index = mapping[key]
    return index == null ? undefined : cells[index]
  }
  const now = new Date()

  return dataset.rows.map((cells, index) => {
    const raw = {}
    dataset.headers.forEach((header, i) => {
      raw[header] = cells[i]
    })

    const price = parseNumber(get(cells, 'price'))
    const quantity = parseNumber(get(cells, 'quantity'))
    const units = quantity != null && quantity > 0 ? Math.max(1, Math.round(quantity)) : 1
    const purchaseDate = parseDate(get(cells, 'purchaseDate'), order)
    const explicitValue = parseNumber(get(cells, 'currentValue'))
    const employee = cleanText(get(cells, 'employee'))
    const statusRaw = cleanText(get(cells, 'status'))
    const categoryRaw = cleanText(get(cells, 'category'))

    let currentValue = null
    let valueDerived = false
    if (explicitValue != null) {
      currentValue = explicitValue
    } else if (price != null && purchaseDate && settings.usefulLifeYears > 0) {
      const ageYears = (now.getTime() - purchaseDate.getTime()) / (365.25 * 24 * 3600 * 1000)
      const factor = Math.max(0, 1 - ageYears / settings.usefulLifeYears)
      currentValue = Math.round(price * factor)
      valueDerived = true
    }

    return {
      uid: index,
      assetId: cleanText(get(cells, 'assetId')) || cleanText(get(cells, 'serial')) || `#${index + 1}`,
      serial: cleanText(get(cells, 'serial')),
      name:
        cleanText(get(cells, 'name')) ||
        [cleanText(get(cells, 'brand')), cleanText(get(cells, 'model'))].filter(Boolean).join(' ') ||
        categoryRaw ||
        'Unnamed asset',
      category: canonicalCategory(categoryRaw),
      categoryRaw,
      brand: cleanText(get(cells, 'brand')),
      model: cleanText(get(cells, 'model')),
      purchaseDate,
      price,
      quantity,
      units,
      currentValue,
      valueDerived,
      employee,
      department: cleanText(get(cells, 'department')),
      location: cleanText(get(cells, 'location')),
      status: canonicalStatus(statusRaw, employee),
      statusRaw,
      warrantyStart: parseDate(get(cells, 'warrantyStart'), order),
      warrantyEnd: parseDate(get(cells, 'warrantyEnd'), order),
      storage: parseStorage(get(cells, 'storage')),
      storageType: cleanText(get(cells, 'storageType')),
      ram: parseStorage(get(cells, 'ram')),
      processor: cleanText(get(cells, 'processor')),
      os: cleanText(get(cells, 'os')),
      supplier: cleanText(get(cells, 'supplier')),
      lastMaintenance: parseDate(get(cells, 'lastMaintenance'), order),
      maintenanceCost: parseNumber(get(cells, 'maintenanceCost')),
      repairStatus: cleanText(get(cells, 'repairStatus')),
      notes: cleanText(get(cells, 'notes')),
      raw,
    }
  })
}

export function cleanText(value) {
  if (value == null) return ''
  if (value instanceof Date) return value.toISOString()
  return String(value).replace(/\s+/g, ' ').trim()
}

export function buildTickets(tickets, settings) {
  if (!tickets) return []
  const mapping = tickets.mapping || {}
  const order = settings?.dateOrder === 'auto' ? undefined : settings?.dateOrder
  const get = (cells, key) => {
    const index = mapping[key]
    return index == null ? undefined : cells[index]
  }
  return tickets.rows.map((row, index) => {
    // Ticket rows may arrive as raw cell arrays or wrapped { cells } rows.
    const cells = Array.isArray(row) ? row : row.cells
    const opened = parseDate(get(cells, 'opened'), order)
    const resolved = parseDate(get(cells, 'resolved'), order)
    let resolutionHours = parseNumber(get(cells, 'resolutionHours'))
    if (resolutionHours == null && opened && resolved) {
      resolutionHours = Math.max(0, Math.round(((resolved - opened) / 3600000) * 10) / 10)
    }
    const statusRaw = cleanText(get(cells, 'status'))
    return {
      uid: index,
      ticketId: cleanText(get(cells, 'ticketId')) || `#${index + 1}`,
      subject: cleanText(get(cells, 'subject')),
      status: canonicalTicketStatus(statusRaw),
      statusRaw,
      priority: cleanText(get(cells, 'priority')),
      category: cleanText(get(cells, 'category')) || 'Uncategorised',
      opened,
      resolved,
      resolutionHours,
      assignee: cleanText(get(cells, 'assignee')),
      department: cleanText(get(cells, 'department')) || 'Unspecified',
      cost: parseNumber(get(cells, 'cost')),
    }
  })
}

export function repairGroup(raw) {
  const text = String(raw ?? '').toLowerCase().trim()
  if (!text) return 'Unknown'
  if (/(complet|repaired|resolved|closed|done|fixed|healthy|replaced|returned)/.test(text)) return 'Completed'
  if (/(pending|in repair|repairing|open|awaiting|waiting|progress|scheduled|diagnos|ordered|on hold)/.test(text)) return 'Pending'
  return 'Other'
}

export function buildMaintenance(maintenance, settings) {
  if (!maintenance?.rows?.length) return []
  const mapping = maintenance.mapping || {}
  const order = settings?.dateOrder === 'auto' || !settings?.dateOrder ? 'dmy' : settings.dateOrder
  const get = (cells, key) => {
    const index = mapping[key]
    return index == null ? undefined : cells[index]
  }
  return maintenance.rows.map((row, index) => {
    const cells = Array.isArray(row) ? row : row.cells
    const statusRaw = cleanText(get(cells, 'status'))
    return {
      uid: index,
      workOrder: cleanText(get(cells, 'workOrder')) || `#${index + 1}`,
      assetId: cleanText(get(cells, 'assetRef')),
      assetName: cleanText(get(cells, 'assetName')),
      date: parseDate(get(cells, 'date'), order),
      statusRaw,
      stage: repairGroup(statusRaw),
      cost: parseNumber(get(cells, 'cost')),
      technician: cleanText(get(cells, 'technician')),
      issue: cleanText(get(cells, 'issue')),
    }
  })
}

export function canonicalTicketStatus(raw) {
  const text = String(raw ?? '').toLowerCase().trim()
  if (!text) return 'Other'
  if (/(resolv|clos|done|complet|fixed|solved)/.test(text)) return 'Resolved'
  if (/(pend|hold|wait|await)/.test(text)) return 'Pending'
  if (/(open|new|progress|assign|reopen|escalat)/.test(text)) return 'Open'
  return 'Other'
}

export function warrantyState(asset, alertDays, now = new Date()) {
  if (!asset.warrantyEnd) return 'unknown'
  const end = asset.warrantyEnd.getTime()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  if (end < today) return 'expired'
  if (end - today <= alertDays * 86400000) return 'expiring'
  return 'active'
}
