'use server'

import { revalidatePath } from 'next/cache'
import { getDataAdapter } from '@/lib/data/adapter'
import { getActiveScenario } from '@/lib/data/active-scenario'

// Slim wrapper around the data adapter for week-related reads. Mutations
// (createWeek, updateWeekStatus, etc.) are stubbed for the mock-iteration
// phase — most are slated for removal in lifecycle simplification anyway.

export async function getCurrentWeek(_leagueId: string) {
  const adapter = await getDataAdapter()
  const scenario = await getActiveScenario()
  const week = await adapter.getCurrentWeek(scenario.currentSeason)
  if (!week) return { week: null, error: null }
  return {
    week: {
      id: week.id,
      week_number: week.weekNumber,
      season: week.season,
      deadline: week.startDate ?? '',
      status: 'open' as const,
    },
    error: null,
  }
}

export async function getWeeks(leagueId: string) {
  const adapter = await getDataAdapter()
  const scenario = await getActiveScenario()
  const parlays = await adapter.getLeagueParlays(leagueId, scenario.currentSeason)
  return {
    weeks: parlays.map((p) => ({
      id: p.id,
      week_number: p.week.weekNumber,
      season: p.week.season,
      deadline: p.week.startDate ?? '',
      created_at: p.week.startDate ?? '',
      status: ((p.state === 'open'
        ? 'open'
        : p.state === 'locked' || p.state === 'graded'
          ? 'locked'
          : 'closed') as 'open' | 'locked' | 'closed'),
      league_id: p.leagueId,
    })),
    error: null,
  }
}

export async function getWeek(weekId: string) {
  const adapter = await getDataAdapter()
  const parlay = await adapter.getParlay(weekId)
  if (!parlay) return { week: null, error: 'Week not found' }
  return {
    week: {
      id: parlay.id,
      week_number: parlay.week.weekNumber,
      season: parlay.week.season,
      deadline: parlay.week.startDate ?? '',
      status: ((parlay.state === 'open'
        ? 'open'
        : parlay.state === 'locked' || parlay.state === 'graded'
          ? 'locked'
          : 'closed') as 'open' | 'locked' | 'closed'),
      league_id: parlay.leagueId,
      total_odds: parlay.totalOdds,
    },
    error: null,
  }
}

export async function getWeekSubmissionCounts(weekIds: string[]): Promise<Record<string, number>> {
  const adapter = await getDataAdapter()
  const counts: Record<string, number> = {}
  await Promise.all(
    weekIds.map(async (id) => {
      const p = await adapter.getParlay(id)
      counts[id] = p?.legs.length ?? 0
    })
  )
  return counts
}

export async function getLeagueStats(leagueId: string) {
  const adapter = await getDataAdapter()
  const scenario = await getActiveScenario()
  const parlays = await adapter.getLeagueParlays(leagueId, scenario.currentSeason)
  const wins = parlays.filter((p) => p.result === 'won').length
  const losses = parlays.filter((p) => p.result === 'lost').length
  const total = wins + losses
  return {
    stats: {
      wins,
      losses,
      total,
      winRate: total ? (wins / total) * 100 : 0,
    },
    error: null,
  }
}

// ─── Mutations (stubbed for mock mode) ─────────────────────────────────────

export async function createWeek(_leagueId: string, _formData: FormData) {
  console.warn('[mock] createWeek no-op')
  return { error: null, weekId: null }
}
export async function updateWeekStatus(
  _leagueId: string,
  _weekId: string,
  _status: string
) {
  console.warn('[mock] updateWeekStatus no-op')
  return { error: null }
}
export async function updateWeekDeadline(
  _leagueId: string,
  _weekId: string,
  _deadline: string
) {
  console.warn('[mock] updateWeekDeadline no-op')
  return { error: null }
}
export async function deleteWeek(leagueId: string, _weekId: string) {
  console.warn('[mock] deleteWeek no-op')
  revalidatePath(`/leagues/${leagueId}`)
  return { error: null }
}
export async function closeWeekAndCreateNext(_leagueId: string, _weekId: string) {
  console.warn('[mock] closeWeekAndCreateNext no-op')
  return { error: null, nextWeekId: null }
}
