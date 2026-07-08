'use server'

import { getDataAdapter } from '@/lib/data/adapter'
import { getCurrentUser } from '@/lib/data/auth-bridge'
import type { WeekDetailData } from '@/components/week-detail-sheet'
import type { LeaderboardEntry } from '@/components/leaderboard-sheet'

// Small focused read used by the League sheet's season switcher. Mirrors the
// per-season slice that `getLeagueOverview` builds — pulled into its own
// action so the sheet can re-fetch on chip click without re-paying for the
// full overview (polls, recent legs, etc).

export interface LeagueSeasonBundle {
  weeks: WeekDetailData[]
  leaderboard: LeaderboardEntry[]
}

export async function getLeagueSeasonBundle(
  leagueId: string,
  season: string
): Promise<{ error: string | null; payload: LeagueSeasonBundle | null }> {
  const me = await getCurrentUser()
  if (!me) return { error: 'Unauthorized', payload: null }
  const adapter = await getDataAdapter()

  const league = await adapter.getLeague(leagueId, me.id)
  if (!league) {
    return { error: 'Access denied - not a member of this league', payload: null }
  }

  const [members, parlays, leaderboard] = await Promise.all([
    adapter.getLeagueMembers(leagueId),
    adapter.getLeagueParlays(leagueId, season),
    adapter.getLeaderboard(leagueId, season),
  ])

  const weeks: WeekDetailData[] = parlays.map((p) => {
    const userLeg = p.legs.find((l) => l.user.id === me.id) ?? null
    const winners = p.legs
      .filter((l) => l.result === 'win')
      .map((l) => ({
        userId: l.user.id,
        fullName: l.user.fullName,
        email: l.user.email,
        avatarUrl: l.user.avatarUrl,
      }))
    const losers = p.legs
      .filter((l) => l.result === 'loss')
      .map((l) => ({
        userId: l.user.id,
        fullName: l.user.fullName,
        email: l.user.email,
        avatarUrl: l.user.avatarUrl,
      }))
    const submittedUsers = p.legs.map((l) => ({
      userId: l.user.id,
      fullName: l.user.fullName,
      email: l.user.email,
      avatarUrl: l.user.avatarUrl,
    }))
    const submittedIds = new Set(submittedUsers.map((u) => u.userId))
    const notSubmittedUsers = members
      .filter((m) => !submittedIds.has(m.user.id))
      .map((m) => ({
        userId: m.user.id,
        fullName: m.user.fullName,
        email: m.user.email,
        avatarUrl: m.user.avatarUrl,
      }))

    return {
      week: {
        id: p.id,
        week_number: p.week.weekNumber,
        season: p.week.season,
        deadline: p.week.startDate ?? '',
        status: (p.state === 'open'
          ? 'open'
          : p.state === 'locked' || p.state === 'graded'
            ? 'locked'
            : 'closed') as 'open' | 'locked' | 'closed',
        league_id: p.leagueId,
      },
      submissionCount: submittedUsers.length,
      userLeg: userLeg
        ? {
            id: userLeg.id,
            user_id: userLeg.user.id,
            description: userLeg.description,
            odds: String(userLeg.odds),
            result: userLeg.result,
          }
        : null,
      weekStats: {
        wins: p.legs.filter((l) => l.result === 'win').length,
        losses: p.legs.filter((l) => l.result === 'loss').length,
        pushes: p.legs.filter((l) => l.result === 'push').length,
        pending: p.legs.filter((l) => l.result === null).length,
      },
      legs: p.legs.map((l) => ({
        id: l.id,
        userId: l.user.id,
        fullName: l.user.fullName,
        email: l.user.email,
        avatarUrl: l.user.avatarUrl,
        description: l.description,
        odds: l.odds,
        result: l.result,
      })),
      winners,
      losers,
      submittedUsers,
      notSubmittedUsers,
      parlayState: p.state,
      totalOdds: p.totalOdds,
    }
  })

  return {
    error: null,
    payload: {
      weeks,
      leaderboard: leaderboard.map((e) => ({
        userId: e.user.id,
        fullName: e.user.fullName,
        email: e.user.email,
        avatarUrl: e.user.avatarUrl,
        wins: e.wins,
        losses: e.losses,
        pushes: e.pushes,
        total: e.total,
        winRate: e.winRate,
      })),
    },
  }
}
