/**
 * Vendor-name matching helpers.
 *
 * Vendor identity is the normalised name: trimmed, collapsed internal
 * whitespace and lower-cased. This is deliberately conservative — it ignores
 * only the two differences the business treats as immaterial (capitalisation
 * and spacing). Look-alike names are reported as ambiguous instead of being
 * merged automatically.
 */

export function normalizeVendorName(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

/** Levenshtein distance, used only to flag possible spelling variants. */
function levenshtein(a, b) {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index)
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i]
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost)
    }
    previous = current
  }
  return previous[b.length]
}

/**
 * Similarity in 0..1. Used to surface "possible spelling variation" warnings.
 * Exact normalised matches score 1 but are handled before this is called.
 */
export function vendorSimilarity(a, b) {
  const left = normalizeVendorName(a)
  const right = normalizeVendorName(b)
  if (!left || !right) return 0
  if (left === right) return 1
  const longest = Math.max(left.length, right.length)
  return 1 - levenshtein(left, right) / longest
}

/**
 * Find a close-but-not-identical vendor name in the master list. A high score
 * means "review this", never "merge this".
 */
export function findAmbiguousVendor(name, existingNames, { threshold = 0.86 } = {}) {
  const normalized = normalizeVendorName(name)
  if (!normalized) return null
  let best = null
  for (const candidate of existingNames) {
    const candidateNormalized = normalizeVendorName(candidate)
    if (!candidateNormalized || candidateNormalized === normalized) continue
    const score = vendorSimilarity(normalized, candidateNormalized)
    if (score >= threshold && (!best || score > best.score)) {
      best = { name: String(candidate), score }
    }
  }
  return best
}

/** Human-readable rounded similarity for summaries. */
export const similarityPercent = (score) => Math.round(score * 100)
