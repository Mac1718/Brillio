import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { CalendarRange, CheckCircle2, ClipboardList, Clock, MapPin, TrendingUp } from 'lucide-react'
import { Card, CardHeader, EmptyState, KpiCard, PageHeader } from '../components/ui'
import { api, toQueryString } from '../lib/api'
import { QUARTERS, QUARTER_RANGES } from '../lib/quarters'

const CHART_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)', 'var(--chart-7)']

const STATUS_COLORS = {
  Completed: 'var(--green)',
  Pending: 'var(--amber)',
  'In Progress': 'var(--blue)',
  Cancelled: 'var(--text-3)',
}

const chartTooltip = {
  contentStyle: {
    background: 'var(--panel)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    fontSize: 11.5,
    color: 'var(--text)',
  },
  labelStyle: { color: 'var(--text-2)', fontSize: 11 },
}

export default function Analytics({ refreshKey = 0 }) {
  const [filters, setFilters] = useState({ year: '', quarter: '', status: '', vendorId: '', city: '' })
  const [data, setData] = useState(null)
  const [meta, setMeta] = useState({ vendors: [], cities: [], years: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .get('/assessments/filters')
      .then(setMeta)
      .catch(() => setMeta({ vendors: [], cities: [], years: [] }))
  }, [refreshKey])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setData(await api.get(`/analytics${toQueryString(filters)}`))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    load()
  }, [load, refreshKey])

  const years = data?.availableYears?.length ? data.availableYears : meta.years

  const update = (key) => (event) => setFilters((prev) => ({ ...prev, [key]: event.target.value }))

  const totals = data?.totals
  const quarterChart = useMemo(
    () => (data?.quarters || []).map((row) => ({ name: row.quarter, Total: row.total, Completed: row.completed, Pending: row.pending })),
    [data],
  )
  const yearChart = useMemo(
    () => (data?.byYear || []).map((row) => ({ name: String(row.year), Total: row.total, Completed: row.completed })),
    [data],
  )
  const statusChart = useMemo(
    () => (data?.byStatus || []).map((row) => ({ name: row.name, value: row.value })),
    [data],
  )

  const hasRecords = (data?.totalRecords || 0) > 0
  const hasFiltered = (totals?.total || 0) > 0

  return (
    <div className="fade-in">
      <PageHeader
        title="Quarterly & yearly analytics"
        description="Every figure is computed from the assessment date stored on each record. Quarter boundaries: Q1 Jan–Mar, Q2 Apr–Jun, Q3 Jul–Sep, Q4 Oct–Dec."
        actions={
          <button type="button" className="btn" onClick={load} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        }
      />

      <Card className="mb-4">
        <div className="filter-bar">
          <select className="input input-auto" value={filters.year} onChange={update('year')}>
            <option value="">All years</option>
            {years.map((year) => <option key={year} value={year}>{year}</option>)}
          </select>
          <select className="input input-auto" value={filters.quarter} onChange={update('quarter')}>
            <option value="">All quarters</option>
            {QUARTERS.map((quarter) => <option key={quarter} value={quarter}>{quarter} · {QUARTER_RANGES[quarter]}</option>)}
          </select>
          <select className="input input-auto" value={filters.status} onChange={update('status')}>
            <option value="">All statuses</option>
            {['Pending', 'In Progress', 'Completed', 'Cancelled'].map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
          <select className="input input-auto" value={filters.vendorId} onChange={update('vendorId')}>
            <option value="">All vendors</option>
            {meta.vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}
          </select>
          <select className="input input-auto" value={filters.city} onChange={update('city')}>
            <option value="">All cities</option>
            {meta.cities.map((city) => <option key={city} value={city}>{city}</option>)}
          </select>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => setFilters({ year: '', quarter: '', status: '', vendorId: '', city: '' })}
          >
            Reset
          </button>
        </div>
      </Card>

      {error ? <div className="card p-5 text-[12.5px]" style={{ color: 'var(--red)' }}>{error}</div> : null}

      {!error && !hasRecords && !loading ? (
        <Card>
          <EmptyState
            icon={CalendarRange}
            title="No assessments to analyse yet"
            description="Import an Excel register that includes an Assessment Date column, or add records manually. Analytics appear as soon as records exist."
          />
        </Card>
      ) : null}

      {hasRecords && !hasFiltered && !loading ? (
        <Card>
          <EmptyState
            icon={ClipboardList}
            title="No records match these filters"
            description="Widen the year, quarter, vendor, city or status filters to see assessments."
          />
        </Card>
      ) : null}

      {hasFiltered ? (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard label="Total assessments" value={totals.total} tone="brand" icon={ClipboardList} foot={`${data.activeYear || 'All years'}${filters.quarter ? ` · ${filters.quarter}` : ''}`} />
            <KpiCard label="Completed" value={totals.completed} tone="green" icon={CheckCircle2} foot={totals.completionRate != null ? `${totals.completionRate}% completion` : '—'} />
            <KpiCard label="Pending" value={totals.pending} tone="amber" icon={Clock} foot={`${totals.inProgress} in progress`} />
            <KpiCard label="Vendors / cities" value={`${totals.vendors} / ${totals.cities}`} tone="neutral" icon={MapPin} foot={totals.span ? `${totals.span.from}–${totals.span.to}` : '—'} />
          </div>

          <div className="grid gap-4 xl:grid-cols-4">
            {data.quarters.map((quarter) => (
              <Card key={quarter.quarter} className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.08em] faint">{quarter.quarter}</div>
                    <div className="mt-0.5 text-[10.5px] faint">{QUARTER_RANGES[quarter.quarter]}</div>
                  </div>
                  <span className="text-[10px] font-semibold" style={{ color: quarter.total ? 'var(--accent)' : 'var(--text-3)' }}>
                    {quarter.completionRate != null ? `${quarter.completionRate}%` : '—'}
                  </span>
                </div>
                <div className="mono mt-3 text-[24px] font-semibold tracking-[-0.02em]">{quarter.total}</div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--panel-2)' }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${quarter.total ? (quarter.completed / quarter.total) * 100 : 0}%`,
                      background: 'var(--accent)',
                    }}
                  />
                </div>
                <div className="mt-2 flex justify-between text-[10.5px] faint">
                  <span>{quarter.completed} completed</span>
                  <span>{quarter.pending} pending</span>
                </div>
              </Card>
            ))}
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader title="Quarter comparison" subtitle="Assessments per quarter for the selected filters" />
              <div className="h-[260px] p-3">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={quarterChart} barGap={4}>
                    <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} />
                    <Tooltip {...chartTooltip} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="Total" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Completed" fill="var(--chart-4)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Pending" fill="var(--chart-8)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card>
              <CardHeader title="Year-over-year" subtitle="Totals per assessment year (year filter ignored here)" />
              <div className="h-[260px] p-3">
                {yearChart.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={yearChart}>
                      <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} />
                      <Tooltip {...chartTooltip} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="Total" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Completed" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <div className="grid h-full place-items-center text-[12px] faint">No dated records</div>}
              </div>
            </Card>

            <Card>
              <CardHeader title="Completion trend" subtitle={`Monthly assessments in ${data.activeYear ?? 'the selected year'}`} />
              <div className="h-[250px] p-3">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.monthly}>
                    <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} />
                    <Tooltip {...chartTooltip} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="total" name="Assessed" stroke="var(--chart-1)" strokeWidth={2} dot={{ r: 2.5 }} />
                    <Line type="monotone" dataKey="completed" name="Completed" stroke="var(--chart-4)" strokeWidth={2} dot={{ r: 2.5 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card>
              <CardHeader title="Status distribution" subtitle="Across the current filters" />
              <div className="h-[250px] p-3">
                {statusChart.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={statusChart} dataKey="value" nameKey="name" innerRadius={52} outerRadius={86} paddingAngle={2}>
                        {statusChart.map((entry) => (
                          <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || 'var(--chart-5)'} />
                        ))}
                      </Pie>
                      <Tooltip {...chartTooltip} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <div className="grid h-full place-items-center text-[12px] faint">No records</div>}
              </div>
            </Card>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-3">
            {[
              { title: 'Vendor-wise assessments', subtitle: 'By vendor on each record', rows: data.byVendor, icon: TrendingUp },
              { title: 'City-wise assessments', subtitle: 'Vendor city on each record', rows: data.byCity, icon: MapPin },
              { title: 'Department-wise', subtitle: 'Department on each record', rows: data.byDepartment, icon: ClipboardList },
            ].map((panel) => (
              <Card key={panel.title}>
                <CardHeader title={panel.title} subtitle={panel.subtitle} />
                <div className="p-4 pt-2">
                  {panel.rows.length ? (
                    panel.rows.map((row, index) => {
                      const max = panel.rows[0].value || 1
                      return (
                        <div key={row.name} className="py-1.5">
                          <div className="flex items-center justify-between text-[12px]">
                            <span className="truncate">{row.name}</span>
                            <span className="mono text-[11.5px] faint">{row.value}</span>
                          </div>
                          <div className="mt-1 h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--panel-2)' }}>
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${(row.value / max) * 100}%`, background: CHART_COLORS[index % CHART_COLORS.length] }}
                            />
                          </div>
                        </div>
                      )
                    })
                  ) : <div className="py-6 text-center text-[12px] faint">No data</div>}
                </div>
              </Card>
            ))}
          </div>

          <Card className="mt-4">
            <CardHeader title="Quarterly summary table" subtitle="Assessments, completion and value by quarter" />
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Quarter</th>
                    <th>Period</th>
                    <th className="text-right">Total</th>
                    <th className="text-right">Completed</th>
                    <th className="text-right">Pending</th>
                    <th className="text-right">In progress</th>
                    <th className="text-right">Completion</th>
                  </tr>
                </thead>
                <tbody>
                  {data.quarters.map((row) => (
                    <tr key={row.quarter}>
                      <td className="font-medium">{row.quarter}</td>
                      <td className="faint">{QUARTER_RANGES[row.quarter]}</td>
                      <td className="mono text-right">{row.total}</td>
                      <td className="mono text-right">{row.completed}</td>
                      <td className="mono text-right">{row.pending}</td>
                      <td className="mono text-right">{row.inProgress}</td>
                      <td className="mono text-right">{row.completionRate != null ? `${row.completionRate}%` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      ) : null}
    </div>
  )
}
