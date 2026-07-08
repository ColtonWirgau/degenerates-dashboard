'use server'

import { revalidatePath } from 'next/cache'
import { getDataAdapter } from '@/lib/data/adapter'
import { getCurrentUser } from '@/lib/data/auth-bridge'
import { publish } from '@/lib/ably/server'
import { channelName, event } from '@/lib/ably/channels'

// Adapter-routed parlay actions. The legacy "lock the league's combined
// parlay" admin step (createFinalParlay / unlockWeekAndDeleteParlay) is
// retained as a mock-mode no-op for UI compatibility but will be cut in
// the lifecycle simplification pass — replaced by per-leg lock-on-submit.

export async function updateLegResult(
  leagueId: string,
  weekId: string,
  legId: string,
  result: 'win' | 'loss' | 'push'
) {
  const me = await getCurrentUser()
  if (!me) return { success: false, error: 'Unauthorized' }
  const adapter = await getDataAdapter()
  const role = await adapter.getUserRole(leagueId, me.id)
  if (role !== 'owner' && role !== 'admin') {
    return { success: false, error: 'Only owners and admins can update results' }
  }
  await adapter.updateLegResult(legId, result)
  revalidatePath(`/leagues/${leagueId}/weeks/${weekId}`)
  void publish(channelName.parlayLegs(leagueId, weekId), event.legResultSet, {
    legId,
    result,
  })
  return { success: true, error: null }
}

export async function getFinalParlay(weekId: string) {
  const adapter = await getDataAdapter()
  const parlay = await adapter.getParlay(weekId)
  if (!parlay) return { parlay: null, legs: [], error: null }
  return {
    parlay: {
      id: parlay.id,
      league_id: parlay.leagueId,
      total_odds: parlay.totalOdds,
      status: parlay.state === 'open' ? 'open' : parlay.state === 'locked' ? 'locked' : 'closed',
    },
    legs: parlay.legs.map((leg) => ({
      id: leg.id,
      description: leg.description,
      odds: String(leg.odds),
      result: leg.result,
      leg_number: leg.legNumber,
      created_at: leg.createdAt,
      user_id: leg.user.id,
      parlay_id: leg.parlayId,
      user: {
        id: leg.user.id,
        email: leg.user.email,
        raw_user_meta_data: {
          full_name: leg.user.fullName ?? undefined,
          avatar_url: leg.user.avatarUrl ?? undefined,
        },
      },
    })),
    error: null,
  }
}

export async function createFinalParlay(
  _weekId: string,
  _leagueId: string,
  _selectedLegIds: string[],
  _combinedOdds: string
) {
  console.warn('[mock] createFinalParlay no-op (replaced by lock-on-submit)')
  return { success: true, error: null }
}

export async function unlockWeekAndDeleteParlay(
  _weekId: string,
  _leagueId: string,
  _parlayId: string
) {
  console.warn('[mock] unlockWeekAndDeleteParlay no-op (replaced by lock-on-submit)')
  return { success: true, error: null }
}
