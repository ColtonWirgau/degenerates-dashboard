'use server'

/**
 * CLOSING THE WEEK.
 *
 * This is the app's version of the thing that actually happens in the
 * league: whoever places the bet says "that's everyone, I'm putting the
 * ticket in", and the week stops taking entries. Nothing closes on its
 * own — no clock knows when somebody walks up to the counter.
 *
 * Reopening is allowed right up until the first game we've bet kicks
 * off, and refused after: past that the results are arriving, and a new
 * entry would be a bet on a game somebody has already watched.
 */

import { revalidatePath } from 'next/cache'
import { getDataAdapter } from '@/lib/data/adapter'
import { getCurrentUser } from '@/lib/data/auth-bridge'
import { getDevNow } from '@/lib/data/dev-now'
import { firstSlateKickoff, getWeekLock, setWeekLocked } from '@/lib/lock-time'
import { publish } from '@/lib/ably/server'
import { channelName, event } from '@/lib/ably/channels'

export async function setWeekLock(
  leagueId: string,
  nflWeekId: string,
  locked: boolean
): Promise<{ success: boolean; error: string | null }> {
  const me = await getCurrentUser()
  if (!me) return { success: false, error: 'Unauthorized' }

  const adapter = await getDataAdapter()
  const role = await adapter.getUserRole(leagueId, me.id)
  if (role !== 'owner' && role !== 'admin') {
    return { success: false, error: 'Only owners and admins can lock a week' }
  }

  const now = await getDevNow()
  const result = await setWeekLocked(leagueId, nflWeekId, locked, now)
  if (!result.ok) return { success: false, error: result.error }

  revalidatePath(`/leagues/${leagueId}`, 'layout')
  void publish(channelName.settings(leagueId), event.weekLockChanged, {
    leagueId,
    nflWeekId,
    locked,
    by: me.id,
  })
  return { success: true, error: null }
}

/** What the header needs to render the control: is it closed, and can
 *  that still be taken back. */
export async function getWeekLockState(leagueId: string, nflWeekId: string) {
  const [lockedAt, kickoff, now] = await Promise.all([
    getWeekLock(leagueId, nflWeekId),
    firstSlateKickoff(leagueId, nflWeekId),
    getDevNow(),
  ])
  return {
    locked: lockedAt !== null,
    reopenable: kickoff === null || kickoff > now,
    lockedAt: lockedAt?.toISOString() ?? null,
  }
}
