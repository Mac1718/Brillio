// Field definitions and fuzzy header detection.
// Every supported asset column is described here; detection is data-driven.

export const ASSET_FIELDS = [
  {
    key: 'assetId',
    label: 'Asset ID',
    type: 'text',
    synonyms: ['asset id', 'asset tag', 'asset no', 'asset number', 'asset code', 'tag', 'tag no', 'inventory id', 'id'],
  },
  {
    key: 'serial',
    label: 'Serial Number',
    type: 'text',
    synonyms: ['serial no', 'serial number', 'serial', 'service tag', 'sn', 's/n', 'serial #'],
  },
  {
    key: 'quantity',
    label: 'Quantity',
    type: 'number',
    synonyms: ['quantity', 'qty', 'units', 'unit count', 'no of units', 'number of units', 'pieces', 'nos'],
  },
  {
    key: 'name',
    label: 'Asset Name',
    type: 'text',
    synonyms: ['asset name', 'device name', 'equipment name', 'item name', 'asset description', 'item', 'name'],
  },
  {
    key: 'category',
    label: 'Asset Category',
    type: 'category',
    synonyms: ['asset type', 'asset category', 'device type', 'equipment type', 'hardware type', 'item type', 'category', 'device', 'kind', 'type'],
  },
  {
    key: 'brand',
    label: 'Brand',
    type: 'text',
    synonyms: ['brand', 'manufacturer', 'make', 'oem'],
  },
  {
    key: 'model',
    label: 'Model',
    type: 'text',
    synonyms: ['model no', 'model number', 'device model', 'model'],
  },
  {
    key: 'purchaseDate',
    label: 'Purchase Date',
    type: 'date',
    synonyms: ['purchase date', 'purchased date', 'date of purchase', 'purchase dt', 'buy date', 'invoice date', 'acquisition date', 'purchased on'],
  },
  {
    key: 'price',
    label: 'Purchase Price',
    type: 'number',
    synonyms: ['purchase price', 'purchase cost', 'unit price', 'invoice amount', 'total cost', 'cost', 'price', 'amount'],
  },
  {
    key: 'currentValue',
    label: 'Current Value',
    type: 'number',
    synonyms: ['current value', 'book value', 'present value', 'depreciated value', 'residual value', 'net value'],
  },
  {
    key: 'employee',
    label: 'Assigned Employee',
    type: 'text',
    synonyms: ['assigned to', 'assigned employee', 'allocated to', 'employee name', 'employee', 'custodian', 'user name', 'user', 'owner', 'holder'],
  },
  {
    key: 'department',
    label: 'Department',
    type: 'text',
    synonyms: ['department', 'dept', 'division', 'business unit', 'team'],
  },
  {
    key: 'location',
    label: 'Location',
    type: 'text',
    synonyms: ['location', 'site', 'office', 'building', 'floor', 'branch'],
  },
  {
    key: 'status',
    label: 'Status',
    type: 'status',
    synonyms: ['asset status', 'current status', 'allocation status', 'status', 'state', 'condition'],
  },
  {
    key: 'warrantyStart',
    label: 'Warranty Start',
    type: 'date',
    synonyms: ['warranty start date', 'warranty start', 'warranty from', 'warranty purchase date'],
  },
  {
    key: 'warrantyEnd',
    label: 'Warranty Expiry',
    type: 'date',
    synonyms: ['warranty expiry date', 'warranty expiration', 'warranty end date', 'warranty expiry', 'warranty end', 'warranty until', 'warranty exp date', 'warranty to', 'expiry date', 'warranty'],
  },
  {
    key: 'storage',
    label: 'Storage Capacity',
    type: 'storage',
    synonyms: ['storage capacity', 'storage size', 'hard disk', 'disk size', 'hdd size', 'ssd size', 'capacity', 'storage', 'disk', 'drive'],
  },
  {
    key: 'storageType',
    label: 'Storage Type',
    type: 'text',
    synonyms: ['storage type', 'drive type', 'disk type', 'media type'],
  },
  {
    key: 'ram',
    label: 'RAM',
    type: 'storage',
    synonyms: ['ram size', 'memory size', 'ram', 'memory'],
  },
  {
    key: 'processor',
    label: 'Processor',
    type: 'text',
    synonyms: ['processor type', 'processor model', 'processor', 'cpu model', 'cpu', 'chip'],
  },
  {
    key: 'os',
    label: 'Operating System',
    type: 'text',
    synonyms: ['operating system', 'os version', 'os', 'platform'],
  },
  {
    key: 'supplier',
    label: 'Supplier',
    type: 'text',
    synonyms: ['purchased from', 'supplier', 'dealer', 'vendor'],
  },
  {
    key: 'lastMaintenance',
    label: 'Last Maintenance',
    type: 'date',
    synonyms: ['last maintenance', 'maintenance date', 'last service', 'service date', 'serviced on'],
  },
  {
    key: 'maintenanceCost',
    label: 'Maintenance Cost',
    type: 'number',
    synonyms: ['maintenance cost', 'maintenance charges', 'repair cost', 'repair charge', 'service cost', 'spare cost'],
  },
  {
    key: 'repairStatus',
    label: 'Repair Status',
    type: 'text',
    synonyms: ['repair status', 'service status', 'maintenance status', 'repair'],
  },
  {
    key: 'notes',
    label: 'Notes',
    type: 'text',
    synonyms: ['remarks', 'comment', 'comments', 'notes', 'details'],
  },
]

export const TICKET_FIELDS = [
  { key: 'ticketId', label: 'Ticket ID', synonyms: ['ticket id', 'ticket no', 'ticket number', 'issue id', 'case id', 'call id', 'id'] },
  { key: 'subject', label: 'Issue / Subject', synonyms: ['subject', 'issue description', 'issue', 'problem', 'title', 'summary'] },
  { key: 'status', label: 'Ticket Status', synonyms: ['ticket status', 'resolution status', 'status', 'state'] },
  { key: 'priority', label: 'Priority', synonyms: ['priority', 'severity', 'urgency'] },
  { key: 'category', label: 'Issue Category', synonyms: ['issue category', 'issue type', 'problem type', 'category', 'type'] },
  { key: 'opened', label: 'Opened', synonyms: ['opened date', 'open date', 'created date', 'created on', 'created', 'reported date', 'ticket date', 'opened', 'date'] },
  { key: 'resolved', label: 'Resolved', synonyms: ['resolved date', 'resolution date', 'closed date', 'resolved on', 'closed on', 'resolved', 'closed'] },
  { key: 'resolutionHours', label: 'Resolution Time (h)', synonyms: ['resolution time hours', 'resolution time', 'time to resolve', 'resolution hours', 'hours', 'duration', 'tat'] },
  { key: 'assignee', label: 'Assigned To', synonyms: ['assigned to', 'assignee', 'agent', 'technician', 'engineer', 'owner'] },
  { key: 'department', label: 'Department', synonyms: ['department', 'dept', 'division', 'team', 'business unit'] },
  { key: 'cost', label: 'Ticket Cost', synonyms: ['repair cost', 'service cost', 'cost', 'charge'] },
]

export const MAINTENANCE_FIELDS = [
  { key: 'workOrder', label: 'Work Order', synonyms: ['work order', 'workorder', 'job id', 'job no', 'service id', 'maintenance id', 'wo number', 'wo no', 'ticket id', 'id'] },
  { key: 'assetRef', label: 'Asset ID', synonyms: ['asset id', 'asset tag', 'asset code', 'serial number', 'serial no', 'serial', 'device id', 'equipment id'] },
  { key: 'assetName', label: 'Asset Name', synonyms: ['asset name', 'device name', 'equipment name', 'model', 'item', 'name'] },
  { key: 'date', label: 'Service Date', synonyms: ['service date', 'maintenance date', 'repair date', 'completed date', 'date of service', 'logged date', 'reported date', 'date'] },
  { key: 'status', label: 'Repair Status', synonyms: ['repair status', 'maintenance status', 'service status', 'work status', 'job status', 'status', 'state'] },
  { key: 'cost', label: 'Cost', synonyms: ['maintenance cost', 'repair cost', 'service cost', 'parts cost', 'labour cost', 'cost', 'amount', 'charge'] },
  { key: 'technician', label: 'Technician', synonyms: ['technician', 'engineer', 'assigned to', 'agent', 'vendor', 'serviced by', 'performed by'] },
  { key: 'issue', label: 'Issue', synonyms: ['issue', 'problem', 'fault', 'description', 'work description', 'remarks', 'notes', 'details'] },
]

export const normalizeHeader = (value) =>
  String(value ?? '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

function score(header, synonym) {
  if (!header || !synonym) return 0
  if (header === synonym) return 1000 + synonym.length
  if (header.startsWith(synonym) || synonym.startsWith(header)) {
    if (Math.min(header.length, synonym.length) < 3) return 0
    return 500 + Math.min(header.length, synonym.length)
  }
  if (header.includes(synonym)) return 300 + synonym.length
  if (synonym.includes(header) && header.length >= 3) return 200 + header.length
  return 0
}

/**
 * Greedy global best-match assignment of headers -> field keys.
 * Exact matches win first so "Current Value" is not mistaken for "Purchase Price".
 */
export function detectMapping(headers, fields = ASSET_FIELDS) {
  const pairs = []
  headers.forEach((rawHeader, colIndex) => {
    const header = normalizeHeader(rawHeader)
    if (!header) return
    fields.forEach((field) => {
      field.synonyms.forEach((synonym) => {
        const s = score(header, normalizeHeader(synonym))
        if (s > 0) pairs.push({ field: field.key, colIndex, score: s })
      })
    })
  })
  pairs.sort((a, b) => b.score - a.score)

  const mapping = {}
  const usedCols = new Set()
  const usedFields = new Set()
  for (const pair of pairs) {
    if (!mapping[pair.field] && !usedFields.has(pair.field) && !usedCols.has(pair.colIndex)) {
      mapping[pair.field] = pair.colIndex
      usedFields.add(pair.field)
      usedCols.add(pair.colIndex)
    }
  }
  return mapping
}

export const mappedFieldCount = (mapping) => Object.values(mapping || {}).filter((v) => v !== '' && v != null).length

export const fieldLabel = (key) => ASSET_FIELDS.find((f) => f.key === key)?.label || key
