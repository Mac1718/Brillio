import crypto from 'node:crypto'
import { query } from '../db.js'
import { normalizePlace, resolveCity } from './geocode.js'

const shape = (row) =>
  row
    ? {
        city: row.city,
        state: row.state,
        cityKey: normalizePlace(row.city),
        stateKey: normalizePlace(row.state),
        // Canonical key: "Bangalore" and "Bengaluru" share one marker.
        key: `${normalizePlace(row.city)}||${normalizePlace(row.state)}`,
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
      }
    : null

const keysFor = (city, state) => ({
  cityKey: normalizePlace(String(city || '').split(',')[0]),
  stateKey: normalizePlace(state),
})

async function store(cityKey, stateKey, resolved) {
  await query(
    `INSERT INTO city_locations (id, city_key, state_key, city, state, latitude, longitude, source, resolved_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'geonames', ?)
     ON CONFLICT (city_key, state_key) DO NOTHING`,
    [
      crypto.randomUUID(),
      cityKey,
      stateKey,
      resolved.city,
      resolved.state,
      resolved.latitude,
      resolved.longitude,
      new Date().toISOString(),
    ],
  )
  const rows = await query('SELECT * FROM city_locations WHERE city_key = ? AND state_key = ?', [cityKey, stateKey])
  return shape(rows[0])
}

/** Resolve one vendor location, storing the result in the city cache. */
export async function resolveLocation(city, state) {
  const displayCity = String(city || '').trim()
  const displayState = String(state || '').trim()
  if (!displayCity) return null
  const { cityKey, stateKey } = keysFor(displayCity, displayState)
  const cached = await query('SELECT * FROM city_locations WHERE city_key = ? AND state_key = ?', [cityKey, stateKey])
  if (cached[0]) return shape(cached[0])
  const resolved = resolveCity(displayCity, displayState)
  if (!resolved) return null
  return store(cityKey, stateKey, resolved)
}

/**
 * Resolve the distinct city/state groups of the vendor list. Cached rows are
 * loaded in one query; only genuinely new cities are resolved and stored.
 */
export async function resolveLocations(groups) {
  if (!groups.length) return []
  const cachedRows = await query('SELECT * FROM city_locations')
  const byKey = new Map(cachedRows.map((row) => [`${row.city_key}||${row.state_key}`, row]))
  const result = []
  for (const group of groups) {
    const { cityKey, stateKey } = keysFor(group.city, group.state)
    let location = shape(byKey.get(`${cityKey}||${stateKey}`))
    if (!location) {
      const resolved = resolveCity(group.city, group.state)
      if (resolved) location = await store(cityKey, stateKey, resolved)
    }
    result.push({ ...group, location })
  }
  return result
}
