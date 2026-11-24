import {
  Archive,
  Boxes,
  Database,
  HardDrive,
  Laptop,
  Monitor,
  PackageCheck,
  PcCase,
  Printer,
  TriangleAlert,
  UserCheck,
  Wallet,
  Wrench,
} from 'lucide-react'
import { KpiCard } from './ui'
import { computeKpiCards } from '../lib/analytics'
import { formatCurrency, formatNumber } from '../lib/format'

const ICONS = {
  total: Boxes,
  desktop: PcCase,
  laptop: Laptop,
  monitor: Monitor,
  printer: Printer,
  hdd: HardDrive,
  ssd: Database,
  value: Wallet,
  assigned: UserCheck,
  available: PackageCheck,
  maintenance: Wrench,
  damaged: TriangleAlert,
  retired: Archive,
}

const TONES = {
  total: 'brand',
  desktop: 'blue',
  laptop: 'violet',
  monitor: 'blue',
  printer: 'neutral',
  hdd: 'neutral',
  ssd: 'blue',
  value: 'green',
  assigned: 'blue',
  available: 'green',
  maintenance: 'amber',
  damaged: 'red',
  retired: 'neutral',
}

export default function KpiGrid({ assets, dataset, settings }) {
  const cards = computeKpiCards(assets, dataset)
  if (!cards.length) return null
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6">
      {cards.map((card) => (
        <KpiCard
          key={card.key}
          label={card.label}
          value={card.format === 'currency' ? formatCurrency(card.value, settings.currency) : formatNumber(card.value)}
          icon={ICONS[card.key]}
          tone={TONES[card.key]}
          foot={card.foot}
          title={card.title}
        />
      ))}
    </div>
  )
}
