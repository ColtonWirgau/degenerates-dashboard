'use server'

// League settings — slate config + lock offset. Drives the lock-time
// derivation in `lib/lock-time.ts`. On save we recompute all cached
// league_weeks rows and broadcast on the settings channel so any open
// tab refreshes its lock time without a hard reload.

import { revalidatePath } from 'next/cache'
import { eq, and } from 'drizzle-orm'
import { db } from '@/db/client'
import { leagues, leagueMembers, nflWeeks } from '@/db/schema'
import { auth } from '@/auth'
import { computeLockAt, persistLockAt } from '@/lib/lock-time'
import { publish } from '@/lib/ably/server'
import { channelName, event } from '@/lib/ably/channels'

export interface LeagueSettings {
  slateDaysIncluded: string[]
  slateIncludeHolidays: boolean
  lockOffsetMinutes: number
}

const ALLOWED_DAYS = new Set(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'])

async function requireAdmin(leagueId: string): Promise<{ userId: string } | { error: string }> {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return { error: 'Unauthorized' }
  const [m] = await db
    .select({ role: leagueMembers.role })
    .from(leagueMembers)
    .where(and(eq(leagueMembers.leagueId, leagueId), eq(leagueMembers.userId, userId)))
    .limit(1)
  if (!m || (m.role !== 'owner' && m.role !== 'admin')) {
    return { error: 'Only commish / admins can change league settings' }
  }
  return { userId }
}

export async function getLeagueSettings(leagueId: string): Promise<{
  settings: LeagueSettings | null
  error: string | null
}> {
  const session = await auth()
  if (!session?.user?.id) return { settings: null, error: 'Unauthorized' }
  const [row] = await db
    .select({
      slateDaysIncluded: leagues.slateDaysIncluded,
      slateIncludeHolidays: leagues.slateIncludeHolidays,
      lockOffsetMinutes: leagues.lockOffsetMinutes,
    })
    .from(leagues)
    .where(eq(leagues.id, leagueId))
    .limit(1)
  if (!row) return { settings: null, error: 'League not found' }
  return { settings: row, error: null }
}

export async function updateLeagueSettings(
  leagueId: string,
  patch: Partial<LeagueSettings>
): Promise<{ success: boolean; error: string | null }> {
  const guard = await requireAdmin(leagueId)
  if ('error' in guard) return { success: false, error: guard.error }

  // ─── Validate ─────────────────────────────────────────────────────────
  const cleanedDays = patch.slateDaysIncluded
    ? Array.from(new Set(patch.slateDaysIncluded.filter((d) => ALLOWED_DAYS.has(d))))
    : undefined
  if (cleanedDays && cleanedDays.length === 0) {
    return {
      success: false,
      error: 'Slate must include at least one day',
    }
  }
  const offset = patch.lockOffsetMinutes
  if (offset !== undefined && (offset < 0 || offset > 240 || !Number.isInteger(offset))) {
    return { success: false, error: 'Lock offset must be 0–240 minutes' }
  }

  // ─── Write ────────────────────────────────────────────────────────────
  const updates: Record<string, unknown> = { updatedAt: new Date() }
  if (cleanedDays) updates.slateDaysIncluded = cleanedDays
  if (patch.slateIncludeHolidays !== undefined) {
    updates.slateIncludeHolidays = patch.slateIncludeHolidays
  }
  if (offset !== undefined) updates.lockOffsetMinutes = offset

  await db.update(leagues).set(updates).where(eq(leagues.id, leagueId))

  // ─── Recompute every cached league_week lock-time ─────────────────────
  // Cheap: 22 weeks * one query each. Could be batched later if it shows
  // up in traces.
  await recomputeAllLockTimesForLeague(leagueId)

  revalidatePath(`/leagues/${leagueId}`)
  void publish(channelName.settings(leagueId), event.settingsUpdated, {
    leagueId,
    by: guard.userId,
  })

  return { success: true, error: null }
}

export async function recomputeLockAt(
  leagueId: string,
  nflWeekId: string
): Promise<{ success: boolean; lockAt: Date | null; error: string | null }> {
  const session = await auth()
  if (!session?.user?.id) {
    return { success: false, lockAt: null, error: 'Unauthorized' }
  }
  const computed = await computeLockAt(leagueId, nflWeekId)
  await persistLockAt(leagueId, nflWeekId, computed.lockAt)
  void publish(channelName.settings(leagueId), event.lockAtRecomputed, {
    leagueId,
    nflWeekId,
    lockAt: computed.lockAt?.toISOString() ?? null,
  })
  return { success: true, lockAt: computed.lockAt, error: null }
}

export async function recomputeAllLockTimesForLeague(leagueId: string) {
  const weeks = await db.select({ id: nflWeeks.id }).from(nflWeeks)
  for (const w of weeks) {
    const computed = await computeLockAt(leagueId, w.id)
    await persistLockAt(leagueId, w.id, computed.lockAt)
  }
}
