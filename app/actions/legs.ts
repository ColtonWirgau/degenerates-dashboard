'use server'

import { revalidatePath } from 'next/cache'
import { getDataAdapter } from '@/lib/data/adapter'
import { getCurrentUser } from '@/lib/data/auth-bridge'
import { validateParlayLegs } from '@/lib/openai'
import { publish } from '@/lib/ably/server'
import { channelName, event } from '@/lib/ably/channels'

// Slim wrapper around the data adapter for leg-related reads. The previous
// "submit a multi-leg parlay" flow has been removed in favor of one-leg-
// per-user-per-week (the actual model used in production data).

export interface SubmitLegResult {
  success: boolean
  error: string | null
  /** Set when AI validation flags a conflict against existing legs. */
  warning?: { conflictsWith: string[]; reason: string }
}

// League odds caps: legs must be in [-200, +200]. Mirrored in the client
// odds slider so users can't even pick out-of-range values, but server-side
// enforcement keeps the rule honest.
const ODDS_MIN = -200
const ODDS_MAX = 200

export async function submitLeg(
  weekId: string,
  leagueId: string,
  leg: { description: string; odds: string }
): Promise<SubmitLegResult> {
  const me = await getCurrentUser()
  if (!me) return { success: false, error: 'Unauthorized' }

  const oddsNum = parseInt(leg.odds, 10)
  if (isNaN(oddsNum)) {
    return { success: false, error: 'Odds must be a number.' }
  }
  if (oddsNum === 0 || (oddsNum > -100 && oddsNum < 100)) {
    return { success: false, error: 'Odds must be at most -100 or at least +100.' }
  }
  if (oddsNum < ODDS_MIN || oddsNum > ODDS_MAX) {
    return {
      success: false,
      error: `League rule: odds must be between ${ODDS_MIN} and +${ODDS_MAX}.`,
    }
  }

  const adapter = await getDataAdapter()

  // Allow editing while the parlay is still open. Once the parlay locks
  // (everyone in / deadline elapsed) submission is final.
  const existingParlay = await adapter.getParlay(weekId)
  if (existingParlay && existingParlay.state !== 'open') {
    return {
      success: false,
      error: 'The parlay is locked for this week — no more edits.',
    }
  }

  // Pull existing locked legs (excluding this user's own) so we can validate
  // the new leg against them.
  const otherLegs = (existingParlay?.legs ?? []).filter(
    (l) => l.user.id !== me.id && l.lockedAt !== null
  )

  let validationStatus: 'approved' | 'conflicting' = 'approved'
  let validationMessage = 'Valid'
  let warning: SubmitLegResult['warning']

  if (otherLegs.length > 0) {
    const fullParlay = [
      ...otherLegs.map((l) => ({
        description: l.description,
        odds: String(l.odds),
        userName: l.user.fullName ?? l.user.email,
      })),
      { description: leg.description, odds: leg.odds, userName: 'You' },
    ]
    const aiResult = (await validateParlayLegs(fullParlay)) as
      | { legs?: Array<{ status?: string; conflicts_with?: number[]; reason?: string }> }
      | null
    const myIdx = fullParlay.length - 1
    const mine = aiResult?.legs?.[myIdx]
    if (mine?.status === 'conflicting') {
      validationStatus = 'conflicting'
      validationMessage = mine.reason ?? 'Conflicts with another submitted leg'
      const conflictsWith = (mine.conflicts_with ?? [])
        .map((n) => fullParlay[n - 1]?.userName)
        .filter((n): n is string => !!n && n !== 'You')
      warning = {
        conflictsWith,
        reason: mine.reason ?? 'This leg conflicts with another already-submitted leg.',
      }
    }
  }

  const submittedLeg = await adapter.submitLeg({
    parlayId: weekId,
    userId: me.id,
    description: leg.description,
    odds: oddsNum,
    validationStatus,
    validationMessage,
  })
  revalidatePath(`/leagues/${leagueId}/weeks/${weekId}`)
  revalidatePath(`/leagues/${leagueId}`)
  // Fire real-time event so other tabs/devices see "N of 12 submitted"
  // tick up without waiting for their polling interval.
  void publish(channelName.parlayLegs(leagueId, weekId), event.legSubmitted, {
    legId: submittedLeg.id,
    userId: me.id,
    lockedAt: submittedLeg.lockedAt,
  })
  return { success: true, error: null, warning }
}

export async function getUserLeg(weekId: string) {
  const me = await getCurrentUser()
  if (!me) return { leg: null, error: null }
  const adapter = await getDataAdapter()
  const parlay = await adapter.getParlay(weekId)
  const leg = parlay?.legs.find((l) => l.user.id === me.id) ?? null
  if (!leg) return { leg: null, error: null }
  return {
    leg: {
      id: leg.id,
      description: leg.description,
      odds: String(leg.odds),
      result: leg.result,
      leg_number: leg.legNumber,
      created_at: leg.createdAt,
      locked_at: leg.lockedAt,
      user_id: leg.user.id,
      parlay_id: leg.parlayId,
    },
    error: null,
  }
}

export async function getAllLegsForWeek(weekId: string) {
  const adapter = await getDataAdapter()
  const parlay = await adapter.getParlay(weekId)
  if (!parlay) return { legs: [], error: null }
  return {
    legs: parlay.legs.map((leg) => ({
      id: leg.id,
      description: leg.description,
      odds: String(leg.odds),
      result: leg.result,
      leg_number: leg.legNumber,
      created_at: leg.createdAt,
      locked_at: leg.lockedAt,
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

// ─── Mutations (mock-mode stubs / adapter pass-through) ────────────────────

export async function deleteLeg(weekId: string, legId: string, leagueId: string) {
  const me = await getCurrentUser()
  if (!me) return { success: false, error: 'Unauthorized' }
  const adapter = await getDataAdapter()

  // Authorization: the user can delete their own leg; owners/admins can
  // delete anyone's. Look up the leg to check ownership.
  const parlay = await adapter.getParlay(weekId)
  const target = parlay?.legs.find((l) => l.id === legId)
  if (!target) return { success: false, error: 'Leg not found' }

  if (target.user.id !== me.id) {
    const role = await adapter.getUserRole(leagueId, me.id)
    if (role !== 'owner' && role !== 'admin') {
      return { success: false, error: 'You can only delete your own leg' }
    }
  }

  await adapter.deleteLeg(legId)
  revalidatePath(`/leagues/${leagueId}/weeks/${weekId}`)
  revalidatePath(`/leagues/${leagueId}`)
  void publish(channelName.parlayLegs(leagueId, weekId), event.legDeleted, {
    legId,
    userId: target.user.id,
  })
  return { success: true, error: null }
}

export async function updateLegAsAdmin(
  weekId: string,
  _legId: string,
  leagueId: string,
  _input: { description: string; odds: string }
) {
  console.warn('[mock] updateLegAsAdmin no-op')
  revalidatePath(`/leagues/${leagueId}/weeks/${weekId}`)
  return { success: true, error: null }
}

export async function submitLegForUser(
  _weekId: string,
  _leagueId: string,
  _userId: string,
  _leg: { description: string; odds: string }
) {
  console.warn('[mock] submitLegForUser no-op')
  return { success: true, error: null }
}

// Re-exported for legacy import sites — same shape as season-scoped variants.
export async function getLeaderboard(leagueId: string) {
  const { getCurrentSeasonLeaderboard } = await import('./legs-current-season')
  return getCurrentSeasonLeaderboard(leagueId)
}

export async function getUserStats(leagueId: string) {
  const { getCurrentSeasonUserStats } = await import('./legs-current-season')
  return getCurrentSeasonUserStats(leagueId)
}
