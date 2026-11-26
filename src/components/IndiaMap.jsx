import { useEffect, useMemo, useRef, useState } from 'react'
import { feature } from 'topojson-client'
import * as d3geo from 'd3-geo'
import { ZoomIn, ZoomOut, RotateCcw, Search, MapPin } from 'lucide-react'

const WIDTH = 780
const HEIGHT = 820

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))
const keyOf = (entry) =>
  entry?.key || `${String(entry?.city || '').trim().toLowerCase()}||${String(entry?.state || '').trim().toLowerCase()}`

/**
 * Places markers at the coordinates resolved by the server. Only a light
 * collision nudge is applied to labels so dense clusters stay readable; the
 * position always derives from the vendor's actual city, never from a list.
 */
function computePositions(cities, projection) {
  const pts = cities
    .map((entry) => {
      const lat = Number(entry.latitude)
      const lng = Number(entry.longitude)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
      const [x, y] = projection([lng, lat])
      if (!Number.isFinite(x) || !Number.isFinite(y)) return null
      return { ...entry, x, y, key: keyOf(entry) }
    })
    .filter(Boolean)

  const sorted = [...pts].sort((a, b) => (b.vendorCount || 0) - (a.vendorCount || 0))
  const placed = []
  const minDist = 30
  for (const marker of sorted) {
    let x = marker.x
    let y = marker.y
    for (let iter = 0; iter < 10; iter += 1) {
      let moved = false
      for (const other of placed) {
        const dx = x - other.x
        const dy = y - other.y
        const distance = Math.hypot(dx, dy)
        if (distance < minDist) {
          if (distance > 0.001) {
            const push = (minDist - distance) * 0.5 + 0.4
            x += (dx / distance) * push
            y += (dy / distance) * push
          } else {
            x += 3
            y += 3
          }
          moved = true
        }
      }
      if (!moved) break
    }
    placed.push({ ...marker, x, y })
  }
  return placed
}

export default function IndiaMap({
  cities = [],
  unmapped = [],
  selectedCity = null,
  onSelectCity,
  searchTerm = '',
  onSearchChange,
  stateFilter = '',
  onStateFilter,
}) {
  const [geoData, setGeoData] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [transform, setTransform] = useState({ k: 1, x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const dragStart = useRef(null)
  const [hovered, setHovered] = useState(null)
  const [mounted, setMounted] = useState(false)
  const lastZoomedKey = useRef(null)

  useEffect(() => {
    let cancelled = false
    fetch('/india-states.topojson')
      .then((response) => {
        if (!response.ok) throw new Error('Map data unavailable')
        return response.json()
      })
      .then((topology) => {
        if (cancelled) return
        setGeoData(feature(topology, topology.objects.data))
      })
      .catch((error) => {
        if (!cancelled) setLoadError(error.message)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 60)
    return () => clearTimeout(timer)
  }, [])

  const projection = useMemo(() => {
    if (!geoData) return null
    return d3geo.geoMercator().fitSize([WIDTH, HEIGHT], geoData)
  }, [geoData])

  const pathGenerator = useMemo(() => {
    if (!projection) return null
    return d3geo.geoPath(projection)
  }, [projection])

  const placed = useMemo(() => {
    if (!projection) return []
    return computePositions(cities, projection)
  }, [cities, projection])

  const states = useMemo(() => (geoData ? geoData.features : []), [geoData])

  const stateNames = useMemo(() => {
    const names = new Set(cities.map((entry) => entry.state).filter(Boolean))
    return [...names].sort()
  }, [cities])

  const selectedKey = selectedCity ? keyOf(selectedCity) : null
  const term = searchTerm.trim().toLowerCase()

  // Zoom to a selected city whenever the selection changes; selecting another
  // city re-centres immediately, clearing resets the view.
  useEffect(() => {
    if (!projection) return
    if (!selectedKey) {
      lastZoomedKey.current = null
      setTransform({ k: 1, x: 0, y: 0 })
      return
    }
    if (lastZoomedKey.current === selectedKey) return
    const marker = placed.find((entry) => entry.key === selectedKey)
    if (!marker) return
    const k = 3.1
    lastZoomedKey.current = selectedKey
    setTransform({ k, x: WIDTH / 2 - marker.x * k, y: HEIGHT / 2 - marker.y * k })
  }, [selectedKey, placed, projection])

  const zoomIn = () => setTransform((t) => ({ ...t, k: clamp(t.k * 1.35, 1, 8) }))
  const zoomOut = () => setTransform((t) => ({ ...t, k: clamp(t.k / 1.35, 1, 8) }))
  const resetView = () => setTransform({ k: 1, x: 0, y: 0 })

  const handleWheel = (event) => {
    event.preventDefault()
    const factor = event.deltaY < 0 ? 1.18 : 0.85
    setTransform((t) => ({ ...t, k: clamp(t.k * factor, 1, 8) }))
  }

  const handlePointerDown = (event) => {
    if (event.target.closest('.map-marker-group')) return
    setDragging(true)
    dragStart.current = { x: event.clientX, y: event.clientY, tx: transform.x, ty: transform.y }
  }

  const handlePointerMove = (event) => {
    if (!dragging || !dragStart.current) return
    const dx = event.clientX - dragStart.current.x
    const dy = event.clientY - dragStart.current.y
    setTransform((t) => ({ ...t, x: dragStart.current.tx + dx, y: dragStart.current.ty + dy }))
  }

  const handlePointerUp = () => {
    setDragging(false)
    dragStart.current = null
  }

  const submitSearch = (event) => {
    event.preventDefault()
    if (!term) return
    const match = placed.find((marker) => `${marker.city} ${marker.state}`.toLowerCase().includes(term))
    if (match) onSelectCity?.({ key: match.key, city: match.city, state: match.state })
  }

  if (loadError) {
    return (
      <div className="map-loading">
        <span>Map data could not be loaded.</span>
      </div>
    )
  }

  if (!geoData) {
    return (
      <div className="map-loading">
        <div className="map-spinner" />
        <span>Loading India map…</span>
      </div>
    )
  }

  return (
    <div className={`premium-map ${mounted ? 'is-mounted' : ''}`}>
      <div className="map-toolbar">
        <form className="map-search" onSubmit={submitSearch}>
          <Search size={13} />
          <input
            className="map-search-input"
            placeholder="Search city, state or vendor"
            value={searchTerm}
            onChange={(event) => onSearchChange?.(event.target.value)}
            aria-label="Search city, state or vendor"
          />
        </form>
        <select
          className="map-select"
          value={stateFilter}
          onChange={(event) => onStateFilter?.(event.target.value)}
          aria-label="Filter by state"
        >
          <option value="">All states</option>
          {stateNames.map((state) => (
            <option key={state} value={state}>
              {state}
            </option>
          ))}
        </select>
        <div className="map-controls">
          <button type="button" className="map-ctrl-btn" onClick={zoomIn} aria-label="Zoom in">
            <ZoomIn size={14} />
          </button>
          <button type="button" className="map-ctrl-btn" onClick={zoomOut} aria-label="Zoom out">
            <ZoomOut size={14} />
          </button>
          <button type="button" className="map-ctrl-btn" onClick={resetView} aria-label="Reset view">
            <RotateCcw size={14} />
          </button>
        </div>
      </div>

      <div
        className="map-canvas"
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        style={{ cursor: dragging ? 'grabbing' : 'grab' }}
      >
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="map-svg"
          role="img"
          aria-label="Interactive map of India with vendor cities"
        >
          <defs>
            <linearGradient id="indiaStateFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.16" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.05" />
            </linearGradient>
            <linearGradient id="indiaStateFillActive" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--brand-dot)" stopOpacity="0.22" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.08" />
            </linearGradient>
            <radialGradient id="markerPulse" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="var(--brand-dot)" stopOpacity="0.55" />
              <stop offset="100%" stopColor="var(--brand-dot)" stopOpacity="0" />
            </radialGradient>
            <filter id="markerGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <rect x="0" y="0" width={WIDTH} height={HEIGHT} fill="transparent" />

          <g
            className={`map-zoom-layer ${dragging ? 'is-dragging' : ''}`}
            transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}
          >
            <g className="map-states">
              {states.map((state, index) => {
                const name = state.properties?.NAME_1 || state.properties?.name || ''
                const active = stateFilter && name.toLowerCase() === stateFilter.toLowerCase()
                return (
                  <path
                    key={`${name}-${index}`}
                    d={pathGenerator(state)}
                    className={`state-path ${active ? 'state-active' : ''}`}
                    style={{ animationDelay: `${index * 6}ms` }}
                  >
                    <title>{name}</title>
                  </path>
                )
              })}
            </g>

            <g className="map-markers">
              {placed
                .filter((marker) => !stateFilter || marker.state.toLowerCase() === stateFilter.toLowerCase())
                .map((marker, index) => {
                  const active = selectedKey === marker.key
                  const matches = !term || `${marker.city} ${marker.state}`.toLowerCase().includes(term) || active
                  const radius = 6 + Math.min(9, Math.sqrt(marker.vendorCount || 1) * 2.4)
                  return (
                    <g
                      key={marker.key}
                      className={`map-marker-group ${active ? 'is-active' : ''} ${matches ? '' : 'is-dim'}`}
                      transform={`translate(${marker.x},${marker.y})`}
                      onClick={(event) => {
                        event.stopPropagation()
                        onSelectCity?.(active ? null : { key: marker.key, city: marker.city, state: marker.state })
                      }}
                      onMouseEnter={() => setHovered(marker)}
                      onMouseLeave={() => setHovered(null)}
                      role="button"
                      tabIndex={0}
                      aria-label={`${marker.city}, ${marker.state}: ${marker.vendorCount} vendor${marker.vendorCount === 1 ? '' : 's'}`}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          onSelectCity?.(active ? null : { key: marker.key, city: marker.city, state: marker.state })
                        }
                      }}
                      style={{ animationDelay: `${300 + index * 45}ms` }}
                    >
                      <circle className="marker-hit" r={radius + 12} />
                      <circle className="marker-pulse" r={radius + 12} />
                      <circle className="marker-halo" r={radius + 7} />
                      <circle className="marker-dot" r={radius} filter="url(#markerGlow)" />
                      <text className="marker-count" y={3.5}>
                        {marker.vendorCount}
                      </text>
                      <text className="marker-label" x={radius + 5} y={3.5}>
                        {marker.city}
                        {marker.vendorCount > 1 ? ` (${marker.vendorCount})` : ''}
                      </text>
                    </g>
                  )
                })}
            </g>
          </g>
        </svg>

        {hovered ? (
          <div
            className="map-tooltip"
            style={{
              left: `${((hovered.x * transform.k + transform.x) / WIDTH) * 100}%`,
              top: `${((hovered.y * transform.k + transform.y) / HEIGHT) * 100}%`,
            }}
          >
            <strong>{hovered.city}</strong>
            <span>{hovered.state}</span>
            <span>
              {hovered.vendorCount} vendor{hovered.vendorCount === 1 ? '' : 's'}
            </span>
            {hovered.assessmentCount ? <span>{hovered.assessmentCount} assessments</span> : null}
          </div>
        ) : null}
      </div>

      {unmapped.length ? (
        <div className="map-unmapped">
          <span className="map-unmapped-label">Not placed on map</span>
          {unmapped.slice(0, 14).map((entry) => (
            <span key={`${entry.city}-${entry.state}-${entry.name || ''}`} className="chip" title={entry.reason || ''}>
              {entry.name ? `${entry.name}${entry.city ? ` · ${entry.city}` : ''}` : `${entry.city}, ${entry.state}`}
            </span>
          ))}
          {unmapped.length > 14 ? <span className="chip">+{unmapped.length - 14}</span> : null}
        </div>
      ) : null}

      {selectedCity ? (
        <div className="map-selected-chip">
          <MapPin size={13} />
          <span>
            Selected: <strong>{selectedCity.city}, {selectedCity.state}</strong>
          </span>
        </div>
      ) : null}
    </div>
  )
}
