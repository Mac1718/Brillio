import { useState } from 'react'
import { ArrowRight, Boxes, FileSpreadsheet, PackageCheck, ShieldCheck, UploadCloud, UserCheck, Wallet } from 'lucide-react'
import KpiGrid from '../components/KpiGrid'
import { Card, CardHeader, EmptyState, KpiCard, LinkAction, MissingNotice, PageHeader, SectionTitle, Segmented } from '../components/ui'
import { useAuth } from '../auth/AuthContext'
import { BarChartView, ChartFrame, DonutChart, NoChartData, TrendLineView } from '../components/charts'
import {
  allocationSummary,
  brandDistribution,
  categoryDistribution,
  costByDepartment,
  departmentDistribution,
  hasField,
  purchaseTrend,
  statusCounts,
  topAssets,
  warrantyStats,
} from '../lib/analytics'
import { downloadTemplate } from '../lib/exporter'
import { formatCurrency, formatDate } from '../lib/format'

const STATUS_COLORS = {
  Available: 'var(--green)',
  Assigned: 'var(--blue)',
  Maintenance: 'var(--amber)',
  Damaged: 'var(--red)',
  Retired: 'var(--chart-6)',
  Other: 'var(--chart-5)',
}

export default function Overview({ assets, dataset, settings, navigate, onSelect }) {
  const [granularity, setGranularity] = useState('year')

  if (!dataset) return <Onboarding navigate={navigate} settings={settings} />

  const categories = categoryDistribution(assets)
  const counts = statusCounts(assets)
  const statusRows = ['Available', 'Assigned', 'Maintenance', 'Damaged', 'Retired', 'Other']
    .map((name) => ({ name, value: counts[name] || 0 }))
    .filter((row) => row.value > 0)
  const warranty = warrantyStats(assets, settings.warrantyAlertDays)
  const warrantyRows = [
    { name: 'Active', value: warranty.active },
    { name: 'Expiring soon', value: warranty.expiring },
    { name: 'Expired', value: warranty.expired },
  ].filter((row) => row.value > 0)
  const allocation = allocationSummary(assets, dataset)
  const trend = purchaseTrend(assets, granularity)
  const brands = brandDistribution(assets)
  const departments = departmentDistribution(assets)
  const top = topAssets(assets, 6)
  const deptCost = costByDepartment(assets)

  return (
    <div className="fade-in">
      <PageHeader
        title="Fleet Overview"
        description={`Live view of ${assets.length} assessed assets from “${dataset.fileName}”. Every number below is derived from the stored assessment records.`}
        actions={
          <>
            <button type="button" className="btn" onClick={() => navigate('reports')}>
              <FileSpreadsheet size={14} /> Reports
            </button>
            <button type="button" className="btn btn-primary" onClick={() => navigate('upload')}>
              <UploadCloud size={14} /> Replace data
            </button>
          </>
        }
      />

      <KpiGrid assets={assets} dataset={dataset} settings={settings} />

      {!hasField(dataset, 'category') ? (
        <div className="mt-4">
          <MissingNotice tone="warn">
            No asset category column was mapped, so device-type breakdowns are unavailable. Re-map columns on the Excel Upload page to unlock them.
          </MissingNotice>
        </div>
      ) : null}

      <SectionTitle hint={`Database · updated ${formatDate(dataset.importedAt)}`}>Asset Distribution</SectionTitle>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <ChartFrame title="Asset Distribution" subtitle="Asset count by category" height={276}>
          {categories.length ? (
            <DonutChart data={categories} currency={settings.currency} centerLabel="assets" />
          ) : (
            <NoChartData message="No category values found." fields="Asset Type / Category column" />
          )}
        </ChartFrame>

        <ChartFrame title="Status Overview" subtitle="Current lifecycle state" height={276}>
          {statusRows.length ? (
            <DonutChart
              data={statusRows}
              currency={settings.currency}
              centerLabel="assets"
              colors={statusRows.map((row) => STATUS_COLORS[row.name])}
            />
          ) : (
            <NoChartData message="No status values found." fields="Status column" />
          )}
        </ChartFrame>

        {allocation ? (
          <ChartFrame title="Asset Allocation" subtitle="Assigned vs unassigned assets" height={276}>
            <DonutChart
              data={allocation}
              currency={settings.currency}
              centerLabel="allocated"
              centerValue={allocation[0].value}
              colors={['var(--chart-1)', 'var(--chart-7)']}
            />
          </ChartFrame>
        ) : (
          <ChartFrame title="Warranty Health" subtitle="Active vs expiring vs expired" height={276}>
            {warrantyRows.length ? (
              <DonutChart
                data={warrantyRows}
                currency={settings.currency}
                centerLabel="in warranty"
                colors={['var(--green)', 'var(--amber)', 'var(--red)']}
              />
            ) : (
              <NoChartData message="No warranty dates found." fields="Warranty Expiry column" />
            )}
          </ChartFrame>
        )}
      </div>

      <SectionTitle>Purchase &amp; Allocation Trends</SectionTitle>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ChartFrame
            title="Asset Purchase Analysis"
            subtitle={trend.dated ? `${trend.dated} assets with a purchase date` : 'Assets purchased over time'}
            action={
              <Segmented
                value={granularity}
                onChange={setGranularity}
                options={[
                  { value: 'year', label: 'Year' },
                  { value: 'month', label: 'Month' },
                ]}
              />
            }
            height={288}
            footer={trend.dated ? `Peak period: ${trend.rows.reduce((best, row) => (row.count > (best?.count || 0) ? row : best), null)?.label || '—'}` : null}
          >
            {trend.rows.length ? (
              <TrendLineView data={trend.rows} dataKey="count" name="Assets purchased" />
            ) : (
              <NoChartData message="No purchase dates available to trend." fields="Purchase Date column" />
            )}
          </ChartFrame>
        </div>

        {brands.length ? (
          <ChartFrame title="Brand-wise Distribution" subtitle="Assets by manufacturer" height={288}>
            <BarChartView data={brands} horizontal name="Assets" />
          </ChartFrame>
        ) : (
          <ChartFrame title="Department-wise Assets" subtitle="Assets by department" height={288}>
            {departments.length ? (
              <BarChartView data={departments} horizontal name="Assets" />
            ) : (
              <NoChartData message="No department values found." fields="Department column" />
            )}
          </ChartFrame>
        )}
      </div>

      <SectionTitle>Highlights</SectionTitle>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card className="overflow-hidden">
            <CardHeader
              title="Highest-Value Assets"
              subtitle="Ranked by recorded purchase price"
              action={<LinkAction onClick={() => navigate('inventory')}>Inventory</LinkAction>}
            />
            {top.length ? (
              <div className="mt-2">
                {top.map((asset, index) => (
                  <button
                    key={asset.uid}
                    type="button"
                    onClick={() => onSelect(asset)}
                    className="flex w-full items-center gap-3 border-t px-5 py-2.5 text-left transition hover:bg-[var(--panel-2)]"
                  >
                    <span className="mono w-4 text-[10.5px] faint">{String(index + 1).padStart(2, '0')}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12.5px] font-medium">{asset.name}</div>
                      <div className="truncate text-[10.5px] faint">
                        {[asset.category, asset.department, asset.employee].filter(Boolean).join(' · ') || asset.assetId}
                      </div>
                    </div>
                    <span className="mono text-[12px] font-medium">{formatCurrency(asset.price, settings.currency)}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-6">
                <NoChartData message="No purchase prices were mapped, so value rankings are unavailable." fields="Purchase Price column" />
              </div>
            )}
          </Card>
        </div>

        <Card>
          <CardHeader title="Warranty &amp; Support" subtitle="Coverage and maintenance exposure" />
          <div className="space-y-3 p-5">
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Active', value: warranty.active, color: 'var(--green)' },
                { label: 'Expiring', value: warranty.expiring, color: 'var(--amber)' },
                { label: 'Expired', value: warranty.expired, color: 'var(--red)' },
                { label: 'No date', value: warranty.unknown, color: 'var(--text-3)' },
              ].map((item) => (
                <div key={item.label} className="rounded-[10px] border px-3 py-2" style={{ background: 'var(--panel-2)' }}>
                  <div className="text-[10px] uppercase tracking-[0.08em] faint">{item.label}</div>
                  <div className="mono mt-0.5 text-[17px] font-semibold" style={{ color: item.color }}>
                    {item.value}
                  </div>
                </div>
              ))}
            </div>
            {deptCost.length ? (
              <div>
                <div className="mb-1 text-[11.5px] font-medium uppercase tracking-[0.05em] faint">Top Department Spend</div>
                {deptCost.slice(0, 3).map((row) => (
                  <div key={row.name} className="flex items-center justify-between border-b py-1.5 text-[11.5px] last:border-0">
                    <span className="truncate" style={{ color: 'var(--text-2)' }}>
                      {row.name}
                    </span>
                    <span className="mono">{formatCurrency(row.value, settings.currency)}</span>
                  </div>
                ))}
              </div>
            ) : null}
            <button type="button" className="btn btn-sm w-full" onClick={() => navigate('warranty')}>
              <ShieldCheck size={13} /> Open warranty tracker <ArrowRight size={12} />
            </button>
          </div>
        </Card>
      </div>
    </div>
  )
}

function Onboarding({ navigate, settings }) {
  const { isAdmin } = useAuth()
  const steps = [
    { title: '1 · Upload', text: 'Drag in any Excel asset register. Worksheets and headers are detected for you.' },
    { title: '2 · Verify', text: 'Preview the data and confirm the auto-mapped columns. Adjust anything that looks off.' },
    { title: '3 · Analyse', text: 'KPIs, charts, warranty alerts and reports are generated from your rows — nothing is hardcoded.' },
  ]
  return (
    <div className="fade-in">
      <PageHeader
        title="Fleet Overview"
        description="No assessment records available yet. Every statistic starts at zero and is calculated only from records you import or enter."
      />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Assessed assets" value="0" icon={Boxes} tone="brand" foot="No records yet" />
        <KpiCard label="Assigned" value="0" icon={UserCheck} tone="blue" foot="No records yet" />
        <KpiCard label="Available" value="0" icon={PackageCheck} tone="green" foot="No records yet" />
        <KpiCard
          label="Recorded value"
          value={formatCurrency(0, settings?.currency || 'INR')}
          icon={Wallet}
          tone="green"
          foot="No records yet"
        />
      </div>

      <Card className="overflow-hidden">
        <div className="grid gap-8 p-7 md:p-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <span className="badge badge-green" style={{ letterSpacing: '0.08em' }}>
              IT ASSET MANAGEMENT
            </span>
            <h1 className="mt-4 text-[28px] font-semibold leading-[1.15] tracking-[-0.03em] md:text-[33px]">
              Your entire hardware estate,
              <br />
              built from one spreadsheet.
            </h1>
            <p className="mt-3 max-w-lg text-[13px] muted">
              Upload an asset register and brillo turns it into a live desktop-support dashboard: inventory, allocation, warranty exposure,
              hardware specifications, purchase costs and exportable reports.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {isAdmin ? (
                <>
                  <button type="button" className="btn btn-accent" onClick={() => navigate('upload')}>
                    <UploadCloud size={15} /> Upload Excel file
                  </button>
                  <button type="button" className="btn" onClick={downloadTemplate}>
                    <FileSpreadsheet size={15} /> Download template
                  </button>
                </>
              ) : (
                <span className="text-[12px] faint">An administrator needs to upload the Excel register before data appears here.</span>
              )}
            </div>
            {isAdmin ? <p className="mt-3 text-[11px] faint">.xlsx and .xls · validated on the server before anything is saved</p> : null}

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {steps.map((step) => (
                <div key={step.title} className="rounded-[11px] border p-3" style={{ background: 'var(--panel-2)' }}>
                  <div className="text-[11px] font-semibold" style={{ color: 'var(--accent)' }}>
                    {step.title}
                  </div>
                  <p className="mt-1 text-[11.5px] leading-relaxed muted">{step.text}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[16px] border p-4" style={{ background: 'var(--panel-2)' }}>
            <div className="mb-3 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ background: 'var(--border-strong)' }} />
              <span className="h-2 w-2 rounded-full" style={{ background: 'var(--border-strong)' }} />
              <span className="text-[10.5px] tracking-wide faint">Generated from your columns</span>
            </div>
            <div className="space-y-2">
              {[
                ['KPI summary', 'Assets, device mix, value, status'],
                ['Distribution charts', 'Category, department, brand, allocation'],
                ['Financial analysis', 'Purchase trend, cost by category and department'],
                ['Warranty tracker', 'Active, expiring, expired coverage'],
                ['Asset inventory', 'Search, filters, sorting, Excel export'],
                ['Reports', 'Summary workbook and printable output'],
              ].map(([title, sub]) => (
                <div key={title} className="flex items-center justify-between gap-3 rounded-[9px] border px-3 py-2" style={{ background: 'var(--panel)' }}>
                  <div>
                    <div className="text-[11.5px] font-medium">{title}</div>
                    <div className="text-[10.5px] faint">{sub}</div>
                  </div>
                  <ShieldCheck size={14} style={{ color: 'var(--text-3)' }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
