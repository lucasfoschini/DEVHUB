/** Below this many successful samples, percentiles are not reported ("quando mensuráveis"). */
export const MIN_SAMPLES = 5

/** Nearest-rank percentile of an ascending list. */
export function percentile(sorted: number[], p: number) {
  if (sorted.length === 0) return null
  const rank = Math.ceil((p / 100) * sorted.length)
  return sorted[Math.min(sorted.length, Math.max(1, rank)) - 1]!
}

/** Observed figures over a window. Every value is null when there is not enough data. */
export function summarize(checks: { ok: boolean; latencyMs: number | null }[]) {
  const total = checks.length
  const up = checks.filter((c) => c.ok).length
  const latencies = checks
    .filter((c) => c.ok && c.latencyMs !== null)
    .map((c) => c.latencyMs!)
    .sort((a, b) => a - b)
  const measurable = latencies.length >= MIN_SAMPLES
  return {
    checks: total,
    uptime: total === 0 ? null : up / total,
    p50: measurable ? percentile(latencies, 50) : null,
    p95: measurable ? percentile(latencies, 95) : null,
    p99: measurable ? percentile(latencies, 99) : null,
  }
}

/** Consecutive failures before an incident opens (one blip is not an incident). */
export const FAILURES_TO_OPEN = 2

/** What a check result does to incidents: open one, resolve the open one, or nothing. */
export function incidentAction(ok: boolean, hasOpen: boolean, consecutiveFailures: number) {
  if (ok) return hasOpen ? 'resolve' : 'none'
  return !hasOpen && consecutiveFailures >= FAILURES_TO_OPEN ? 'open' : 'none'
}
