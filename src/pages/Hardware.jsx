import {
  Cable,
  HardDrive,
  Keyboard,
  Laptop,
  Monitor,
  Mouse,
  PcCase,
  Printer,
  Server,
  Tablet,
} from 'lucide-react'
import { Card, CardHeader, MissingNotice, PageHeader, SectionTitle } from '../components/ui'
import { BarChartView, ChartFrame, DonutChart, NoChartData } from '../components/charts'
import { deviceInventory, hasField, ramDistribution, specsByModel, storageDistribution, storageTypeDistribution } from '../lib/analytics'
import { formatGb } from '../lib/normalize'

const ICONS = {
  Desktop: PcCase,
  Laptop,
  Monitor,
  Printer,
  'Hard Disk': HardDrive,
  SSD: HardDrive,
  Keyboard,
  Mouse,
  Server,
  Tablet,
  'Docking Station': Cable,
}

export default function Hardware({ assets, dataset, settings }) {
  const inventory = deviceInventory(assets)
  const storage = storageDistribution(assets)
  const ram = ramDistribution(assets)
  const storageTypes = storageTypeDistribution(assets)
  const specs = specsByModel(assets)
  const processors = (() => {
    const map = new Map()
    assets.forEach((asset) => {
      if (!asset.processor) return
      map.set(asset.processor, (map.get(asset.processor) || 0) + 1)
    })
    return [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10)
  })()

  const hasStorage = assets.some((asset) => asset.storage)
  const hasRam = assets.some((asset) => asset.ram)
  const hasProcessor = assets.some((asset) => asset.processor)
  const hasSpecs = assets.some((asset) => asset.brand || asset.model)

  return (
    <div className="fade-in">
      <PageHeader
        title="Hardware Components"
        description="Physical inventory counts, storage and memory configuration, processors and model-level specifications."
      />

      {!hasField(dataset, 'category') ? (
        <div className="mb-4">
          <MissingNotice tone="warn">
            Category is not mapped, so component counts cannot be separated. Map an Asset Type / Category column to enable them.
          </MissingNotice>
        </div>
      ) : null}

      <SectionTitle hint="Derived from the category column">Component Inventory</SectionTitle>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {Object.entries(inventory).map(([label, count]) => {
          const Icon = ICONS[label] || HardDrive
          return (
            <div key={label} className="card flex items-center gap-3 p-3.5">
              <span className="grid h-9 w-9 flex-none place-items-center rounded-[9px]" style={{ background: 'var(--panel-2)', color: 'var(--text-2)' }}>
                <Icon size={16} strokeWidth={1.8} />
              </span>
              <div className="min-w-0">
                <div className="truncate text-[11.5px] font-medium uppercase tracking-[0.05em] faint">{label}</div>
                <div className="mono text-[18px] font-semibold leading-tight">{count}</div>
              </div>
            </div>
          )
        })}
      </div>

      <SectionTitle>Storage &amp; Memory</SectionTitle>
      <div className="grid gap-4 lg:grid-cols-3">
        <ChartFrame title="Storage Capacity Distribution" subtitle="Assets by drive size" height={264}>
          {hasStorage ? <BarChartView data={storage} name="Assets" /> : <NoChartData message="No storage values found." fields="Storage / Disk Size column" />}
        </ChartFrame>

        <ChartFrame title="RAM distribution" subtitle="Memory capacity per asset" height={264}>
          {hasRam ? <BarChartView data={ram} name="Assets" color="var(--chart-5)" /> : <NoChartData message="No RAM values found." fields="RAM / Memory column" />}
        </ChartFrame>

        <ChartFrame title="Drive type" subtitle="HDD vs SSD mix" height={264}>
          {storageTypes.length ? <DonutChart data={storageTypes} currency={settings.currency} centerLabel="drives" /> : <NoChartData message="No drive type values found." fields="Storage Type column" />}
        </ChartFrame>
      </div>

      <SectionTitle>Configuration Detail</SectionTitle>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Manufacturer &amp; Model" subtitle="Units, configured memory, storage and leading processor" />
          <div className="table-wrap mt-3" style={{ maxHeight: 430 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Brand / model</th>
                  <th>Units</th>
                  <th>Avg RAM</th>
                  <th>Avg storage</th>
                  <th>Processor</th>
                </tr>
              </thead>
              <tbody>
                {specs.map((row) => (
                  <tr key={row.name}>
                    <td className="max-w-[260px] truncate font-medium">{row.name}</td>
                    <td className="mono">{row.count}</td>
                    <td className="mono">{row.avgRam ? formatGb(row.avgRam) : '—'}</td>
                    <td className="mono">{row.avgStorage ? formatGb(row.avgStorage) : '—'}</td>
                    <td className="max-w-[240px] truncate muted">{row.processors.join(', ') || '—'}</td>
                  </tr>
                ))}
                {!hasSpecs ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center faint">
                      No manufacturer or model columns were mapped.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <CardHeader title="Processors" subtitle="Most common CPU models" />
          <div className="p-4">
            {processors.length ? (
              processors.map((row, index) => (
                <div key={row.name} className="flex items-center gap-3 border-b py-2 last:border-0">
                  <span className="mono w-4 text-[10px] faint">{String(index + 1).padStart(2, '0')}</span>
                  <span className="min-w-0 flex-1 truncate text-[12px]" title={row.name}>
                    {row.name}
                  </span>
                  <span className="mono text-[11.5px] font-medium">{row.value}</span>
                </div>
              ))
            ) : (
              <div className="py-8">
                <NoChartData message="No processor values were found in this workbook." fields="Processor / CPU column" />
              </div>
            )}
          </div>
        </Card>
      </div>

      {!hasProcessor || !hasStorage ? (
        <div className="mt-4">
          <MissingNotice>
            Some hardware detail is missing from the workbook. Add {!hasProcessor ? 'a Processor column' : ''}
            {!hasProcessor && !hasStorage ? ' and ' : ''}
            {!hasStorage ? 'a Storage / Disk Size column' : ''} to unlock the full specification view.
          </MissingNotice>
        </div>
      ) : null}
    </div>
  )
}
