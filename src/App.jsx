import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Sidebar from './components/Sidebar'
import Topbar from './components/Topbar'
import AssetDrawer from './components/AssetDrawer'
import Overview from './pages/Overview'
import InventoryPage from './pages/InventoryPage'
import Devices from './pages/Devices'
import Hardware from './pages/Hardware'
import Departments from './pages/Departments'
import Warranty from './pages/Warranty'
import Costs from './pages/Costs'
import Reports from './pages/Reports'
import UploadPage from './pages/UploadPage'
import Settings from './pages/Settings'
import Login from './pages/Login'
import Assessments from './pages/Assessments'
import Analytics from './pages/Analytics'
import Vendors from './pages/Vendors'
import Sam from './pages/Sam'
import Users from './pages/Users'
import { DEFAULT_SETTINGS } from './lib/format'
import { usePersistentState, useTheme } from './lib/storage'
import { datasetFromRecords, recordToAsset } from './lib/records'
import { buildMaintenance, buildTickets } from './lib/normalize'
import { api } from './lib/api'
import { useAuth } from './auth/AuthContext'

const TITLES = {
  overview: 'Overview',
  assessments: 'Assessment Records',
  analytics: 'Quarterly & Yearly Analytics',
  inventory: 'Asset Inventory',
  devices: 'Desktop & Laptop Management',
  hardware: 'Hardware Components',
  departments: 'Department Analytics',
  warranty: 'Warranty & Maintenance',
  costs: 'Cost & Purchase Analytics',
  reports: 'Reports',
  vendors: 'Vendors',
  sam: 'SAM – Software Asset Management',
  upload: 'Excel Upload',
  users: 'Create Users',
  settings: 'Settings',
}

const PAGE_SIZE = 200

export default function App() {
  const { user, loading, isAdmin, logout } = useAuth()
  const [records, setRecords] = useState([])
  const [extras, setExtras] = useState({ tickets: null, maintenance: null, meta: null })
  const [dataState, setDataState] = useState({ loading: false, error: '' })
  const [storedSettings, setSettings] = usePersistentState('itam.settings.v2', DEFAULT_SETTINGS)
  const [theme, setTheme] = usePersistentState('itam.theme.v1', 'light')
  const [page, setPage] = useState('overview')
  const [menuOpen, setMenuOpen] = useState(false)
  const [selected, setSelected] = useState(null)
  const [toast, setToast] = useState(null)
  const [refreshToken, setRefreshToken] = useState(0)
  const toastTimer = useRef(null)

  const settings = useMemo(() => ({ ...DEFAULT_SETTINGS, ...storedSettings }), [storedSettings])
  useTheme(theme, setTheme)

  const notify = useCallback((message) => {
    setToast(message)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 3200)
  }, [])

  const loadData = useCallback(async () => {
    if (!user) return
    setDataState({ loading: true, error: '' })
    try {
      const items = []
      let pageNumber = 1
      let total = Infinity
      while (items.length < total && pageNumber <= 50) {
        const data = await api.get(`/assessments?page=${pageNumber}&pageSize=${PAGE_SIZE}`)
        total = data.total
        items.push(...data.items)
        if (!data.items.length) break
        pageNumber += 1
      }
      const [supporting] = await Promise.all([api.get('/dataset').catch(() => ({ meta: null, tickets: null, maintenance: null }))])
      setRecords(items)
      setExtras(supporting)
      setDataState({ loading: false, error: '' })
    } catch (error) {
      setDataState({ loading: false, error: error.message })
    }
  }, [user])

  useEffect(() => {
    loadData()
  }, [loadData, refreshToken])

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [page])

  useEffect(() => () => clearTimeout(toastTimer.current), [])

  // Leaving an admin-only page (for example after a role change) clears it.
  useEffect(() => {
    if (!isAdmin && ['users', 'upload'].includes(page)) setPage('overview')
  }, [isAdmin, page])

  const assets = useMemo(() => records.map((record, index) => recordToAsset(record, index)), [records])
  const dataset = useMemo(
    () => (records.length ? datasetFromRecords(records, extras.meta || {}, extras) : null),
    [records, extras],
  )

  const tickets = useMemo(() => (extras.tickets?.rows ? buildTickets(extras.tickets, settings) : []), [extras.tickets, settings])
  const maintenanceRecords = useMemo(
    () => (extras.maintenance?.rows ? buildMaintenance(extras.maintenance, settings) : []),
    [extras.maintenance, settings],
  )

  const navigate = (next) => {
    setPage(next)
    setMenuOpen(false)
  }

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark')
  const refresh = () => setRefreshToken((value) => value + 1)

  if (loading) {
    return (
      <div className="app-splash">
        <span className="brand-wordmark" aria-label="brillo">
          bri<span className="brand-ll">
            ll<span className="brand-dots" aria-hidden="true"><i /><i /></span>
          </span>
          o
        </span>
        <p>Loading your workspace…</p>
      </div>
    )
  }

  if (!user) return <Login />

  const pageProps = {
    assets,
    dataset,
    settings,
    tickets,
    maintenanceRecords,
    navigate,
    onSelect: setSelected,
    notify,
    onRemoveDataset: null,
    refreshKey: refreshToken,
    onChanged: refresh,
  }

  const hasData = records.length > 0

  const renderPage = () => {
    if (page === 'overview') return <Overview {...pageProps} />
    if (page === 'assessments') return <Assessments notify={notify} refreshKey={refreshToken} onChanged={refresh} />
    if (page === 'analytics') return <Analytics refreshKey={refreshToken} settings={settings} />
    if (page === 'vendors') return <Vendors notify={notify} />
    if (page === 'sam') return <Sam notify={notify} refreshKey={refreshToken} />
    if (page === 'users' && isAdmin) return <Users notify={notify} />
    if (page === 'upload' && isAdmin) return <UploadPage notify={notify} onImported={refresh} />
    if (page === 'settings') {
      return (
        <Settings theme={theme} setTheme={setTheme} notify={notify} onCleared={refresh} />
      )
    }
    if (!hasData) {
      return (
        <div className="card p-6">
          <h2 className="text-[17px] font-semibold tracking-[-0.014em]">No assessment records available</h2>
          <p className="mt-1 max-w-xl text-[12.5px] muted">
            {isAdmin
              ? 'Upload an Excel file to get started. Every dashboard, chart and report is calculated only from records you import or enter.'
              : 'An administrator needs to upload an Excel file before this module has data.'}
          </p>
          {isAdmin ? (
            <div className="mt-4 flex gap-2">
              <button type="button" className="btn btn-primary" onClick={() => navigate('upload')}>Upload Excel</button>
              <button type="button" className="btn" onClick={() => navigate('assessments')}>Add manually</button>
            </div>
          ) : null}
        </div>
      )
    }
    if (page === 'inventory') return <InventoryPage {...pageProps} />
    if (page === 'devices') return <Devices {...pageProps} />
    if (page === 'hardware') return <Hardware {...pageProps} />
    if (page === 'departments') return <Departments {...pageProps} />
    if (page === 'warranty') return <Warranty {...pageProps} />
    if (page === 'costs') return <Costs {...pageProps} />
    if (page === 'reports') return <Reports {...pageProps} />
    return <Overview {...pageProps} />
  }

  return (
    <div className="app-shell">
      <Sidebar
        page={page}
        onNavigate={navigate}
        dataset={dataset}
        assetCount={assets.length}
        recordCount={records.length}
        isAdmin={isAdmin}
        user={user}
        onLogout={logout}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
      />

      <div className="main">
        <Topbar
          title={TITLES[page] || 'Overview'}
          dataset={dataset}
          theme={theme === 'dark' ? 'dark' : 'light'}
          onToggleTheme={toggleTheme}
          onMenu={() => setMenuOpen(true)}
          onUpload={isAdmin ? () => navigate('upload') : null}
          user={user}
        />

        <main className="page-body">
          {dataState.error ? (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[10px] px-3 py-2.5 text-[12px]" style={{ background: 'var(--red-soft)', color: 'var(--red)' }}>
              <span>Could not load assessment data: {dataState.error}</span>
              <button type="button" className="btn btn-sm" onClick={refresh}>Retry</button>
            </div>
          ) : null}
          {renderPage()}
        </main>
      </div>

      {selected ? <AssetDrawer asset={selected} settings={settings} onClose={() => setSelected(null)} /> : null}
      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  )
}
