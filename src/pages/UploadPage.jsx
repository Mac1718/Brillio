import { useCallback, useEffect, useState } from 'react'
import { FileSpreadsheet, History, ShieldCheck, Sparkles } from 'lucide-react'
import ImportPanel from '../components/ImportPanel'
import { Card, CardHeader, PageHeader } from '../components/ui'
import { api } from '../lib/api'
import { useAuth } from '../auth/AuthContext'
import { ASSET_FIELDS } from '../lib/fields'

export default function UploadPage({ onImported, notify }) {
  const { isAdmin } = useAuth()
  const [imports, setImports] = useState([])

  const loadImports = useCallback(async () => {
    if (!isAdmin) return
    try {
      const data = await api.get('/assessments/imports')
      setImports(data.items)
    } catch {
      setImports([])
    }
  }, [isAdmin])

  useEffect(() => {
    loadImports()
  }, [loadImports])

  return (
    <div className="fade-in">
      <PageHeader
        title="Excel Upload"
        description="Import an assessment register, check every row against the validation rules, then save it to the database. Dashboards and analytics update from the stored records."
      />

      <div className="grid gap-4 xl:grid-cols-[1.7fr_1fr] xl:items-start">
        <div>
          <ImportPanel
            notify={notify}
            onImported={() => {
              loadImports()
              onImported?.()
            }}
          />
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="What Gets Detected" subtitle="Headings matched to validated fields" />
            <div className="p-5">
              <div className="flex flex-wrap gap-1.5">
                {ASSET_FIELDS.map((field) => (
                  <span key={field.key} className="badge">
                    {field.label}
                    {field.key === 'poDate' ? ' *' : ''}
                  </span>
                ))}
              </div>
              <p className="mt-3 text-[11.5px] leading-relaxed faint">
                PO Date and Asset ID (or Serial Number) are mandatory. Rows missing either are listed as invalid and are never written to the database.
              </p>
            </div>
          </Card>

          <Card>
            <CardHeader title="Import Rules" subtitle="Applied on the server for uploads and manual entry" />
            <div className="space-y-3 p-5">
              {[
                { icon: Sparkles, title: 'PO Date is the source of truth', text: 'The financial year and quarter come from the PO Date, never from the upload date, the creation date, the PR Date or today’s date.' },
                { icon: ShieldCheck, title: 'No silent corrections', text: 'Missing or unreadable dates are flagged for correction instead of being given an invented quarter.' },
                { icon: FileSpreadsheet, title: 'Duplicates are blocked', text: 'The same asset or project with the same PO Date is rejected on import and on manual entry.' },
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

          {isAdmin && imports.length ? (
            <Card>
              <CardHeader title="Import History" subtitle="Most recent first" action={<History size={14} className="faint" />} />
              <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {imports.slice(0, 8).map((item) => (
                  <div key={item.id} className="px-4 py-2.5">
                    <div className="truncate text-[12px] font-medium" title={item.fileName}>{item.fileName}</div>
                    <div className="mt-0.5 text-[11px] faint">
                      {new Date(item.createdAt).toLocaleString('en-GB')} · {item.importedCount} imported · {item.duplicateCount} duplicates · {item.invalidCount} invalid
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  )
}
