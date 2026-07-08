// Streak computation. Walks results from most recent backward; counts how
// many consecutive results match the most recent non-null result. Pushes
// don't break a streak — they're skipped.

export type StreakResult = 'win' | 'loss'

export interface Streak {
  kind: StreakResult
  count: number
}

/**
 * Compute the active streak from a list of results ordered most-recent first.
 * Returns null when there's no graded result to anchor a streak on.
 *
 *   computeStreak(['win', 'win', 'loss']) → { kind: 'win', count: 2 }
 *   computeStreak(['loss', 'push', 'loss', 'win']) → { kind: 'loss', count: 2 }
 *   computeStreak([null, 'win']) → { kind: 'win', count: 1 }
 */
export function computeStreak(results: Array<'win' | 'loss' | 'push' | null>): Streak | null {
  let anchor: StreakResult | null = null
  let count = 0
  for (const r of results) {
    if (r === null) continue
    if (r === 'push') continue
    if (anchor === null) {
      anchor = r
      count = 1
      continue
    }
    if (r === anchor) count += 1
    else break
  }
  if (!anchor) return null
  return { kind: anchor, count }
}

/** Severity tone for a losing streak. Wins get the same level treatment. */
export function streakTone(streak: Streak): 'mild' | 'hot' | 'cold' {
  if (streak.count >= 4) return streak.kind === 'loss' ? 'cold' : 'hot'
  return 'mild'
}
