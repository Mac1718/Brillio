import {
  Database,
  FileSpreadsheet,
  FileText,
  Printer,
  Table,
  UploadCloud,
} from 'lucide-react'
import { Card, CardHeader, EmptyState, PageHeader, SectionTitle } from '../components/ui'
import {
  categoryDistribution,
  departmentSummary,
  financialSummary,
  statusCounts,
  ticketSummary,
  warrantyStats,
} from '../lib/analytics'
import {
  downloadAssets,
  downloadRawDataset,
  downloadSummaryReport,
  downloadTemplate,
} from '../lib/exporter'
import { formatCurrency, formatDate } from '../lib/format'
import { ASSET_FIELDS } from '../lib/fields'

export default function Reports({ assets, dataset, settings, tickets, notify, navigate }) {
  if (!dataset) {
    return (
      <div className="fade-in">
        <PageHeader title="Reports" description="Export and print the analysis generated from your uploaded workbook." />
        <EmptyState
          icon={FileText}
          title="No dataset to report on"
          description="Upload an Excel asset register first. Reports are generated from the active dataset only."
          action={
            <button type="button" className="btn btn-primary" onClick={() => navigate('upload')}>
              <UploadCloud size={14} /> Upload Excel
            </button>
          }
        />
      </div>
    )
  }

  const financial = financialSummary(assets, tickets)
  const counts = statusCounts(assets)
  const warranty = warrantyStats(assets, settings.warrantyAlertDays)
  const departments = departmentSummary(assets)
  const categories = categoryDistribution(assets)
  const support = ticketSummary(tickets)
  const money = (value) => formatCurrency(value, settings.currency)
  const mapped = ASSET_FIELDS.filter((field) => dataset.mapping[field.key] != null)

  const reportCards = [
    {
      icon: Table,
      title: 'Asset inventory',
      description: `${assets.length} assets with every mapped field — ready for Excel.`,
      action: 'Download inventory',
      onClick: () => {
        downloadAssets(assets, `it-asset-inventory-${new Date().toISOString().slice(0, 10)}.xlsx`)
        notify?.('Inventory workbook downloaded')
      },
    },
    {
      icon: FileSpreadsheet,
      title: 'Summary report',
      description: 'Multi-sheet workbook: summary, department ledger, category counts, warranty and tickets.',
      action: 'Download summary',
      primary: true,
      onClick: () => {
        downloadSummaryReport({
          dataset,
          assets,
          kpis: financial,
          departmentRows: departments,
          categoryRows: categories,
          warrantyRows: [
            { name: 'Active', value: warranty.active },
            { name: 'Expiring soon', value: warranty.expiring },
            { name: 'Expired', value: warranty.expired },
          ],
          tickets,
          settings,
        })
        notify?.('Summary report downloaded')
      },
    },
    {
      icon: Database,
      title: 'Source workbook',
      description: 'A clean copy of the uploaded rows exactly as they were read.',
      action: 'Download source rows',
      onClick: () => {
        downloadRawDataset(dataset)
        notify?.('Source rows downloaded')
      },
    },
    {
      icon: Printer,
      title: 'Printable dashboard',
      description: 'Print or save as PDF using the browser print dialog. Sidebar and controls are hidden.',
      action: 'Print dashboard',
      onClick: () => window.print(),
    },
    {
      icon: FileSpreadsheet,
      title: 'Blank template',
      description: 'Starter sheet with the standard asset columns for future uploads.',
      action: 'Download template',
      onClick: downloadTemplate,
    },
  ]

  return (
    <div className="fade-in">
      <PageHeader
        title="Reports &amp; export"
        description="Everything on this page is calculated from the active dataset. Download workbooks or print the dashboard for review."
        actions={
          <button type="button" className="btn" onClick={() => window.print()}>
            <Printer size={14} /> Print
          </button>
        }
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {reportCards.map((card) => {
          const Icon = card.icon
          return (
            <Card key={card.title} className="flex flex-col p-5" lift>
              <span className="mb-3 grid h-9 w-9 place-items-center rounded-[9px]" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                <Icon size={16} />
              </span>
              <h3 className="text-[13.5px] font-semibold">{card.title}</h3>
              <p className="mt-1 flex-1 text-[12px] muted">{card.description}</p>
              <button type="button" className={`btn mt-4 w-full ${card.primary ? 'btn-primary' : ''}`} onClick={card.onClick}>
                {card.action}
              </button>
            </Card>
          )
        })}
      </div>

      <SectionTitle>Summary preview</SectionTitle>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Financial summary" subtitle={`Currency: ${settings.currency}`} />
          <div className="p-5 pt-3">
            {[
              ['Purchase value', financial.pricedCount ? money(financial.purchase) : 'No price data'],
              ['Current book value', financial.valuedCount ? money(financial.book) : 'No valuation data'],
              ['Depreciation', financial.pricedCount ? money(financial.depreciation) : '—'],
              ['Average asset cost', financial.avgPrice ? money(financial.avgPrice) : '—'],
              ['Maintenance spend', financial.maintenance ? money(financial.maintenance) : '—'],
              ['Support ticket cost', financial.support ? money(financial.support) : '—'],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between border-b py-2 text-[12px] last:border-0">
                <span style={{ color: 'var(--text-2)' }}>{label}</span>
                <span className="mono font-medium">{value}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="Inventory summary" subtitle="Counts by status and warranty" />
          <div className="p-5 pt-3">
            {[['Total assets', assets.length], ...Object.entries(counts), ['Warranty active', warranty.active], ['Warranty expiring', warranty.expiring], ['Warranty expired', warranty.expired]].map(
              ([label, value]) => (
                <div key={label} className="flex items-center justify-between border-b py-2 text-[12px] last:border-0">
                  <span style={{ color: 'var(--text-2)' }}>{label}</span>
                  <span className="mono font-medium">{value}</span>
                </div>
              ),
            )}
            {support ? (
              <div className="mt-2 rounded-[9px] border px-3 py-2 text-[11.5px]" style={{ background: 'var(--panel-2)' }}>
                {support.total} support tickets · {support.Resolved} resolved · {support.avgResolution ? `${support.avgResolution.toFixed(1)}h average` : 'no resolution time'}
              </div>
            ) : null}
          </div>
        </Card>

        <Card>
          <CardHeader title="Data source" subtitle="Provenance of every figure on the dashboard" />
          <div className="p-5 pt-3 text-[12px]">
            {[
              ['File', dataset.fileName],
              ['Worksheet', dataset.sheetName],
              ['Imported', formatDate(dataset.importedAt)],
              ['Data rows', dataset.rows.length],
              ['Source columns', dataset.headers.length],
              ['Mapped fields', `${mapped.length} of ${ASSET_FIELDS.length}`],
              ['Ticket sheet', dataset.tickets?.sheetName || 'none detected'],
              ['Maintenance sheet', dataset.maintenance?.sheetName || 'none detected'],
              ['Date format', dataset.dateOrder === 'mdy' ? 'Month first (US)' : 'Day first'],
            ].map(([label, value]) => (
              <div key={label} className="flex items-start justify-between gap-3 border-b py-2 last:border-0">
                <span style={{ color: 'var(--text-2)' }}>{label}</span>
                <span className="max-w-[190px] truncate text-right font-medium" title={String(value)}>
                  {value}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <SectionTitle>Mapped columns</SectionTitle>
      <Card className="p-5">
        <div className="flex flex-wrap gap-2">
          {mapped.map((field) => (
            <span key={field.key} className="badge" title={`Source column: ${dataset.headers[dataset.mapping[field.key]]}`}>
              <span style={{ color: 'var(--text-3)' }}>{field.label}</span>
              <span className="mx-0.5 opacity-40">→</span>
              {dataset.headers[dataset.mapping[field.key]]}
            </span>
          ))}
        </div>
        <p className="mt-3 text-[11px] faint">
          Fields not listed above were absent from the workbook. Their related KPIs and charts are hidden or shown as unavailable instead of being estimated.
        </p>
      </Card>
    </div>
  )
}
