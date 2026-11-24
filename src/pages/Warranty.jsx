import { useState } from 'react'
import { ShieldCheck, Timer, Wrench } from 'lucide-react'
import { Badge, Card, CardHeader, EmptyState, KpiCard, MissingNotice, PageHeader, SectionTitle, Segmented } from '../components/ui'
import { BarChartView, ChartFrame, DonutChart, NoChartData } from '../components/charts'
import { hasField, maintenanceSummary, ticketSummary, warrantyStats, worksheetMaintenance, isHighPriority } from '../lib/analytics'
import { formatCurrency, formatDate } from '../lib/format'
import { repairGroup, warrantyState } from '../lib/normalize'

const TONE = { active: 'green', expiring: 'amber', expired: 'red', unknown: 'neutral' }
const LABEL = { active: 'Active', expiring: 'Expiring soon', expired: 'Expired', unknown: 'Unknown' }
const STAGE_TONE = { Pending: 'amber', Completed: 'green', Other: 'neutral', Unknown: 'neutral' }

const daysLeft = (date) => {
  if (!date) return null
  const today = new Date()
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  return Math.ceil((date.getTime() - start) / 86400000)
}

export default function Warranty({ assets, dataset, settings, tickets, maintenanceRecords = [], navigate, onSelect }) {
  const [view, setView] = useState('all')
  const stats = warrantyStats(assets, settings.warrantyAlertDays)
  const hasWarranty = hasField(dataset, 'warrantyEnd') || assets.some((asset) => asset.warrantyEnd)
  const donut = [
    { name: 'Active', value: stats.active },
    { name: 'Expiring soon', value: stats.expiring },
    { name: 'Expired', value: stats.expired },
  ].filter((row) => row.value > 0)

  const tracked = assets
    .filter((asset) => asset.warrantyEnd)
    .map((asset) => ({ asset, state: warrantyState(asset, settings.warrantyAlertDays), days: daysLeft(asset.warrantyEnd) }))
    .filter((row) => (view === 'all' ? true : row.state === view))
    .sort((a, b) => a.days - b.days)

  const hasMaintenanceSheet = Boolean(dataset.maintenance && maintenanceRecords.length)
  const maintenance = hasMaintenanceSheet ? worksheetMaintenance(maintenanceRecords) : maintenanceSummary(assets)
  const support = ticketSummary(tickets)

  const findAsset = (record) =>
    assets.find(
      (asset) =>
        (record.assetId && (asset.assetId === record.assetId || asset.serial === record.assetId)) ||
        (record.assetName && asset.name === record.assetName),
    )

  return (
    <div className="fade-in">
      <PageHeader
        title="Warranty &amp; maintenance"
        description={`Coverage health with a ${settings.warrantyAlertDays}-day expiry alert window, plus repair and support activity.`}
      />

      {!hasWarranty ? (
        <div className="mb-4">
          <MissingNotice tone="warn">
            No warranty expiry dates were found in this workbook. Warranty tracking stays hidden until a Warranty Expiry column is mapped.
          </MissingNotice>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          label="Active warranty"
          value={stats.active}
          icon={ShieldCheck}
          tone="green"
          foot={`${assets.length ? Math.round((stats.active / assets.length) * 100) : 0}% of assets`}
        />
        <KpiCard label="Expiring soon" value={stats.expiring} icon={Timer} tone="amber" foot={`within ${settings.warrantyAlertDays} days`} />
        <KpiCard
          label="Expired"
          value={stats.expired}
          icon={ShieldCheck}
          tone="red"
          foot={`${assets.length ? Math.round((stats.expired / assets.length) * 100) : 0}% of assets`}
        />
        <KpiCard
          label="Maintenance spend"
          value={formatCurrency(maintenance.totalCost, settings.currency)}
          icon={Wrench}
          tone="neutral"
          foot={`${maintenance.records.length} service records`}
        />
        <KpiCard
          label="Pending repairs"
          value={maintenance.pending}
          icon={Wrench}
          tone="amber"
          foot={hasMaintenanceSheet ? 'from maintenance sheet' : 'from repair status'}
        />
        <KpiCard label="Completed repairs" value={maintenance.completed} icon={ShieldCheck} tone="green" foot="closed service records" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <ChartFrame title="Warranty analysis" subtitle="Active, expiring and expired coverage" height={272}>
          {donut.length ? (
            <DonutChart
              data={donut}
              currency={settings.currency}
              centerLabel="in warranty"
              centerValue={stats.active}
              colors={['var(--green)', 'var(--amber)', 'var(--red)']}
            />
          ) : (
            <NoChartData message="No warranty dates to analyse." fields="Warranty Expiry column" />
          )}
        </ChartFrame>

        <div className="lg:col-span-2">
          <Card className="flex h-full flex-col">
            <CardHeader
              title="Warranty expiry tracker"
              subtitle="Nearest expiry first — click a row for the full asset record"
              action={
                <Segmented
                  value={view}
                  onChange={setView}
                  options={[
                    { value: 'all', label: 'All' },
                    { value: 'expiring', label: 'Expiring' },
                    { value: 'expired', label: 'Expired' },
                  ]}
                />
              }
            />
            <div className="table-wrap mt-3" style={{ maxHeight: 288 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Asset</th>
                    <th>Department</th>
                    <th>Expiry</th>
                    <th>Days</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {tracked.slice(0, 100).map(({ asset, state, days }) => (
                    <tr key={asset.uid} className="clickable" onClick={() => onSelect(asset)}>
                      <td>
                        <div className="max-w-[200px] truncate font-medium">{asset.name}</div>
                        <div className="mono text-[10px] faint">{asset.assetId}</div>
                      </td>
                      <td className="max-w-[130px] truncate">{asset.department || <span className="faint">—</span>}</td>
                      <td className="mono text-[11.5px]">{formatDate(asset.warrantyEnd)}</td>
                      <td
                        className="mono text-[11.5px]"
                        style={{ color: days < 0 ? 'var(--red)' : days <= settings.warrantyAlertDays ? 'var(--amber)' : 'var(--text-2)' }}
                      >
                        {days < 0 ? `${Math.abs(days)}d ago` : `${days}d`}
                      </td>
                      <td>
                        <Badge tone={TONE[state]} dot>
                          {LABEL[state]}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                  {!tracked.length ? (
                    <tr>
                      <td colSpan={5} className="py-10 text-center faint">
                        No warranty records match this view.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>

      <SectionTitle hint={hasMaintenanceSheet ? `Source: ${dataset.maintenance.sheetName}` : undefined}>Maintenance history</SectionTitle>
      <Card className="overflow-hidden">
        <CardHeader
          title={hasMaintenanceSheet ? 'Maintenance worksheet' : 'Service & repair records'}
          subtitle={
            hasMaintenanceSheet
              ? `Work orders imported from “${dataset.maintenance.sheetName}”`
              : 'Rows with maintenance date, repair status or maintenance cost'
          }
          action={<Badge>{maintenance.records.length} records</Badge>}
        />
        <div className="table-wrap mt-3" style={{ maxHeight: 380 }}>
          {hasMaintenanceSheet ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Work order</th>
                  <th>Asset</th>
                  <th>Service date</th>
                  <th>Repair status</th>
                  <th>Stage</th>
                  <th>Cost</th>
                  <th>Technician</th>
                  <th>Issue</th>
                </tr>
              </thead>
              <tbody>
                {maintenance.records.slice(0, 200).map((record) => {
                  const linkedAsset = findAsset(record)
                  return (
                    <tr key={record.uid} className={linkedAsset ? 'clickable' : undefined} onClick={() => linkedAsset && onSelect(linkedAsset)}>
                      <td className="mono text-[11px]">{record.workOrder}</td>
                      <td>
                        <div className="max-w-[190px] truncate font-medium">{record.assetName || record.assetId || '—'}</div>
                        {record.assetName && record.assetId ? <div className="mono text-[10px] faint">{record.assetId}</div> : null}
                      </td>
                      <td className="mono text-[11.5px]">{record.date ? formatDate(record.date) : '—'}</td>
                      <td>{record.statusRaw || <span className="faint">—</span>}</td>
                      <td>
                        <Badge tone={STAGE_TONE[record.stage] || 'neutral'} dot>
                          {record.stage}
                        </Badge>
                      </td>
                      <td className="mono">{Number.isFinite(record.cost) ? formatCurrency(record.cost, settings.currency) : '—'}</td>
                      <td className="max-w-[150px] truncate">{record.technician || <span className="faint">—</span>}</td>
                      <td className="max-w-[240px] truncate muted">{record.issue || '—'}</td>
                    </tr>
                  )
                })}
                {!maintenance.records.length ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center faint">
                      The maintenance worksheet has no data rows.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Asset</th>
                  <th>Category</th>
                  <th>Last maintenance</th>
                  <th>Repair status</th>
                  <th>Maintenance cost</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {maintenance.records.slice(0, 200).map((asset) => (
                  <tr key={asset.uid} className="clickable" onClick={() => onSelect(asset)}>
                    <td>
                      <div className="max-w-[200px] truncate font-medium">{asset.name}</div>
                      <div className="mono text-[10px] faint">{asset.assetId}</div>
                    </td>
                    <td>{asset.category || '—'}</td>
                    <td className="mono text-[11.5px]">{asset.lastMaintenance ? formatDate(asset.lastMaintenance) : '—'}</td>
                    <td>{asset.repairStatus ? <Badge tone={STAGE_TONE[repairGroup(asset.repairStatus)]}>{asset.repairStatus}</Badge> : <span className="faint">—</span>}</td>
                    <td className="mono">
                      {Number.isFinite(asset.maintenanceCost) ? formatCurrency(asset.maintenanceCost, settings.currency) : '—'}
                    </td>
                    <td className="max-w-[240px] truncate muted">{asset.notes || '—'}</td>
                  </tr>
                ))}
                {!maintenance.records.length ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center faint">
                      No maintenance data found. Add a maintenance worksheet or maintenance columns on the asset sheet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      <SectionTitle hint={support ? `${support.total} tickets` : undefined}>IT support tracking</SectionTitle>
      {support ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {[
              { label: 'Total tickets', value: support.total },
              { label: 'Open tickets', value: support.Open },
              { label: 'Pending tickets', value: support.Pending },
              { label: 'Resolved tickets', value: support.Resolved },
              { label: 'High priority', value: support.highPriority, foot: `${support.highPriorityOpen} unresolved` },
            ].map((stat) => (
              <div key={stat.label} className="card px-4 py-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.07em] faint">{stat.label}</div>
                <div className="mono mt-1 text-[19px] font-semibold">{stat.value}</div>
                {stat.foot ? <div className="text-[10.5px] faint">{stat.foot}</div> : null}
              </div>
            ))}
            <div className="card px-4 py-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.07em] faint">Average resolution</div>
              <div className="mono mt-1 text-[19px] font-semibold">
                {support.avgResolution == null ? '—' : `${support.avgResolution.toFixed(1)}h`}
              </div>
              <div className="text-[10.5px] faint">
                {support.avgResolution == null ? 'no resolution time' : `from ${support.avgResolutionSamples} tickets`}
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <ChartFrame title="Issue categories" subtitle={`Tickets by category from “${dataset.tickets?.sheetName}”`} height={280}>
              {support.categories.length ? (
                <DonutChart data={support.categories.slice(0, 8)} currency={settings.currency} centerLabel="tickets" />
              ) : (
                <NoChartData message="No issue categories found." fields="Issue Category column" />
              )}
            </ChartFrame>

            <ChartFrame title="Department-wise tickets" subtitle="Support demand by department" height={280}>
              {support.departments.length && !(support.departments.length === 1 && support.departments[0].name === 'Unspecified') ? (
                <BarChartView data={support.departments} horizontal name="Tickets" color="var(--chart-3)" />
              ) : (
                <NoChartData message="No department values found on the ticket sheet." fields="Department column" />
              )}
            </ChartFrame>

            <Card>
              <CardHeader title="Latest tickets" subtitle="Most recent rows in the ticket sheet" />
              <div className="p-4">
                {tickets.slice(0, 6).map((ticket) => (
                  <div key={ticket.uid} className="flex items-start gap-2 border-b py-2 last:border-0">
                    <span className="mono text-[10px] faint">{ticket.ticketId}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12px]">{ticket.subject || ticket.category}</div>
                      <div className="text-[10.5px] faint">
                        {[ticket.category, ticket.assignee, ticket.opened ? formatDate(ticket.opened) : ''].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                    {isHighPriority(ticket) ? <Badge tone="red">High</Badge> : null}
                    <Badge tone={ticket.status === 'Resolved' ? 'green' : ticket.status === 'Open' ? 'amber' : 'neutral'}>{ticket.status}</Badge>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </>
      ) : (
        <EmptyState
          icon={Wrench}
          title="No support ticket sheet detected"
          description="Add a second worksheet with ticket columns (Ticket ID, Status, Issue Category, Priority, Department, Opened, Resolved or Resolution Time) and it will appear here automatically."
          action={
            <button type="button" className="btn" onClick={() => navigate('upload')}>
              Upload another workbook
            </button>
          }
        />
      )}

      <div className="mt-4">
        <MissingNotice>
          Warranty state uses the mapped expiry date and the alert window in Settings. Assets without an expiry date are excluded from the tracker rather than assumed active.
          {hasMaintenanceSheet
            ? ` Maintenance figures come from the “${dataset.maintenance.sheetName}” worksheet.`
            : ' No maintenance worksheet was detected, so only maintenance columns on the asset sheet are used.'}
        </MissingNotice>
      </div>
    </div>
  )
}
