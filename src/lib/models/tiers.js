// Tier mapping — MODELS.md "Play thresholds (uniform scale)":
// 85–100 Elite · 75–84 Strong · 68–74 Lean · 60–67 Watch · <60 Pass.
// Brand rule: user-facing copy uses PRIME/STRONG/CAUTION/FADE (no gambling words);
// engineering mapping: ELITE→PRIME, STRONG→STRONG, LEAN+WATCH→CAUTION, PASS→FADE.
export function internalTier(score) {
  if (!Number.isFinite(score)) return null
  if (score >= 85) return 'ELITE'
  if (score >= 75) return 'STRONG'
  if (score >= 68) return 'LEAN'
  if (score >= 60) return 'WATCH'
  return 'PASS'
}
export function brandTier(score) {
  const t = internalTier(score)
  if (t == null) return null
  if (t === 'ELITE') return 'PRIME'
  if (t === 'STRONG') return 'STRONG'
  if (t === 'LEAN' || t === 'WATCH') return 'CAUTION'
  return 'FADE'
}
