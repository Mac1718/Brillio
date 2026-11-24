import * as XLSX from 'xlsx'
import { ASSET_FIELDS } from './fields'
import { formatDate } from './format'

const EXPORT_COLUMNS = [
  ['assetId', 'Asset ID'],
  ['name', 'Asset Name'],
  ['quantity', 'Quantity'],
  ['category', 'Category'],
  ['brand', 'Brand'],
  ['model', 'Model'],
  ['serial', 'Serial Number'],
  ['employee', 'Assigned To'],
  ['department', 'Department'],
  ['location', 'Location'],
  ['status', 'Status'],
  ['purchaseDate', 'Purchase Date'],
  ['price', 'Purchase Price'],
  ['currentValue', 'Current Value'],
  ['warrantyStart', 'Warranty Start'],
  ['warrantyEnd', 'Warranty Expiry'],
  ['storage', 'Storage'],
  ['ram', 'RAM'],
  ['processor', 'Processor'],
  ['os', 'Operating System'],
  ['maintenanceCost', 'Maintenance Cost'],
  ['repairStatus', 'Repair Status'],
  ['notes', 'Notes'],
]

export function assetsToSheetRows(assets) {
  return assets.map((asset) => {
    const row = {}
    EXPORT_COLUMNS.forEach(([key, label]) => {
      const value = asset[key]
      if (key === 'purchaseDate' || key === 'warrantyStart' || key === 'warrantyEnd') row[label] = value ? formatDate(value) : ''
      else if (key === 'storage') row[label] = asset.storage?.label || ''
      else if (key === 'ram') row[label] = asset.ram?.label || ''
      else row[label] = value ?? ''
    })
    if (Number.isFinite(asset.price)) row['Line Total'] = Math.round(asset.price * (asset.units || 1))
    return row
  })
}

export function downloadAssets(assets, filename = 'it-asset-inventory.xlsx') {
  const worksheet = XLSX.utils.json_to_sheet(assetsToSheetRows(assets))
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Assets')
  XLSX.writeFile(workbook, filename)
}

export function downloadRawDataset(dataset) {
  const rows = dataset.rows.map((cells) => {
    const row = {}
    dataset.headers.forEach((header, index) => {
      row[header] = cells[index] ?? ''
    })
    return row
  })
  const worksheet = XLSX.utils.json_to_sheet(rows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, dataset.sheetName?.slice(0, 30) || 'Data')
  XLSX.writeFile(workbook, `source-${dataset.fileName.replace(/\.(xlsx|xls)$/i, '')}.xlsx`)
}

export function downloadSummaryReport({ dataset, assets, kpis, departmentRows, categoryRows, warrantyRows, tickets, settings }) {
  const wb = XLSX.utils.book_new()

  const summary = [
    { Metric: 'Source file', Value: dataset.fileName },
    { Metric: 'Worksheet', Value: dataset.sheetName },
    { Metric: 'Imported at', Value: new Date(dataset.importedAt).toLocaleString() },
    { Metric: 'Total assets', Value: assets.reduce((count, asset) => count + (asset.units || 1), 0) },
    { Metric: 'Source rows', Value: assets.length },
    { Metric: 'Total purchase value', Value: Math.round(kpis.purchase) },
    { Metric: 'Current book value', Value: Math.round(kpis.book) },
    { Metric: 'Depreciation', Value: Math.round(kpis.depreciation) },
    { Metric: 'Maintenance cost', Value: Math.round(kpis.maintenance) },
    { Metric: 'Support ticket cost', Value: Math.round(kpis.support) },
    { Metric: 'Assigned assets', Value: assets.filter((a) => a.status === 'Assigned' || a.employee).length },
    { Metric: 'Warranty active', Value: warrantyRows.find((r) => r.name === 'Active')?.value ?? 0 },
    { Metric: 'Warranty expiring soon', Value: warrantyRows.find((r) => r.name === 'Expiring soon')?.value ?? 0 },
    { Metric: 'Warranty expired', Value: warrantyRows.find((r) => r.name === 'Expired')?.value ?? 0 },
    { Metric: 'Depreciation rule', Value: `Straight line over ${settings.usefulLifeYears} years` },
    { Metric: 'Currency', Value: settings.currency },
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), 'Summary')

  if (categoryRows.length) {
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(categoryRows.map((r) => ({ Category: r.name, Assets: r.value }))),
      'By Category',
    )
  }
  if (departmentRows.length) {
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        departmentRows.map((r) => ({
          Department: r.name,
          Assets: r.total,
          Assigned: r.assigned,
          Available: r.available,
          Maintenance: r.maintenance,
          Damaged: r.damaged,
          'Purchase Value': r.cost,
          'Current Value': r.currentValue,
        })),
      ),
      'By Department',
    )
  }
  if (warrantyRows.length) {
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(warrantyRows.map((r) => ({ 'Warranty status': r.name, Assets: r.value }))),
      'Warranty',
    )
  }
  if (tickets?.length) {
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        tickets.map((t) => ({
          'Ticket ID': t.ticketId,
          Subject: t.subject,
          Status: t.status,
          Category: t.category,
          Priority: t.priority,
          Opened: formatDate(t.opened),
          Resolved: formatDate(t.resolved),
          'Resolution (h)': t.resolutionHours ?? '',
          Assignee: t.assignee,
        })),
      ),
      'Support Tickets',
    )
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(assetsToSheetRows(assets)), 'Asset Inventory')

  XLSX.writeFile(wb, `it-asset-summary-${new Date().toISOString().slice(0, 10)}.xlsx`)
}

export function downloadTemplate() {
  const columns = ASSET_FIELDS.map((field) => field.label)
  const example = {}
  columns.forEach((column) => {
    example[column] = ''
  })
  const worksheet = XLSX.utils.json_to_sheet([example])
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Asset Template')
  XLSX.writeFile(workbook, 'it-asset-template.xlsx')
}
