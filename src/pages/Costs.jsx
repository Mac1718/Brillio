import { useState } from 'react'
import { Download, Wallet } from 'lucide-react'
import { Card, CardHeader, MissingNotice, PageHeader, SectionTitle, Segmented } from '../components/ui'
import { BarChartView, ChartFrame, NoChartData, TrendLineView } from '../components/charts'
import {
  categoryDistribution,
  costByCategory,
  costByDepartment,
  departmentSummary,
  financialSummary,
  hasField,
  purchaseTrend,
  topAssets,
  warrantySummary,
} from '../lib/analytics'
import { downloadSummaryReport } from '../lib/exporter'
import { formatCurrency, formatDate } from '../lib/format'

export default function Costs({ assets, dataset, settings, tickets, notify, onSelect }) {
  const [granularity, setGranularity] = useState('year')
  const money = (value) => formatCurrency(value, settings.currency)
  const financial = financialSummary(assets, tickets)
  const trend = purchaseTrend(assets, granularity)
  const byCategory = costByCategory(assets)
  const byDepartment = costByDepartment(assets)
  const top = topAssets(assets, 10)
  const hasPrice = hasField(dataset, 'price')

  const cards = [
    { label: 'Total purchase value', value: money(financial.purchase), foot: `${financial.pricedCount} priced assets` },
    { label: 'Current book value', value: money(financial.book), foot: financial.valuedCount ? `${financial.valuedCount} valued assets` : 'no valuation data' },
    {
      label: 'Depreciation to date',
      value: money(financial.depreciation),
      foot: `straight-line, ${settings.usefulLifeYears} yr life`,
    },
    { label: 'Average asset cost', value: financial.avgPrice == null ? '—' : money(financial.avgPrice), foot: 'across priced rows' },
    { label: 'Maintenance spend', value: money(financial.maintenance), foot: 'recorded repair costs' },
  ]
  if (financial.support) cards.push({ label: 'Support ticket cost', value: money(financial.support), foot: 'from ticket sheet' })

  return (
    <div className="fade-in">
      <PageHeader
        title="Cost & purchase analytics"
        description="Procurement history, category and department spending, and the depreciated value of the estate."
        actions={
          <button
            type="button"
            className="btn"
            onClick={() => {
              downloadSummaryReport({
                dataset,
                assets,
                kpis: financial,
                departmentRows: departmentSummary(assets),
                categoryRows: categoryDistribution(assets),
                warrantyRows: warrantySummary(assets, settings.warrantyAlertDays),
                tickets,
                settings,
              })
              notify?.('Financial summary workbook downloaded')
            }}
          >
            <Download size={14} /> Financial workbook
          </button>
        }
      />

      {!hasPrice ? (
        <div className="mb-4">
          <MissingNotice tone="warn">
            No purchase price column is mapped. Cost, depreciation and spend charts will remain empty until the column is mapped on the Excel Upload page.
          </MissingNotice>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {cards.map((card) => (
          <div key={card.label} className="card px-4 py-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.07em] faint">{card.label}</span>
              <Wallet size={13} style={{ color: 'var(--text-3)' }} />
            </div>
            <div className="mono mt-1.5 text-[20px] font-semibold tracking-[-0.02em]">{card.value}</div>
            <div className="text-[10.5px] faint">{card.foot}</div>
          </div>
        ))}
      </div>

      <SectionTitle>Spending over time</SectionTitle>
      <ChartFrame
        title="Purchase value by period"
        subtitle={trend.dated ? `${trend.dated} assets with a purchase date` : 'No dated purchases'}
        action={
          <Segmented
            value={granularity}
            onChange={setGranularity}
            options={[
              { value: 'year', label: 'Year' },
              { value: 'month', label: 'Month' },
            ]}
          />
        }
        height={300}
      >
        {trend.rows.length ? (
          <TrendLineView data={trend.rows} dataKey="value" name="Purchase value" currency={settings.currency} asCurrency />
        ) : (
          <NoChartData message="No purchase dates available." fields="Purchase Date column" />
        )}
      </ChartFrame>

      <SectionTitle>Where the money went</SectionTitle>
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartFrame title="Cost by asset category" subtitle="Total purchase value per category" height={320}>
          {byCategory.length ? <BarChartView data={byCategory} horizontal name="Purchase value" asCurrency currency={settings.currency} /> : <NoChartData message="No priced categories available." fields="Purchase Price + Category" />}
        </ChartFrame>
        <ChartFrame title="Department-wise asset cost" subtitle="IT spending compared across departments" height={320}>
          {byDepartment.length ? <BarChartView data={byDepartment} horizontal name="Purchase value" asCurrency currency={settings.currency} color="var(--chart-3)" /> : <NoChartData message="No department spending available." fields="Department + Purchase Price" />}
        </ChartFrame>
      </div>

      <SectionTitle>Most expensive assets</SectionTitle>
      <Card className="overflow-hidden">
        <CardHeader title="Top purchases" subtitle="Highest recorded purchase prices in this dataset" />
        <div className="table-wrap mt-3">
          <table className="data-table">
            <thead>
              <tr>
                <th>Asset</th>
                <th>Category</th>
                <th>Department</th>
                <th>Assigned to</th>
                <th>Purchased</th>
                <th className="text-right">Price</th>
                <th className="text-right">Current value</th>
              </tr>
            </thead>
            <tbody>
              {top.map((asset) => (
                <tr key={asset.uid} className="clickable" onClick={() => onSelect(asset)}>
                  <td>
                    <div className="max-w-[230px] truncate font-medium">{asset.name}</div>
                    <div className="mono text-[10px] faint">{asset.assetId}</div>
                  </td>
                  <td>{asset.category || '—'}</td>
                  <td className="max-w-[150px] truncate">{asset.department || '—'}</td>
                  <td className="max-w-[150px] truncate">{asset.employee || <span className="faint">Unassigned</span>}</td>
                  <td className="mono text-[11.5px]">{asset.purchaseDate ? formatDate(asset.purchaseDate) : '—'}</td>
                  <td className="mono text-right">{money(asset.price)}</td>
                  <td className="mono text-right">{Number.isFinite(asset.currentValue) ? money(asset.currentValue) : '—'}</td>
                </tr>
              ))}
              {!top.length ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center faint">
                    No purchase prices were mapped, so there is no cost ranking.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mt-4">
        <MissingNotice>
          Current value uses a mapped Current Value column when present. Otherwise it is calculated with a straight-line depreciation over {settings.usefulLifeYears} years,
          floored at zero, and labelled as derived. The rule can be changed in Settings.
        </MissingNotice>
      </div>
    </div>
  )
}
