import {
  BarChart3,
  Building2,
  ClipboardList,
  Cpu,
  FileText,
  LayoutDashboard,
  Laptop,
  LogOut,
  Package,
  Settings,
  ShieldCheck,
  Table,
  UploadCloud,
  UserPlus,
  Wallet,
  X,
} from 'lucide-react'
import { formatDate } from '../lib/format'

const NAV_GROUPS = [
  {
    label: 'Workspace',
    items: [
      { id: 'overview', label: 'Overview', icon: LayoutDashboard },
      { id: 'assessments', label: 'Assessment Records', icon: ClipboardList },
      { id: 'analytics', label: 'Quarterly Analytics', icon: BarChart3 },
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
    label: 'Manage',
    items: [
      { id: 'vendors', label: 'Vendors', icon: Building2 },
      { id: 'sam', label: 'SAM – Software Asset Management', icon: Package, long: true },
      { id: 'upload', label: 'Excel Upload', icon: UploadCloud, admin: true },
      { id: 'users', label: 'Create Users', icon: UserPlus, admin: true },
      { id: 'settings', label: 'Settings', icon: Settings },
    ],
  },
]

const ROLE_LABEL = { admin: 'Administrator', manager: 'Manager', user: 'Read-only user' }

export default function Sidebar({
  page,
  onNavigate,
  dataset,
  assetCount,
  recordCount,
  isAdmin,
  user,
  onLogout,
  open,
  onClose,
}) {
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
            <span className="brand-tagline">IT Assessment</span>
          </div>
          <button type="button" className="lg:hidden" onClick={onClose} aria-label="Close navigation" style={{ color: 'var(--sidebar-muted)' }}>
            <X size={17} />
          </button>
        </div>

        <nav className="nav-scroll">
          {NAV_GROUPS.map((group) => {
            const items = group.items.filter((item) => !item.admin || isAdmin)
            if (!items.length) return null
            return (
              <div key={group.label}>
                <div className="nav-group-label">{group.label}</div>
                {items.map((item) => {
                  const Icon = item.icon
                  const isActive = page === item.id
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`nav-item ${isActive ? 'active' : ''}`}
                      title={item.title || item.label}
                      onClick={() => {
                        onNavigate(item.id)
                        onClose()
                      }}
                    >
                      <Icon size={16} strokeWidth={1.8} className="flex-none" />
                      <span className={`flex-1 ${item.long ? 'nav-item-long' : 'truncate'}`}>{item.label}</span>
                      {item.id === 'assessments' && recordCount ? <span className="nav-badge">{recordCount}</span> : null}
                      {item.id === 'inventory' && assetCount ? <span className="nav-badge">{assetCount}</span> : null}
                      {isActive ? <span className="h-1.5 w-1.5 rounded-full" style={{ background: '#57d788' }} /> : null}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </nav>

        <div className="sidebar-footer">
          {dataset ? (
            <button type="button" className="sidebar-dataset w-full text-left" onClick={() => onNavigate(isAdmin ? 'upload' : 'assessments')}>
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 flex-none rounded-full" style={{ background: 'var(--brand-dot)' }} />
                <span className="truncate text-[11px] font-medium uppercase tracking-[0.08em]" style={{ color: 'var(--sidebar-muted)' }}>
                  Assessment database
                </span>
              </div>
              <div className="mt-1.5 truncate text-[12px] font-medium text-white" title={dataset.fileName}>
                {dataset.fileName}
              </div>
              <div className="mt-0.5 text-[10.5px]" style={{ color: 'var(--sidebar-muted)' }}>
                {recordCount} records · {assetCount} units · {formatDate(dataset.importedAt)}
              </div>
            </button>
          ) : (
            <div className="w-full rounded-[11px] px-3 py-2.5" style={{ background: 'var(--sidebar-2)', border: '1px dashed var(--sidebar-line)' }}>
              <div className="text-[12px] font-medium text-white">No records yet</div>
              <div className="mt-0.5 text-[10.5px]" style={{ color: 'var(--sidebar-muted)' }}>
                {isAdmin ? 'Upload Excel or add a record' : 'Waiting for an administrator'}
              </div>
            </div>
          )}

          <div className="sidebar-user">
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12px] font-medium text-white" title={user?.name}>{user?.name}</div>
              <div className="truncate text-[10.5px]" style={{ color: 'var(--sidebar-muted)' }}>
                {ROLE_LABEL[user?.role] || 'User'} · {user?.email}
              </div>
            </div>
            <button type="button" className="sidebar-logout" onClick={onLogout} title="Sign out" aria-label="Sign out">
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
