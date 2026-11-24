import { useEffect, useMemo, useRef, useState } from 'react'
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
import { DEFAULT_SETTINGS } from './lib/format'
import { usePersistentState, useTheme } from './lib/storage'
import { buildAssets, buildMaintenance, buildTickets } from './lib/normalize'

const TITLES = {
  overview: 'Overview',
  inventory: 'Asset Inventory',
  devices: 'Desktop & Laptop Management',
  hardware: 'Hardware Components',
  departments: 'Department Analytics',
  warranty: 'Warranty & Maintenance',
  costs: 'Cost & Purchase Analytics',
  reports: 'Reports',
  upload: 'Excel Upload',
  settings: 'Settings',
}

export default function App() {
  const [dataset, setDataset] = usePersistentState('itam.dataset.v1', null)
  const [storedSettings, setSettings] = usePersistentState('itam.settings.v2', DEFAULT_SETTINGS)
  const [theme, setTheme] = usePersistentState('itam.theme.v1', 'light')
  const [page, setPage] = useState('overview')
  const [menuOpen, setMenuOpen] = useState(false)
  const [selected, setSelected] = useState(null)
  const [toast, setToast] = useState(null)
  const toastTimer = useRef(null)

  const settings = useMemo(() => ({ ...DEFAULT_SETTINGS, ...storedSettings }), [storedSettings])
  useTheme(theme, setTheme)

  const assets = useMemo(() => (dataset ? buildAssets(dataset, settings) : []), [dataset, settings])
  const tickets = useMemo(() => (dataset?.tickets ? buildTickets(dataset.tickets, settings) : []), [dataset, settings])
  const maintenanceRecords = useMemo(
    () => (dataset?.maintenance ? buildMaintenance(dataset.maintenance, settings) : []),
    [dataset, settings],
  )

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [page])

  useEffect(() => () => clearTimeout(toastTimer.current), [])

  const notify = (message) => {
    setToast(message)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 2800)
  }

  const navigate = (next) => {
    setPage(next)
    setMenuOpen(false)
  }

  const handleImport = (nextDataset) => {
    setDataset(nextDataset)
    setSelected(null)
    setPage('overview')
    notify(`Loaded ${nextDataset.rows.length} assets from ${nextDataset.fileName}`)
  }

  const handleRemoveDataset = () => {
    setDataset(null)
    setSelected(null)
    setPage('upload')
    notify('Saved dataset removed')
  }

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark')

  const pageProps = {
    assets,
    dataset,
    settings,
    tickets,
    maintenanceRecords,
    navigate,
    onSelect: setSelected,
    notify,
    onRemoveDataset: handleRemoveDataset,
  }

  return (
    <div className="app-shell">
      <Sidebar page={page} onNavigate={navigate} dataset={dataset} assetCount={assets.length} open={menuOpen} onClose={() => setMenuOpen(false)} />

      <div className="main">
        <Topbar
          title={!dataset && page !== 'upload' && page !== 'settings' ? TITLES.overview : TITLES[page]}
          dataset={dataset}
          theme={theme === 'dark' ? 'dark' : 'light'}
          onToggleTheme={toggleTheme}
          onMenu={() => setMenuOpen(true)}
          onUpload={() => navigate('upload')}
        />

        <main className="page-body">
          {!dataset && page !== 'upload' && page !== 'settings' ? (
            <Overview {...pageProps} />
          ) : (
            <>
              {page === 'overview' && <Overview {...pageProps} />}
              {page === 'inventory' && dataset && <InventoryPage {...pageProps} />}
              {page === 'devices' && dataset && <Devices {...pageProps} />}
              {page === 'hardware' && dataset && <Hardware {...pageProps} />}
              {page === 'departments' && dataset && <Departments {...pageProps} />}
              {page === 'warranty' && dataset && <Warranty {...pageProps} />}
              {page === 'costs' && dataset && <Costs {...pageProps} />}
              {page === 'reports' && dataset && <Reports {...pageProps} />}
              {page === 'upload' && <UploadPage dataset={dataset} settings={settings} onImport={handleImport} notify={notify} onRemoveDataset={handleRemoveDataset} />}
              {page === 'settings' && (
                <Settings
                  settings={settings}
                  setSettings={setSettings}
                  dataset={dataset}
                  theme={theme}
                  setTheme={setTheme}
                  navigate={navigate}
                  onRemoveDataset={handleRemoveDataset}
                />
              )}
            </>
          )}
        </main>
      </div>

      {selected ? <AssetDrawer asset={selected} settings={settings} onClose={() => setSelected(null)} /> : null}
      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  )
}
