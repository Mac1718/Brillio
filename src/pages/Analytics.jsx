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
import { AlertTriangle, CalendarRange, CheckCircle2, ClipboardList, Clock, MapPin, PiggyBank, Scale, TrendingUp, Wallet } from 'lucide-react'
import { Card, CardHeader, EmptyState, KpiCard, PageHeader, SectionTitle } from '../components/ui'
import { api, toQueryString } from '../lib/api'
import { formatCurrency } from '../lib/format'
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

export default function Analytics({ refreshKey = 0, settings }) {
  const [filters, setFilters] = useState({ year: '', quarter: '', status: '', vendorId: '', city: '', department: '', projectId: '', category: '', costType: '' })
  const [data, setData] = useState(null)
  const [meta, setMeta] = useState({ vendors: [], cities: [], years: [], departments: [], projects: [], categories: [], costTypes: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .get('/assessments/filters')
      .then(setMeta)
      .catch(() => setMeta({ vendors: [], cities: [], years: [], departments: [], projects: [], categories: [], costTypes: [] }))
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

  const financial = data?.financial
  const currency = 'INR'
  const spendShare = financial?.totals?.budget
    ? Math.round((financial.totals.spend / financial.totals.budget) * 100)
    : null
  const financialGroups = [
    { title: 'Department-wise Financials', rows: financial?.byDepartment || [] },
    { title: 'Vendor-wise Financials', rows: financial?.byVendor || [] },
    { title: 'Project-wise Financials', rows: financial?.byProject || [] },
    { title: 'Category-wise Financials', rows: financial?.byCategory || [] },
  ]

  const hasRecords = (data?.totalRecords || 0) > 0
  const hasFiltered = (totals?.total || 0) > 0

  return (
    <div className="fade-in">
      <PageHeader
        title="Quarterly & Yearly Analytics"
        description="Every figure is computed from the PO Date stored on each record. Quarter boundaries: Q1 Jan–Mar, Q2 Apr–Jun, Q3 Jul–Sep, Q4 Oct–Dec."
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
          <select className="input input-auto" value={filters.department} onChange={update('department')}>
            <option value="">All departments</option>
            {(meta.departments || []).map((department) => <option key={department} value={department}>{department}</option>)}
          </select>
          <select className="input input-auto" value={filters.projectId} onChange={update('projectId')}>
            <option value="">All projects</option>
            {(meta.projects || []).map((project) => <option key={project.id} value={project.id}>{project.name || project.id}</option>)}
          </select>
          <select className="input input-auto" value={filters.category} onChange={update('category')}>
            <option value="">All categories</option>
            {(meta.categories || []).map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
          <select className="input input-auto" value={filters.costType} onChange={update('costType')}>
            <option value="">All cost types</option>
            {(meta.costTypes || []).map((costType) => <option key={costType} value={costType}>{costType}</option>)}
          </select>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => setFilters({ year: '', quarter: '', status: '', vendorId: '', city: '', department: '', projectId: '', category: '', costType: '' })}
          >
            Reset
          </button>
        </div>
      </Card>

      {error ? <div className="card p-5 text-[12.5px]" style={{ color: 'var(--red)' }}>{error}</div> : null}

      {!error && (data?.unclassifiedCount || 0) > 0 ? (
        <div
          className="mb-4 flex items-start gap-2 rounded-[10px] px-3 py-2.5 text-[12px]"
          style={{ background: 'var(--amber-soft)', color: 'var(--amber)' }}
        >
          <AlertTriangle size={14} className="mt-0.5 flex-none" />
          <div>
            <span className="font-semibold">{data.unclassifiedCount} record{data.unclassifiedCount === 1 ? '' : 's'} without a valid PO Date</span>{' '}
            are excluded from the quarterly and yearly figures because a period cannot be derived for them. Add or correct the PO Date in
            Assessment Records to include them.
          </div>
        </div>
      ) : null}

      {!error && !hasRecords && !loading ? (
        <Card>
          <EmptyState
            icon={CalendarRange}
            title="No assessments to analyse yet"
            description="Import an Excel register that includes a PO Date column, or add records manually. Analytics appear as soon as records exist."
          />
        </Card>
      ) : null}

      {hasRecords && !hasFiltered && !loading ? (
        <Card>
          <EmptyState
            icon={ClipboardList}
            title="No records match these filters"
            description={
              (data?.unclassifiedCount || 0) > 0
                ? 'Records without a readable PO Date cannot be placed in a quarter. Correct their PO Date in Assessment Records, or widen the filters.'
                : 'Widen the year, quarter, vendor, city or status filters to see assessments.'
            }
          />
        </Card>
      ) : null}

      {hasFiltered ? (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard label="Total Assessments" value={totals.total} tone="brand" icon={ClipboardList} foot={`${data.activeYear || 'All years'}${filters.quarter ? ` · ${filters.quarter}` : ''}`} />
            <KpiCard label="Completed" value={totals.completed} tone="green" icon={CheckCircle2} foot={totals.completionRate != null ? `${totals.completionRate}% completion` : '—'} />
            <KpiCard label="Pending" value={totals.pending} tone="amber" icon={Clock} foot={`${totals.inProgress} in progress`} />
            <KpiCard label="Vendors / Cities" value={`${totals.vendors} / ${totals.cities}`} tone="neutral" icon={MapPin} foot={totals.span ? `${totals.span.from}–${totals.span.to}` : '—'} />
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
              <CardHeader title="Quarter Comparison" subtitle="Assessments per quarter for the selected filters" />
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
              <CardHeader title="Year-over-Year" subtitle="Totals per PO Date financial year (year filter ignored here)" />
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
              <CardHeader title="Completion Trend" subtitle={`Assessments by PO Date month in ${data.activeYear ?? 'the selected year'}`} />
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
              <CardHeader title="Status Distribution" subtitle="Across the current filters" />
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
              { title: 'Vendor-wise Assessments', subtitle: 'By vendor on each record', rows: data.byVendor, icon: TrendingUp },
              { title: 'City-wise Assessments', subtitle: 'Vendor city on each record', rows: data.byCity, icon: MapPin },
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

          {financial?.hasFinancialData ? (
            <>
              <SectionTitle hint="Read from the recorded fields — budget, spend, savings and excess are never recalculated">
                Financials · {filters.year || 'all years'}
              </SectionTitle>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <KpiCard
                  label="Total Budget FY"
                  value={formatCurrency(financial.totals.budget, currency, true)}
                  tone="brand"
                  icon={Wallet}
                  foot={`Q1–Q4 costs ${formatCurrency(financial.totals.costTotal, currency, true)}`}
                />
                <KpiCard
                  label="Spend FY"
                  value={formatCurrency(financial.totals.spend, currency, true)}
                  tone="green"
                  icon={TrendingUp}
                  foot={spendShare != null ? `${spendShare}% of budget` : 'No budget recorded'}
                />
                <KpiCard
                  label="Savings"
                  value={formatCurrency(financial.totals.savings, currency, true)}
                  tone="green"
                  icon={PiggyBank}
                  foot="As recorded in the register"
                />
                <KpiCard
                  label="Excess"
                  value={formatCurrency(financial.totals.excess, currency, true)}
                  tone="amber"
                  icon={Scale}
                  foot="As recorded in the register"
                />
              </div>

              <div className="mt-4 grid gap-4 xl:grid-cols-2">
                <Card>
                  <CardHeader title="Quarterly Cost Comparison" subtitle="Cost Q1–Q4 for the selected filters" />
                  <div className="h-[250px] p-3">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={financial.quarters}>
                        <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} tickFormatter={(value) => formatCurrency(value, currency, true)} />
                        <Tooltip {...chartTooltip} formatter={(value) => formatCurrency(value, currency)} />
                        <Bar dataKey="cost" name="Cost" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                <Card>
                  <CardHeader title="Budget vs Actual Spend" subtitle="Top departments by recorded budget" />
                  <div className="h-[250px] p-3">
                    {financial.byDepartment.length ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={financial.byDepartment.slice(0, 6)} barGap={3}>
                          <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                          <XAxis dataKey="name" tick={{ fontSize: 10.5, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} interval={0} />
                          <YAxis tick={{ fontSize: 11, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} tickFormatter={(value) => formatCurrency(value, currency, true)} />
                          <Tooltip {...chartTooltip} formatter={(value) => formatCurrency(value, currency)} />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                          <Bar dataKey="budget" name="Budget" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="spend" name="Spend" fill="var(--chart-4)" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : <div className="grid h-full place-items-center text-[12px] faint">No department values</div>}
                  </div>
                </Card>
              </div>

              <div className="mt-4 grid gap-4 xl:grid-cols-2">
                {financialGroups.map((panel) => (
                  <Card key={panel.title}>
                    <CardHeader title={panel.title} />
                    <div className="table-scroll">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Name</th>
                            <th className="text-right">Budget</th>
                            <th className="text-right">Spend</th>
                            <th className="text-right">Cost Q1–Q4</th>
                            <th className="text-right">Savings</th>
                            <th className="text-right">Excess</th>
                          </tr>
                        </thead>
                        <tbody>
                          {panel.rows.length ? panel.rows.map((row) => (
                            <tr key={row.name}>
                              <td className="max-w-[200px] truncate">{row.name}</td>
                              <td className="mono text-right">{formatCurrency(row.budget, currency)}</td>
                              <td className="mono text-right">{formatCurrency(row.spend, currency)}</td>
                              <td className="mono text-right">{formatCurrency(row.cost, currency)}</td>
                              <td className="mono text-right">{formatCurrency(row.savings, currency)}</td>
                              <td className="mono text-right">{formatCurrency(row.excess, currency)}</td>
                            </tr>
                          )) : (
                            <tr><td colSpan={6} className="py-5 text-center text-[12px] faint">No values</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                ))}
              </div>
            </>
          ) : (
            <Card className="mt-4">
              <CardHeader title="Financial Analytics" subtitle="Cost Q1–Q4, budget and spend by department, vendor, project and category" />
              <div className="p-4 text-[12px] muted">
                No financial values are recorded for the selected filters yet. Add Cost Q1–Q4, Total Budget FY, Spend FY, Savings or Excess
                through manual entry or an Excel import and the quarterly comparisons appear here.
              </div>
            </Card>
          )}

          <Card className="mt-4">
            <CardHeader title="Quarterly Summary Table" subtitle="Assessments, completion and value by PO Date quarter" />
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
