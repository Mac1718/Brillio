import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Label,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, CardHeader } from './ui'
import { formatCurrency, formatNumber } from '../lib/format'

export const CHART_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-5)',
  'var(--chart-4)',
  'var(--chart-9)',
  'var(--chart-6)',
  'var(--chart-7)',
  'var(--chart-8)',
]

const AXIS = { fontSize: 10.5, fill: 'var(--text-3)' }

export function ChartTooltip({ active, payload, label, currency, valueLabel = 'Assets', asCurrency = false }) {
  if (!active || !payload?.length) return null
  return (
    <div
      className="rounded-[10px] border px-3 py-2 text-[12px] shadow-lg"
      style={{ background: 'var(--panel)', borderColor: 'var(--border-strong)', minWidth: 130 }}
    >
      {label != null && label !== '' ? <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide faint">{label}</div> : null}
      {payload.map((entry) => (
        <div key={entry.dataKey || entry.name} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: entry.color || entry.payload?.fill }} />
            <span style={{ color: 'var(--text-2)' }}>{entry.name}</span>
          </span>
          <span className="mono font-semibold">
            {asCurrency || entry.payload?.isCurrency
              ? formatCurrency(entry.value, currency)
              : formatNumber(entry.value)}
          </span>
        </div>
      ))}
      {!payload.length ? <span>{valueLabel}: {formatNumber(0)}</span> : null}
    </div>
  )
}

export function ChartFrame({ title, subtitle, action, children, height = 264, footer }) {
  return (
    <Card className="flex flex-col">
      <CardHeader title={title} subtitle={subtitle} action={action} />
      <div className="px-3 pb-3 pt-2" style={{ height }}>
        {children}
      </div>
      {footer ? <div className="border-t px-5 py-2.5 text-[11.5px] faint">{footer}</div> : null}
    </Card>
  )
}

export function DonutChart({ data, currency, centerLabel, centerValue, height = 250, colors }) {
  const total = data.reduce((sum, item) => sum + item.value, 0)
  const palette = colors?.length ? colors : CHART_COLORS
  return (
    <div className="flex h-full flex-col items-stretch gap-2 sm:flex-row sm:items-center">
      <div className="relative h-full min-h-[180px] flex-1" style={{ minWidth: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data.filter((d) => d.value > 0)}
              dataKey="value"
              nameKey="name"
              innerRadius="62%"
              outerRadius="88%"
              paddingAngle={data.length > 1 ? 2 : 0}
              stroke="var(--panel)"
              strokeWidth={2}
              isAnimationActive={false}
            >
              {data.filter((d) => d.value > 0).map((entry, index) => (
                <Cell key={entry.name} fill={palette[index % palette.length]} />
              ))}
              <Label
                position="center"
                content={({ viewBox }) => {
                  if (!viewBox) return null
                  const { cx, cy } = viewBox
                  return (
                    <g>
                      <text x={cx} y={cy - 4} textAnchor="middle" style={{ fill: 'var(--text)', fontSize: 22, fontWeight: 650, letterSpacing: '-0.02em' }}>
                        {centerValue ?? formatNumber(total)}
                      </text>
                      <text x={cx} y={cy + 14} textAnchor="middle" style={{ fill: 'var(--text-3)', fontSize: 10.5 }}>
                        {centerLabel || 'total'}
                      </text>
                    </g>
                  )
                }}
              />
            </Pie>
            <Tooltip content={<ChartTooltip currency={currency} />} cursor={{ fill: 'transparent' }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="w-full shrink-0 space-y-1.5 sm:w-[46%]">
        {data.slice(0, 9).map((item, index) => (
          <div key={item.name} className="flex items-center gap-2 text-[11.5px]">
            <span className="h-2 w-2 flex-none rounded-[3px]" style={{ background: palette[index % palette.length] }} />
            <span className="min-w-0 flex-1 truncate" style={{ color: 'var(--text-2)' }}>
              {item.name}
            </span>
            <span className="mono font-medium">{formatNumber(item.value)}</span>
            <span className="w-9 text-right text-[10.5px] faint">
              {total ? `${Math.round((item.value / total) * 100)}%` : '0%'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function BarChartView({ data, dataKey = 'value', name = 'Assets', currency, asCurrency = false, height = '100%', horizontal = false, color = 'var(--chart-1)' }) {
  if (horizontal) {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 18, bottom: 0, left: 4 }} barCategoryGap="22%">
          <CartesianGrid stroke="var(--chart-grid)" horizontal={false} />
          <XAxis type="number" tick={AXIS} axisLine={false} tickLine={false} tickFormatter={(v) => (asCurrency ? formatCurrency(v, currency, true) : formatNumber(v))} />
          <YAxis type="category" dataKey="name" tick={AXIS} axisLine={false} tickLine={false} width={112} />
          <Tooltip cursor={{ fill: 'var(--panel-2)' }} content={<ChartTooltip currency={currency} asCurrency={asCurrency} />} />
          <Bar dataKey={dataKey} name={name} fill={color} radius={[0, 4, 4, 0]} maxBarSize={18} isAnimationActive={false}>
            {data.map((entry, index) => (
              <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    )
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: -18 }} barCategoryGap="26%">
        <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
        <XAxis dataKey="name" tick={AXIS} axisLine={false} tickLine={false} interval={0} tickFormatter={(v) => (String(v).length > 12 ? `${String(v).slice(0, 11)}…` : v)} />
        <YAxis tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} tickFormatter={(v) => (asCurrency ? formatCurrency(v, currency, true) : formatNumber(v))} />
        <Tooltip cursor={{ fill: 'var(--panel-2)' }} content={<ChartTooltip currency={currency} asCurrency={asCurrency} />} />
        <Bar dataKey={dataKey} name={name} fill={color} radius={[4, 4, 0, 0]} maxBarSize={38} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function StackedBarView({ data, series, currency }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: -18 }} barCategoryGap="28%">
        <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
        <XAxis dataKey="name" tick={AXIS} axisLine={false} tickLine={false} tickFormatter={(v) => (String(v).length > 12 ? `${String(v).slice(0, 11)}…` : v)} />
        <YAxis tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip content={<ChartTooltip currency={currency} />} cursor={{ fill: 'var(--panel-2)' }} />
        {series.map((item, index) => (
          <Bar
            key={item.key}
            dataKey={item.key}
            name={item.name}
            stackId="stack"
            fill={CHART_COLORS[index % CHART_COLORS.length]}
            radius={index === series.length - 1 ? [3, 3, 0, 0] : 0}
            maxBarSize={40}
            isAnimationActive={false}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

export function TrendLineView({ data, dataKey = 'count', name = 'Assets', currency, asCurrency = false }) {
  const color = asCurrency ? 'var(--chart-3)' : 'var(--chart-1)'
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -14 }}>
        <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
        <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={16} />
        <YAxis
          tick={AXIS}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
          tickFormatter={(v) => (asCurrency ? formatCurrency(v, currency, true) : formatNumber(v))}
        />
        <Tooltip content={<ChartTooltip currency={currency} asCurrency={asCurrency} />} cursor={{ stroke: 'var(--border-strong)' }} />
        <Line
          type="monotone"
          dataKey={dataKey}
          name={name}
          stroke={color}
          strokeWidth={2}
          isAnimationActive={false}
          dot={data.length < 14 ? { r: 2.5, strokeWidth: 0, fill: color } : false}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

export function NoChartData({ message = 'Not enough data for this chart.', fields }) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <p className="text-[12.5px] font-medium" style={{ color: 'var(--text-2)' }}>
        {message}
      </p>
      {fields ? <p className="mt-1 max-w-xs text-[11.5px] faint">Requires: {fields}</p> : null}
    </div>
  )
}
