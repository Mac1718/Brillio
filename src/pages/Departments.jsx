import { Building2 } from 'lucide-react'
import { Card, CardHeader, EmptyState, MissingNotice, PageHeader, SectionTitle } from '../components/ui'
import { BarChartView, ChartFrame, NoChartData, StackedBarView } from '../components/charts'
import { costByDepartment, departmentDistribution, departmentSummary, hasField } from '../lib/analytics'
import { formatCurrency } from '../lib/format'

export default function Departments({ assets, dataset, settings, navigate }) {
  const summary = departmentSummary(assets)
  const distribution = departmentDistribution(assets)
  const cost = costByDepartment(assets)
  const totalCost = summary.reduce((sum, row) => sum + row.cost, 0)
  const busiest = summary[0]

  return (
    <div className="fade-in">
      <PageHeader
        title="Department analytics"
        description="How hardware is distributed across the organisation, and what each department's estate is worth."
      />

      {!hasField(dataset, 'department') ? (
        <EmptyState
          icon={Building2}
          title="No department column was found"
          description="This workbook does not contain a recognisable Department column, so departmental analytics cannot be generated."
          action={
            <button type="button" className="btn btn-primary" onClick={() => navigate('upload')}>
              Map columns
            </button>
          }
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: 'Departments', value: summary.length },
              { label: 'Largest department', value: busiest?.name || '—', small: busiest ? `${busiest.total} assets` : '' },
              { label: 'Unassigned across departments', value: summary.reduce((sum, row) => sum + (row.total - row.assigned), 0) },
              { label: 'Total recorded spend', value: formatCurrency(totalCost, settings.currency) },
            ].map((stat) => (
              <div key={stat.label} className="card px-4 py-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.08em] faint">{stat.label}</div>
                <div className="mt-1 truncate text-[17px] font-semibold tracking-[-0.02em]" title={String(stat.value)}>
                  {stat.value}
                </div>
                {stat.small ? <div className="text-[10.5px] faint">{stat.small}</div> : null}
              </div>
            ))}
          </div>

          <SectionTitle>Distribution &amp; spend</SectionTitle>
          <div className="grid gap-4 lg:grid-cols-2">
            <ChartFrame title="Assets by department" subtitle="Total assets held per department" height={300}>
              {distribution.length ? <BarChartView data={distribution} horizontal name="Assets" /> : <NoChartData message="No department values found." />}
            </ChartFrame>
            <ChartFrame title="Purchase value by department" subtitle="Recorded purchase price of each department's estate" height={300}>
              {cost.length ? (
                <BarChartView data={cost} horizontal name="Purchase value" asCurrency currency={settings.currency} />
              ) : (
                <NoChartData message="No purchase prices are available." fields="Purchase Price column" />
              )}
            </ChartFrame>
          </div>

          <SectionTitle>Status mix per department</SectionTitle>
          <ChartFrame title="Allocation and condition by department" subtitle="Stacked asset counts by lifecycle status" height={320}>
            {summary.length ? (
              <StackedBarView
                data={summary.slice(0, 12).map((row) => ({
                  name: row.name,
                  Assigned: row.assigned,
                  Available: row.available,
                  Maintenance: row.maintenance,
                  Damaged: row.damaged,
                }))}
                series={[
                  { key: 'Assigned', name: 'Assigned' },
                  { key: 'Available', name: 'Available' },
                  { key: 'Maintenance', name: 'Maintenance' },
                  { key: 'Damaged', name: 'Damaged' },
                ]}
                currency={settings.currency}
              />
            ) : (
              <NoChartData message="No department rows available." />
            )}
          </ChartFrame>

          <SectionTitle>Department ledger</SectionTitle>
          <Card className="overflow-hidden">
            <CardHeader title="Department summary" subtitle="Asset counts, status split and financial position" />
            <div className="table-wrap mt-3" style={{ maxHeight: 480 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Department</th>
                    <th className="text-right">Assets</th>
                    <th className="text-right">Assigned</th>
                    <th className="text-right">Available</th>
                    <th className="text-right">Maintenance</th>
                    <th className="text-right">Damaged</th>
                    <th className="text-right">Purchase value</th>
                    <th className="text-right">Current value</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.map((row) => (
                    <tr key={row.name}>
                      <td className="max-w-[240px] truncate font-medium">{row.name}</td>
                      <td className="mono text-right">{row.total}</td>
                      <td className="mono text-right">{row.assigned}</td>
                      <td className="mono text-right">{row.available}</td>
                      <td className="mono text-right">{row.maintenance}</td>
                      <td className="mono text-right">{row.damaged}</td>
                      <td className="mono text-right">{row.cost ? formatCurrency(row.cost, settings.currency) : '—'}</td>
                      <td className="mono text-right">{row.currentValue ? formatCurrency(row.currentValue, settings.currency) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="mt-4">
            <MissingNotice>
              Departments without a mapped value are grouped as “Unspecified”. Status columns that are absent leave the related columns at zero rather than inventing values.
            </MissingNotice>
          </div>
        </>
      )}
    </div>
  )
}
