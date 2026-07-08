'use server'

import { getDataAdapter } from '@/lib/data/adapter'
import { getCurrentUser } from '@/lib/data/auth-bridge'
import { getActiveScenario } from '@/lib/data/active-scenario'

export async function getCurrentSeasonLeaderboard(leagueId: string) {
  const adapter = await getDataAdapter()
  const scenario = await getActiveScenario()
  const board = await adapter.getLeaderboard(leagueId, scenario.currentSeason)
  return {
    leaderboard: board.map((e) => ({
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
    error: null,
  }
}

export async function getCurrentSeasonUserStats(leagueId: string) {
  const me = await getCurrentUser()
  if (!me) return { stats: null, error: null }
  const adapter = await getDataAdapter()
  const scenario = await getActiveScenario()
  const stats = await adapter.getUserStats(leagueId, me.id, scenario.currentSeason)
  return {
    stats: {
      wins: stats.wins,
      losses: stats.losses,
      pushes: stats.pushes,
      pending: stats.pending,
      total: stats.total,
      winRate: stats.winRate,
    },
    error: null,
  }
}
