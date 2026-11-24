import { FileSpreadsheet, ShieldCheck, Sparkles } from 'lucide-react'
import UploadPanel from '../components/UploadPanel'
import { Card, CardHeader, PageHeader } from '../components/ui'
import { formatDate } from '../lib/format'
import { ASSET_FIELDS } from '../lib/fields'

export default function UploadPage({ dataset, settings, onImport, notify, onRemoveDataset }) {
  return (
    <div className="fade-in">
      <PageHeader
        title="Excel upload"
        description="Import an asset register, verify the detected columns, then build the dashboard from your data. Existing dashboards update instantly."
      />

      <div className="grid gap-4 xl:grid-cols-[1.7fr_1fr] xl:items-start">
        <div>
          <UploadPanel currentDataset={dataset} onImport={onImport} notify={notify} />
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="What gets detected" subtitle="Column headings are matched to these fields" />
            <div className="p-5">
              <div className="flex flex-wrap gap-1.5">
                {ASSET_FIELDS.map((field) => (
                  <span key={field.key} className="badge">
                    {field.label}
                  </span>
                ))}
              </div>
              <p className="mt-3 text-[11.5px] leading-relaxed faint">
                Unknown columns are kept in the asset record and shown in the detail drawer, so no source information is lost. Mapping is manual only where the heading
                differs from common naming.
              </p>
            </div>
          </Card>

          <Card>
            <CardHeader title="Processing rules" subtitle="Built for unfamiliar workbooks" />
            <div className="space-y-3 p-5">
              {[
                { icon: Sparkles, title: 'Header row detection', text: 'The header row is located even when the sheet starts with titles or merged rows.' },
                { icon: FileSpreadsheet, title: 'Worksheet selection', text: 'Every sheet is listed with its row count; the richest asset sheet is selected first.' },
                { icon: ShieldCheck, title: 'Local only', text: 'Files never leave the browser. The last dataset is remembered in LocalStorage.' },
              ].map((item) => {
                const Icon = item.icon
                return (
                  <div key={item.title} className="flex gap-2.5">
                    <span className="mt-0.5 grid h-7 w-7 flex-none place-items-center rounded-[7px]" style={{ background: 'var(--panel-2)', color: 'var(--text-2)' }}>
                      <Icon size={13} />
                    </span>
                    <div>
                      <div className="text-[12px] font-medium">{item.title}</div>
                      <div className="text-[11.5px] faint">{item.text}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>

          {dataset ? (
            <Card>
              <CardHeader title="Current dataset" subtitle={`${dataset.fileName} · ${formatDate(dataset.importedAt)}`} />
              <div className="p-5 pt-2 text-[12px]">
                <div className="flex justify-between border-b py-2">
                  <span className="faint">Worksheet</span>
                  <span className="font-medium">{dataset.sheetName}</span>
                </div>
                <div className="flex justify-between border-b py-2">
                  <span className="faint">Assets loaded</span>
                  <span className="mono font-medium">{dataset.rows.length}</span>
                </div>
                <div className="flex justify-between border-b py-2">
                  <span className="faint">Columns mapped</span>
                  <span className="mono font-medium">{Object.keys(dataset.mapping).length}</span>
                </div>
                <div className="flex justify-between border-b py-2">
                  <span className="faint">Ticket sheet</span>
                  <span className="font-medium">{dataset.tickets?.sheetName || 'not detected'}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="faint">Maintenance sheet</span>
                  <span className="font-medium">{dataset.maintenance?.sheetName || 'not detected'}</span>
                </div>
                <button type="button" className="btn btn-sm mt-3 w-full" onClick={onRemoveDataset} style={{ color: 'var(--red)' }}>
                  Remove saved dataset
                </button>
              </div>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  )
}
