import { Database, Menu, Moon, Sun, UploadCloud } from 'lucide-react'

export default function Topbar({ title, dataset, theme, onToggleTheme, onMenu, onUpload, user }) {
  return (
    <header className="topbar no-print">
      <button type="button" className="icon-btn lg:hidden" onClick={onMenu} aria-label="Open navigation">
        <Menu size={17} />
      </button>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-semibold">{title}</div>
        <div className="hidden truncate text-[11px] faint sm:block">
          {dataset
            ? `${dataset.recordCount ?? dataset.rows.length} records · ${dataset.mapping.assessmentDate != null ? 'assessment dates stored' : 'no assessment dates'}`
            : 'No assessment records yet'}
        </div>
      </div>

      {dataset ? (
        <div className="hidden items-center gap-2 rounded-full border px-3 py-1.5 md:flex" style={{ background: 'var(--panel)', borderColor: 'var(--border)' }}>
          <Database size={13} style={{ color: 'var(--green)' }} />
          <span className="max-w-[190px] truncate text-[11.5px] font-medium" title={dataset.fileName}>
            {dataset.fileName}
          </span>
        </div>
      ) : null}

      {user ? (
        <div className="hidden items-center gap-2 sm:flex">
          <span className="badge">{user.role === 'admin' ? 'Admin' : user.role === 'manager' ? 'Manager' : 'User'}</span>
        </div>
      ) : null}

      <button type="button" className="icon-btn" onClick={onToggleTheme} aria-label="Toggle theme" title="Toggle light / dark">
        {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
      </button>
      {onUpload ? (
        <button type="button" className="btn btn-primary" onClick={onUpload}>
          <UploadCloud size={15} />
          <span className="hidden sm:inline">Upload Excel</span>
        </button>
      ) : null}
    </header>
  )
}
