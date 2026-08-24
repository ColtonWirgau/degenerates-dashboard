'use server'

// League settings — which days of the week this league bets.
//
// There used to be a lock offset here too, feeding a derived deadline.
// Locking is a person's call now (see lib/lock-time.ts), so the offset
// configured nothing and went with it. On save we broadcast on the
// settings channel so any open tab re-renders its slate.

import { revalidatePath } from 'next/cache'
import { eq, and } from 'drizzle-orm'
import { db } from '@/db/client'
import { leagues, leagueMembers } from '@/db/schema'
import { auth } from '@/auth'
import { publish } from '@/lib/ably/server'
import { channelName, event } from '@/lib/ably/channels'

export interface LeagueSettings {
  slateDaysIncluded: string[]
  slateIncludeHolidays: boolean
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
  // ─── Write ────────────────────────────────────────────────────────────
  const updates: Record<string, unknown> = { updatedAt: new Date() }
  if (cleanedDays) updates.slateDaysIncluded = cleanedDays
  if (patch.slateIncludeHolidays !== undefined) {
    updates.slateIncludeHolidays = patch.slateIncludeHolidays
  }

  await db.update(leagues).set(updates).where(eq(leagues.id, leagueId))

  revalidatePath(`/leagues/${leagueId}`)
  void publish(channelName.settings(leagueId), event.settingsUpdated, {
    leagueId,
    by: guard.userId,
  })

  return { success: true, error: null }
}
