import {
  Building2,
  Cpu,
  FileText,
  LayoutDashboard,
  Laptop,
  Settings,
  ShieldCheck,
  Table,
  UploadCloud,
  Wallet,
  X,
} from 'lucide-react'
import { formatDate } from '../lib/format'

const NAV_GROUPS = [
  {
    label: 'Workspace',
    items: [
      { id: 'overview', label: 'Overview', icon: LayoutDashboard },
      { id: 'inventory', label: 'Asset Inventory', icon: Table },
      { id: 'devices', label: 'Desktop & Laptop', icon: Laptop },
      { id: 'hardware', label: 'Hardware Components', icon: Cpu },
    ],
  },
  {
    label: 'Analysis',
    items: [
      { id: 'departments', label: 'Department Analytics', icon: Building2 },
      { id: 'warranty', label: 'Warranty & Maintenance', icon: ShieldCheck },
      { id: 'costs', label: 'Cost & Purchases', icon: Wallet },
      { id: 'reports', label: 'Reports', icon: FileText },
    ],
  },
  {
    label: 'Data',
    items: [
      { id: 'upload', label: 'Excel Upload', icon: UploadCloud },
      { id: 'settings', label: 'Settings', icon: Settings },
    ],
  },
]

export default function Sidebar({ page, onNavigate, dataset, assetCount, open, onClose }) {
  return (
    <>
      {open ? <div className="sidebar-scrim lg:hidden" onClick={onClose} /> : null}
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <div className="brand-lockup flex-1">
            <span className="brand-wordmark" aria-label="brillo">
              bri<span className="brand-ll">
                ll<span className="brand-dots" aria-hidden="true"><i /><i /></span>
              </span>
              o
            </span>
            <span className="brand-tagline">IT Asset Management</span>
          </div>
          <button type="button" className="lg:hidden" onClick={onClose} aria-label="Close navigation" style={{ color: 'var(--sidebar-muted)' }}>
            <X size={17} />
          </button>
        </div>

        <nav className="nav-scroll">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <div className="nav-group-label">{group.label}</div>
              {group.items.map((item) => {
                const Icon = item.icon
                const isActive = page === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`nav-item ${isActive ? 'active' : ''}`}
                    onClick={() => {
                      onNavigate(item.id)
                      onClose()
                    }}
                  >
                    <Icon size={16} strokeWidth={1.8} />
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.id === 'inventory' && assetCount ? <span className="nav-badge">{assetCount}</span> : null}
                    {isActive ? <span className="h-1.5 w-1.5 rounded-full" style={{ background: '#57d788' }} /> : null}
                  </button>
                )
              })}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          {dataset ? (
            <button type="button" className="sidebar-dataset w-full text-left" onClick={() => onNavigate('upload')}>
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 flex-none rounded-full" style={{ background: 'var(--brand-dot)' }} />
                <span className="truncate text-[11px] font-medium uppercase tracking-[0.08em]" style={{ color: 'var(--sidebar-muted)' }}>
                  Active dataset
                </span>
              </div>
              <div className="mt-1.5 truncate text-[12px] font-medium text-white" title={dataset.fileName}>
                {dataset.fileName}
              </div>
              <div className="mt-0.5 text-[10.5px]" style={{ color: 'var(--sidebar-muted)' }}>
                {assetCount} assets · {formatDate(dataset.importedAt)}
              </div>
            </button>
          ) : (
            <button
              type="button"
              className="w-full rounded-[11px] px-3 py-2.5 text-left"
              style={{ background: 'var(--sidebar-2)', border: '1px dashed var(--sidebar-line)' }}
              onClick={() => onNavigate('upload')}
            >
              <div className="text-[12px] font-medium text-white">No dataset loaded</div>
              <div className="mt-0.5 text-[10.5px]" style={{ color: 'var(--sidebar-muted)' }}>
                Upload an Excel file to begin
              </div>
            </button>
          )}
        </div>
      </aside>
    </>
  )
}
