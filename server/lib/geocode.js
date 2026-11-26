import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Resolves Indian city + state names to coordinates using the bundled
 * GeoNames populated-places dataset (every Indian town with a population of
 * 1,000+, plus all administrative seats). No vendor data lives here and no
 * coordinates are invented: a name that cannot be matched is left unresolved
 * so the UI can show it under Unmapped Locations.
 */
const DATA_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'datasets', 'india-cities.json')

const CITY_ALIASES = {
  bangalore: 'bengaluru',
  bombay: 'mumbai',
  madras: 'chennai',
  calcutta: 'kolkata',
  cochin: 'kochi',
  trivandrum: 'thiruvananthapuram',
  mysore: 'mysuru',
  mangalore: 'mangaluru',
  belgaum: 'belagavi',
  hubli: 'hubballi',
  gulbarga: 'kalaburagi',
  baroda: 'vadodara',
  simla: 'shimla',
  poona: 'pune',
  pondicherry: 'puducherry',
  tuticorin: 'thoothukudi',
  trichy: 'tiruchirappalli',
  tanjore: 'thanjavur',
  ooty: 'udagamandalam',
  calicut: 'kozhikode',
  quilon: 'kollam',
  alleppey: 'alappuzha',
  tellicherry: 'thalassery',
  cannanore: 'kannur',
  vizag: 'visakhapatnam',
  bezawada: 'vijayawada',
  gurgaon: 'gurugram',
  bangalorecity: 'bengaluru',
}

const STATE_ALIASES = {
  orissa: 'odisha',
  uttaranchal: 'uttarakhand',
  pondicherry: 'puducherry',
  tamilnadu: 'tamil nadu',
  telengana: 'telangana',
  'nct of delhi': 'delhi',
  'new delhi': 'delhi',
  delhi: 'delhi',
  'jammu & kashmir': 'jammu and kashmir',
  'jammu and kashmir': 'jammu and kashmir',
  'andaman & nicobar islands': 'andaman and nicobar',
  'andaman and nicobar islands': 'andaman and nicobar',
  'dadra and nagar haveli': 'dadra and nagar haveli and daman and diu',
  'daman and diu': 'dadra and nagar haveli and daman and diu',
  'dadra and nagar haveli and daman and diu': 'dadra and nagar haveli and daman and diu',
  'arunachal': 'arunachal pradesh',
  'himachal': 'himachal pradesh',
  'madhya': 'madhya pradesh',
  'uttar': 'uttar pradesh',
  'andhra': 'andhra pradesh',
  'west bengal': 'west bengal',
}

const STATE_CODES = {
  ap: 'andhra pradesh',
  ar: 'arunachal pradesh',
  as: 'assam',
  br: 'bihar',
  cg: 'chhattisgarh',
  ct: 'chhattisgarh',
  ch: 'chandigarh',
  dd: 'dadra and nagar haveli and daman and diu',
  dl: 'delhi',
  dn: 'dadra and nagar haveli and daman and diu',
  ga: 'goa',
  gj: 'gujarat',
  hr: 'haryana',
  hp: 'himachal pradesh',
  jk: 'jammu and kashmir',
  jh: 'jharkhand',
  ka: 'karnataka',
  kl: 'kerala',
  la: 'ladakh',
  ld: 'lakshadweep',
  mp: 'madhya pradesh',
  mh: 'maharashtra',
  mn: 'manipur',
  ml: 'meghalaya',
  mz: 'mizoram',
  nl: 'nagaland',
  od: 'odisha',
  or: 'odisha',
  py: 'puducherry',
  pb: 'punjab',
  rj: 'rajasthan',
  sk: 'sikkim',
  tn: 'tamil nadu',
  ts: 'telangana',
  tg: 'telangana',
  tr: 'tripura',
  up: 'uttar pradesh',
  uk: 'uttarakhand',
  ua: 'uttarakhand',
  wb: 'west bengal',
  an: 'andaman and nicobar',
}

/** Lower-case, accent-free, punctuation-free key used for matching. */
export function normalizePlace(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function normalizeState(value) {
  const key = normalizePlace(value)
  if (!key) return ''
  return STATE_ALIASES[key] || STATE_CODES[key] || key
}

/** A city field such as "Chennai, Tamil Nadu" is looked up by its city part. */
function cityLookupKey(value) {
  const first = String(value || '').split(',')[0]
  const key = normalizePlace(first)
  return CITY_ALIASES[key] || key
}

let buckets = null
let entryCount = 0

function load() {
  if (buckets) return
  const places = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'))
  buckets = new Map()
  for (const place of places) {
    const keys = new Set([
      normalizePlace(place.n),
      normalizePlace(place.a),
      ...(place.alt || []).map(normalizePlace),
    ])
    for (const key of keys) {
      if (!key || key.length < 3) continue
      if (!buckets.has(key)) buckets.set(key, [])
      const bucket = buckets.get(key)
      // Each place is stored once per key; the first entry of a key wins the
      // canonical display, so duplicates merge instead of multiplying markers.
      if (!bucket.some((entry) => entry.place === place)) bucket.push({ place })
    }
  }
  for (const bucket of buckets.values()) {
    bucket.sort((a, b) => (b.place.p || 0) - (a.place.p || 0))
  }
  entryCount = places.length
}

export function datasetSize() {
  load()
  return entryCount
}

/**
 * Resolve a vendor's city and state to coordinates.
 *
 * - City aliases and GeoNames alternate names are honoured (Bangalore →
 *   Bengaluru, Bombay → Mumbai, Madras → Chennai...).
 * - A state is used to disambiguate repeated city names; when the supplied
 *   state does not match, a nationally unique city name still resolves, but an
 *   ambiguous name is left unresolved rather than guessed.
 */
export function resolveCity(city, state) {
  load()
  const key = cityLookupKey(city)
  if (!key) return null
  const candidates = (buckets.get(key) || []).map((entry) => entry.place)
  if (!candidates.length) return null

  const wantedState = normalizeState(state)
  let match = null
  if (wantedState) {
    match = candidates.find((place) => normalizeState(place.s) === wantedState)
    if (!match) {
      match = candidates.find((place) => {
        const placeState = normalizeState(place.s)
        return placeState.startsWith(wantedState) || wantedState.startsWith(placeState)
      })
    }
  }

  // When a state is supplied it must agree with the candidate: a city name in
  // the wrong state is left unmapped for Admin review instead of being pinned
  // at a location the vendor is not in. Without a state, the largest place of
  // that name is used (the standard city for unambiguous names).
  if (!match && !wantedState) match = candidates[0]

  if (!match) return null
  return {
    city: match.a || match.n,
    state: match.s || String(state || '').trim(),
    latitude: match.lat,
    longitude: match.lng,
  }
}
