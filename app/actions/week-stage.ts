'use server'

import { getDataAdapter } from '@/lib/data/adapter'
import { getCurrentUser } from '@/lib/data/auth-bridge'
import { getWeekSlate } from '@/lib/data/week-slate'
import type { LegRoster } from '@/components/week-detail-sheet'
import type { ParlayState } from '@/lib/data/types'
import type { SlateGame } from '@/lib/data/week-slate'

/**
 * ONE WEEK'S CONTENT, fetched on demand.
 *
 * The app is a single page: picking a week doesn't navigate, it asks for
 * this and swaps what the card is showing. Only the things that actually
 * differ per week travel — the games, the legs, the lock — because the
 * league-level facts (the roster, the charter, the standings) were sent
 * once with the shell.
 */
export interface WeekStagePayload {
  nflWeekId: string
  weekNumber: number
  kind: 'preseason' | 'regular'
  /** Null for the preseason week — nothing to bet, so nothing to lock. */
  parlayId: string | null
  parlayState: ParlayState
  /** True lock moment; null = TBD. */
  lockAt: string | null
  kickoff: string | null
  /** How many games each slate scope would show. Null when there's no slate. */
  scopeCounts: { action: number; slate: number; all: number } | null
  games: SlateGame[] | null
  legs: LegRoster[]
  /** Whether the parlay is still taking legs (nobody's sealed it yet). */
  submissionsOpen: boolean
}

export async function getWeekStage(
  leagueId: string,
  nflWeekId: string
): Promise<{ error: string | null; payload: WeekStagePayload | null }> {
  const me = await getCurrentUser()
  if (!me) return { error: 'Unauthorized', payload: null }
  const adapter = await getDataAdapter()

  const league = await adapter.getLeague(leagueId, me.id)
  if (!league) {
    return { error: 'Access denied - not a member of this league', payload: null }
  }

  const dataSource = process.env.NEXT_PUBLIC_DATA_SOURCE ?? 'mock'

  // Opening a week is what creates its parlay — lazily, so a week nobody
  // has looked at costs nothing and a new league is never a dead end.
  const parlay = await adapter.ensureWeekParlay(leagueId, nflWeekId)
  if (!parlay) return { error: 'Week not found', payload: null }

  const members = await adapter.getLeagueMembers(leagueId)
  const slate = dataSource === 'neon' ? await getWeekSlate(leagueId, nflWeekId) : null

  const legs: LegRoster[] = parlay.legs.map((l) => ({
    id: l.id,
    userId: l.user.id,
    fullName: l.user.fullName,
    email: l.user.email,
    avatarUrl: l.user.avatarUrl,
    description: l.description,
    odds: l.odds,
    result: l.result,
  }))

  const everyoneIn = legs.length >= members.length && legs.length > 0
  const submissionsOpen =
    parlay.state === 'open' || (parlay.state === 'locked' && !everyoneIn)

  return {
    error: null,
    payload: {
      nflWeekId,
      weekNumber: parlay.week.weekNumber,
      kind: parlay.week.kind === 'preseason' ? 'preseason' : 'regular',
      parlayId: parlay.id,
      parlayState: parlay.state,
      lockAt: parlay.lockAt,
      kickoff: parlay.week.startDate,
      scopeCounts: slate
        ? {
            action: legs.length,
            slate: slate.games.filter((g) => g.inSlate).length,
            all: slate.games.length,
          }
        : null,
      games: slate?.games ?? null,
      legs,
      submissionsOpen,
    },
  }
}
