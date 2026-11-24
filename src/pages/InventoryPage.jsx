import { Download, UploadCloud } from 'lucide-react'
import InventoryTable from '../components/InventoryTable'
import { PageHeader } from '../components/ui'
import { downloadAssets } from '../lib/exporter'
import { formatCurrency, formatDate } from '../lib/format'

export default function InventoryPage({ assets, dataset, settings, onSelect, notify }) {
  const totalValue = assets.reduce((sum, asset) => sum + (Number.isFinite(asset.price) ? asset.price : 0), 0)
  return (
    <div className="fade-in">
      <PageHeader
        title="Asset inventory"
        description={`Every row from “${dataset.fileName}” · ${dataset.sheetName}. Search, filter, sort and open any asset for its full record.`}
        actions={
          <button
            type="button"
            className="btn"
            onClick={() => {
              downloadAssets(assets, `it-asset-inventory-${new Date().toISOString().slice(0, 10)}.xlsx`)
              notify?.('Full inventory exported')
            }}
          >
            <Download size={14} /> Export all
          </button>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Rows in dataset', value: assets.length },
          { label: 'With purchase price', value: assets.filter((a) => Number.isFinite(a.price)).length },
          { label: 'Assigned to someone', value: assets.filter((a) => a.employee).length },
          { label: 'Recorded purchase value', value: formatCurrency(totalValue, settings.currency) },
        ].map((item) => (
          <div key={item.label} className="card px-4 py-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.08em] faint">{item.label}</div>
            <div className="mono mt-1 text-[19px] font-semibold tracking-[-0.02em]">{item.value}</div>
          </div>
        ))}
      </div>

      <InventoryTable assets={assets} dataset={dataset} settings={settings} onSelect={onSelect} notify={notify} title="All assets" />

      <p className="mt-3 flex items-center gap-1.5 text-[11px] faint">
        <UploadCloud size={12} /> Source imported {formatDate(dataset.importedAt)} · {dataset.headers.length} columns mapped to {Object.keys(dataset.mapping).length} fields.
      </p>
    </div>
  )
}
