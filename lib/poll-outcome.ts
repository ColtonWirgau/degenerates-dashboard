import type { LeaguePoll } from '@/lib/data/mock-polls'

/**
 * WHAT A VOTE ACTUALLY SAID — one implementation, because two would
 * drift and this number ends up written into the league's rule book.
 *
 * The ballot uses it to stop asking a question that's already answered;
 * closing a poll uses it to settle the charter entry the poll hangs off.
 * Before this existed, closing a vote flipped the poll's own status and
 * did nothing else, so the book went on saying "On the ballot" about a
 * question the league had finished arguing about.
 */

export interface PollTally {
  /** option id → votes (single/multi) or points (ranked). */
  counts: Map<string, number>
  /** How many people answered at all. */
  voters: number
}

/**
 * Ranked polls score Borda-style: a first choice out of three is worth
 * three, a second two, a third one. It's the ordering the ballot already
 * shows people, so the settled value matches what they watched happen.
 */
export function tallyPoll(poll: LeaguePoll): PollTally {
  const counts = new Map<string, number>()
  for (const o of poll.options) counts.set(o.id, 0)
  const bump = (id: string, by = 1) => {
    if (counts.has(id)) counts.set(id, (counts.get(id) ?? 0) + by)
  }

  const voters = new Set<string>()
  for (const r of poll.responses) {
    let counted = false
    if (r.choiceId) {
      bump(r.choiceId)
      counted = true
    }
    for (const id of r.choiceIds ?? []) {
      bump(id)
      counted = true
    }
    for (const s of r.rankings ?? []) {
      const top = poll.maxRanks ?? 3
      bump(s.choiceId, Math.max(1, top - (s.rank - 1)))
      counted = true
    }
    if (counted) voters.add(r.userId)
  }
  return { counts, voters: voters.size }
}

/**
 * Is the answer already fixed?
 *
 * A single-choice question stops being a question the moment the leader
 * is further ahead than every outstanding vote could close — seven of
 * twelve against with three left to vote means the other side tops out
 * at five. Nobody is waiting for anything.
 *
 * SINGLE-CHOICE ONLY. Ranked is instant-runoff-shaped: a trailing option
 * can still win on redistribution, so calling it early would be a guess
 * wearing arithmetic's clothes.
 */
export function decidedBy(
  counts: Map<string, number>,
  memberCount: number
): { winnerId: string; margin: number } | null {
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1])
  const [first, second] = sorted
  if (!first || first[1] === 0) return null
  const cast = [...counts.values()].reduce((a, b) => a + b, 0)
  const outstanding = Math.max(0, memberCount - cast)
  const chaser = (second?.[1] ?? 0) + outstanding
  return first[1] > chaser ? { winnerId: first[0], margin: first[1] - chaser } : null
}

/**
 * The outcome in words, for the rule book. Null when nobody has voted —
 * a closed poll with no answers settles nothing, and writing "—" into
 * the book would look like a decision.
 *
 * A ranked poll settles as its whole ordering, because "choose your top
 * 3 punishments" has a top three as its answer, not a winner.
 */
export function outcomeLabel(poll: LeaguePoll): string | null {
  const { counts } = tallyPoll(poll)
  const scored = [...counts.entries()]
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
  if (scored.length === 0) return null
  const labelOf = (id: string) => poll.options.find((o) => o.id === id)?.label ?? null

  if (poll.kind === 'ranked') {
    const top = poll.maxRanks ?? 3
    const names = scored.slice(0, top).map(([id]) => labelOf(id)).filter(Boolean)
    return names.length > 0 ? names.join(' · ') : null
  }

  // A dead heat is a real result and gets said, rather than picking one.
  const best = scored[0]![1]
  const tied = scored.filter(([, n]) => n === best).map(([id]) => labelOf(id)).filter(Boolean)
  return tied.length > 0 ? tied.join(' / ') : null
}
