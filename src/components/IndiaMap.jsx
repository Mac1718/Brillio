import { useMemo, useState } from 'react'
import { INDIA_OUTLINE, resolveCity } from '../lib/cities'

const WIDTH = 660
const HEIGHT = 660
const PAD = 16
const SCALE = 21

const project = (lng, lat) => ({
  x: PAD + (lng - 67.5) * SCALE,
  y: PAD + (36.5 - lat) * SCALE,
})

const outlinePath = INDIA_OUTLINE.map(([lng, lat], index) => {
  const point = project(lng, lat)
  return `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)},${point.y.toFixed(1)}`
}).join(' ') + ' Z'

/**
 * Interactive India map. Markers come from live vendor data; nothing about a
 * vendor is hardcoded, only geographic coordinates are.
 */
export default function IndiaMap({ cities = [], selectedCity, onSelectCity, searchTerm = '' }) {
  const [hovered, setHovered] = useState(null)

  const markers = useMemo(
    () =>
      cities
        .map((entry) => {
          const coords = resolveCity(entry.city, entry.state)
          if (!coords) return { ...entry, unmapped: true }
          const point = project(coords.lng, coords.lat)
          return { ...entry, ...point, matched: coords.matched, unmapped: false }
        })
        .sort((a, b) => b.vendorCount - a.vendorCount),
    [cities],
  )

  const unmapped = markers.filter((marker) => marker.unmapped)
  const placed = markers.filter((marker) => !marker.unmapped)
  const term = searchTerm.trim().toLowerCase()
  const isMatch = (marker) => !term || `${marker.city} ${marker.state}`.toLowerCase().includes(term)

  return (
    <div className="india-map">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Map of India with vendor cities">
        <defs>
          <linearGradient id="indiaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.06" />
          </linearGradient>
        </defs>
        <path d={outlinePath} className="india-shape" fill="url(#indiaFill)" />
        {placed.map((marker) => {
          const active = selectedCity && selectedCity.toLowerCase() === String(marker.city).toLowerCase()
          const matched = isMatch(marker)
          const radius = 5 + Math.min(6, Math.sqrt(marker.vendorCount) * 2)
          return (
            <g
              key={`${marker.city}-${marker.state}`}
              className={`map-marker ${active ? 'active' : ''} ${matched ? '' : 'dim'}`}
              onClick={() => onSelectCity?.(active ? null : marker.city)}
              onMouseEnter={() => setHovered(marker)}
              onMouseLeave={() => setHovered(null)}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') onSelectCity?.(active ? null : marker.city)
              }}
            >
              {active ? <circle cx={marker.x} cy={marker.y} r={radius + 7} className="map-halo" /> : null}
              <circle cx={marker.x} cy={marker.y} r={radius} className="map-dot" />
              <text x={marker.x + radius + 4} y={marker.y + 3.5} className="map-label" style={{ opacity: active || term ? 1 : 0.55 }}>
                {marker.city}
                {marker.vendorCount > 1 ? ` (${marker.vendorCount})` : ''}
              </text>
            </g>
          )
        })}
      </svg>

      {hovered ? (
        <div
          className="map-tooltip"
          style={{
            left: `${(hovered.x / WIDTH) * 100}%`,
            top: `${(hovered.y / HEIGHT) * 100}%`,
          }}
        >
          <strong>{hovered.city}</strong>
          <span>{hovered.state}</span>
          <span>{hovered.vendorCount} vendor{hovered.vendorCount === 1 ? '' : 's'}</span>
        </div>
      ) : null}

      {unmapped.length ? (
        <div className="map-unmapped">
          <span className="map-unmapped-label">Not placed on map</span>
          {unmapped.map((marker) => (
            <button key={`${marker.city}-${marker.state}`} type="button" className="chip" onClick={() => onSelectCity?.(marker.city)}>
              {marker.city}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
