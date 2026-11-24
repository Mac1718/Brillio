import { AlertTriangle, ArrowUpRight, Info } from 'lucide-react'
import { TONE_CLASS } from '../lib/format'

export function Card({ className = '', children, lift = false, ...rest }) {
  return (
    <div className={`card ${lift ? 'card-lift' : ''} ${className}`} {...rest}>
      {children}
    </div>
  )
}

export function CardHeader({ title, subtitle, action }) {
  return (
    <div className="card-header">
      <div className="min-w-0">
        <h3 className="card-title truncate">{title}</h3>
        {subtitle ? <p className="card-subtitle">{subtitle}</p> : null}
      </div>
      {action ? <div className="flex-none">{action}</div> : null}
    </div>
  )
}

export function Badge({ tone = 'neutral', children, dot = false }) {
  return (
    <span className={`badge ${TONE_CLASS[tone] || 'badge-neutral'}`}>
      {dot ? <span className="badge-dot" /> : null}
      {children}
    </span>
  )
}

export function PageHeader({ title, description, actions }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[24px] tracking-[-0.01em]">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-[12.5px] muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2 no-print">{actions}</div> : null}
    </div>
  )
}

export function SectionTitle({ children, hint }) {
  return (
    <div className="mb-3 mt-8 flex items-center justify-between gap-3 first:mt-0">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.11em] faint">{children}</h2>
      {hint ? <span className="text-[11.5px] faint">{hint}</span> : null}
    </div>
  )
}

export function EmptyState({ icon: Icon = Info, title, description, action }) {
  return (
    <div className="empty-state">
      <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-xl" style={{ background: 'var(--panel-2)', color: 'var(--text-3)' }}>
        <Icon size={20} strokeWidth={1.7} />
      </div>
      <h3 className="text-[14px] font-semibold">{title}</h3>
      {description ? <p className="mx-auto mt-1 max-w-md text-[12.5px] muted">{description}</p> : null}
      {action ? <div className="mt-4 flex justify-center gap-2">{action}</div> : null}
    </div>
  )
}

export function MissingNotice({ children, tone = 'info' }) {
  const isWarn = tone === 'warn'
  return (
    <div
      className="flex items-start gap-2.5 rounded-[10px] border px-3 py-2.5 text-[12px]"
      style={
        isWarn
          ? { background: 'var(--amber-soft)', borderColor: 'color-mix(in srgb, var(--amber) 25%, transparent)', color: 'var(--amber)' }
          : { background: 'var(--panel-2)', borderColor: 'var(--border)', color: 'var(--text-2)' }
      }
    >
      {isWarn ? <AlertTriangle size={14} className="mt-0.5 flex-none" /> : <Info size={14} className="mt-0.5 flex-none" />}
      <div>{children}</div>
    </div>
  )
}

export function Segmented({ options, value, onChange }) {
  return (
    <div className="segmented">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={value === option.value ? 'on' : ''}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

const TONES = {
  green: { tone: 'var(--green)', soft: 'var(--green-soft)' },
  amber: { tone: 'var(--amber)', soft: 'var(--amber-soft)' },
  red: { tone: 'var(--red)', soft: 'var(--red-soft)' },
  blue: { tone: 'var(--blue)', soft: 'var(--blue-soft)' },
  violet: { tone: 'var(--violet)', soft: 'var(--violet-soft)' },
  brand: { tone: 'var(--accent)', soft: 'var(--accent-soft)' },
  neutral: { tone: 'var(--text-2)', soft: 'var(--panel-2)' },
}

export function KpiCard({ label, value, icon: Icon, tone = 'neutral', foot, title }) {
  const palette = TONES[tone] || TONES.neutral
  return (
    <div
      className="card card-lift kpi"
      style={{ '--tone': palette.tone, '--tone-soft': palette.soft }}
      title={title}
    >
      <div className="kpi-top">
        <span className="kpi-label">{label}</span>
        {Icon ? (
          <span className="kpi-icon">
            <Icon size={15} strokeWidth={1.8} />
          </span>
        ) : null}
      </div>
      <div className="kpi-value">{value}</div>
      {foot ? <div className="kpi-foot">{foot}</div> : null}
    </div>
  )
}

export function LinkAction({ children, onClick }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex items-center gap-1 text-[11.5px] font-medium" style={{ color: 'var(--accent)' }}>
      {children}
      <ArrowUpRight size={12} />
    </button>
  )
}

export function DataList({ rows }) {
  return (
    <div>
      {rows.map((row) => (
        <div key={row.label} className="detail-row">
          <span className="detail-label">{row.label}</span>
          <span className="break-words">{row.value === '' || row.value == null ? <span className="faint">—</span> : row.value}</span>
        </div>
      ))}
    </div>
  )
}
