'use server'

import { revalidatePath } from 'next/cache'
import { getDataAdapter } from '@/lib/data/adapter'
import { getCurrentUser } from '@/lib/data/auth-bridge'
import { publish } from '@/lib/ably/server'
import { channelName, event } from '@/lib/ably/channels'

// Adapter-routed parlay actions. Parlay lifecycle is per-leg lock-on-submit
// plus the derived parlay state — there is no separate admin "lock the
// combined parlay" step.

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
  revalidatePath(`/leagues/${leagueId}`, 'layout')
  void publish(channelName.parlayLegs(leagueId, weekId), event.legResultSet, {
    legId,
    result,
  })
  return { success: true, error: null }
}
