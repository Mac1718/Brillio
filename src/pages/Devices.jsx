import { Download, Laptop, PcCase } from 'lucide-react'
import InventoryTable from '../components/InventoryTable'
import { Card, CardHeader, MissingNotice, PageHeader, SectionTitle } from '../components/ui'
import { BarChartView, ChartFrame, DonutChart, NoChartData } from '../components/charts'
import { brandDistribution, hasField, specsByModel } from '../lib/analytics'
import { downloadAssets } from '../lib/exporter'
import { formatCurrency } from '../lib/format'
import { formatGb } from '../lib/normalize'

const countValues = (list, getter) => {
  const map = new Map()
  list.forEach((item) => {
    const key = getter(item)
    if (!key) return
    map.set(key, (map.get(key) || 0) + 1)
  })
  return [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
}

export default function Devices({ assets, dataset, settings, onSelect, notify }) {
  const devices = assets.filter((asset) => asset.category === 'Desktop' || asset.category === 'Laptop')
  const desktops = devices.filter((asset) => asset.category === 'Desktop').length
  const laptops = devices.filter((asset) => asset.category === 'Laptop').length
  const dated = devices.filter((asset) => asset.purchaseDate)
  const avgAge = dated.length
    ? dated.reduce((sum, asset) => sum + (Date.now() - asset.purchaseDate.getTime()) / (365.25 * 86400000), 0) / dated.length
    : null
  const brands = brandDistribution(devices)
  const os = countValues(devices, (asset) => asset.os)
  const specs = specsByModel(devices)
  const value = devices.reduce((sum, asset) => sum + (Number.isFinite(asset.currentValue) ? asset.currentValue : 0), 0)

  return (
    <div className="fade-in">
      <PageHeader
        title="Desktop & Laptop Management"
        description="Endpoint fleet composition, hardware generations and assignment coverage for desktops and laptops."
        actions={
          <button
            type="button"
            className="btn"
            disabled={!devices.length}
            onClick={() => {
              downloadAssets(devices, 'desktops-and-laptops.xlsx')
              notify?.('Desktop & laptop inventory exported')
            }}
          >
            <Download size={14} /> Export endpoints
          </button>
        }
      />

      {!hasField(dataset, 'category') ? (
        <MissingNotice tone="warn">
          No asset category column is mapped, so desktops and laptops cannot be separated. Map the category field on the Excel Upload page.
        </MissingNotice>
      ) : !devices.length ? (
        <MissingNotice tone="warn">No rows are categorised as Desktop or Laptop in this workbook.</MissingNotice>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Desktops', value: desktops, icon: PcCase, tone: 'var(--blue)', soft: 'var(--blue-soft)' },
          { label: 'Laptops', value: laptops, icon: Laptop, tone: 'var(--violet)', soft: 'var(--violet-soft)' },
          { label: 'Average fleet age', value: avgAge == null ? '—' : `${avgAge.toFixed(1)} yrs`, icon: null },
          { label: 'Current endpoint value', value: formatCurrency(value, settings.currency), icon: null },
        ].map((stat) => {
          const Icon = stat.icon
          return (
            <div key={stat.label} className="card flex items-center gap-3 p-4">
              {Icon ? (
                <span className="grid h-9 w-9 place-items-center rounded-[9px]" style={{ background: stat.soft, color: stat.tone }}>
                  <Icon size={16} />
                </span>
              ) : null}
              <div>
                <div className="text-[11.5px] font-medium uppercase tracking-[0.05em] faint">{stat.label}</div>
                <div className="mono mt-0.5 text-[19px] font-semibold tracking-[-0.02em]">{stat.value}</div>
              </div>
            </div>
          )
        })}
      </div>

      <SectionTitle>Endpoint analytics</SectionTitle>
      <div className="grid gap-4 lg:grid-cols-3">
        <ChartFrame title="Endpoint Mix" subtitle="Desktops vs laptops" height={252}>
          {devices.length ? (
            <DonutChart
              data={[
                { name: 'Desktops', value: desktops },
                { name: 'Laptops', value: laptops },
              ].filter((row) => row.value)}
              currency={settings.currency}
              centerLabel="endpoints"
              colors={['var(--chart-2)', 'var(--chart-6)']}
            />
          ) : (
            <NoChartData message="No desktop or laptop rows found." fields="Asset Category column" />
          )}
        </ChartFrame>

        <ChartFrame title="Manufacturer Mix" subtitle="Endpoint brands" height={252}>
          {brands.length ? <BarChartView data={brands} horizontal name="Devices" /> : <NoChartData message="No brand values found." fields="Brand column" />}
        </ChartFrame>

        <ChartFrame title="Operating Systems" subtitle="Endpoint OS distribution" height={252}>
          {os.length ? <DonutChart data={os.slice(0, 8)} currency={settings.currency} centerLabel="endpoints" /> : <NoChartData message="No OS values found." fields="Operating System column" />}
        </ChartFrame>
      </div>

      <SectionTitle>Endpoint configuration</SectionTitle>
      <Card className="overflow-hidden">
        <CardHeader title="Manufacturer &amp; Model Summary" subtitle="Average configured RAM and storage per model" />
        <div className="table-wrap mt-3">
          <table className="data-table">
            <thead>
              <tr>
                <th>Model</th>
                <th>Units</th>
                <th>Avg RAM</th>
                <th>Avg storage</th>
                <th>Top processor</th>
                <th className="text-right">Current value</th>
              </tr>
            </thead>
            <tbody>
              {specs.map((row) => (
                <tr key={row.name}>
                  <td className="max-w-[280px] truncate font-medium">{row.name}</td>
                  <td className="mono">{row.count}</td>
                  <td className="mono">{row.avgRam ? formatGb(row.avgRam) : '—'}</td>
                  <td className="mono">{row.avgStorage ? formatGb(row.avgStorage) : '—'}</td>
                  <td className="max-w-[230px] truncate muted">{row.processors[0] || '—'}</td>
                  <td className="mono text-right">{formatCurrency(row.totalValue, settings.currency)}</td>
                </tr>
              ))}
              {!specs.length ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center faint">
                    No desktop or laptop records to summarise.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mt-4">
        <InventoryTable
          assets={devices}
          dataset={dataset}
          settings={settings}
          onSelect={onSelect}
          notify={notify}
          title="Desktop & Laptop Inventory"
          subtitle={`${devices.length} endpoints with full assignment and warranty detail`}
        />
      </div>
    </div>
  )
}
