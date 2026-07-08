'use server'

import { getDataAdapter } from '@/lib/data/adapter'
import { getActiveScenario } from '@/lib/data/active-scenario'

export interface UserDetailLeg {
  id: string
  weekNumber: number
  weekKind: string
  description: string
  odds: number
  result: 'win' | 'loss' | 'push' | null
  lockedAt: string | null
  parlayId: string
}

export interface UserDetailPayload {
  user: {
    id: string
    fullName: string | null
    email: string
    avatarUrl: string | null
  }
  league: { id: string; name: string }
  season: string
  stats: { wins: number; losses: number; pushes: number; pending: number; total: number; winRate: number }
  legs: UserDetailLeg[]
}

/**
 * Fetch a single user's bet history for a league + season. The season
 * defaults to the active scenario's currentSeason; callers (e.g. the
 * Final Standings drill-in during offseason) can pass an explicit season
 * to override.
 */
export async function getUserDetail(
  leagueId: string,
  userId: string,
  season?: string
): Promise<{ payload: UserDetailPayload | null; error: string | null }> {
  const adapter = await getDataAdapter()
  const scenario = await getActiveScenario()
  const resolvedSeason = season ?? scenario.currentSeason

  const league = await adapter.getLeague(leagueId, userId)
  // We need the league but `getLeague` gates by membership. For "view another
  // member's stats" we relax that — try one of the existing members as the
  // viewer-side check by reading members directly.
  const members = await adapter.getLeagueMembers(leagueId)
  const target = members.find((m) => m.user.id === userId)
  if (!target) return { payload: null, error: 'Member not found' }

  // Pull league info — fall back to a minimal shape if access-gated lookup
  // returned null (we already verified target is a member).
  const leagueRow = league
    ? { id: league.id, name: league.name }
    : { id: leagueId, name: 'League' }

  const parlays = await adapter.getLeagueParlays(leagueId, resolvedSeason)
  const legs: UserDetailLeg[] = []
  let wins = 0, losses = 0, pushes = 0, pending = 0
  for (const p of parlays) {
    const myLeg = p.legs.find((l) => l.user.id === userId)
    if (!myLeg) continue
    legs.push({
      id: myLeg.id,
      weekNumber: p.week.weekNumber,
      weekKind: p.week.kind,
      description: myLeg.description,
      odds: myLeg.odds,
      result: myLeg.result,
      lockedAt: myLeg.lockedAt,
      parlayId: p.id,
    })
    if (myLeg.result === 'win') wins++
    else if (myLeg.result === 'loss') losses++
    else if (myLeg.result === 'push') pushes++
    else pending++
  }
  legs.sort((a, b) => b.weekNumber - a.weekNumber)

  const decided = wins + losses
  const winRate = decided ? (wins / decided) * 100 : 0

  return {
    payload: {
      user: {
        id: target.user.id,
        fullName: target.user.fullName,
        email: target.user.email,
        avatarUrl: target.user.avatarUrl,
      },
      league: leagueRow,
      season: resolvedSeason,
      stats: { wins, losses, pushes, pending, total: legs.length, winRate },
      legs,
    },
    error: null,
  }
}
