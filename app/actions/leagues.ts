'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getDataAdapter } from '@/lib/data/adapter'
import { getCurrentUser } from '@/lib/data/auth-bridge'
import { db } from '@/db/client'
import { leagues, leagueMembers } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { recomputeAllLockTimesForLeague } from '@/app/actions/league-settings'

// Read paths flow through the data adapter (mock or supabase). Mutations
// stay on Supabase for now since the mock store is in-memory and resets
// on dev-server reload — fine for UI iteration, not for live writes.

export async function getLeagues() {
  const me = await getCurrentUser()
  if (!me) return { leagues: [], error: null }
  const adapter = await getDataAdapter()
  const leagues = await adapter.getLeaguesForUser(me.id)
  // Match the shape the existing UI expects until we migrate it to the
  // typed domain shape: { league_members: [{ role }] }.
  const out = await Promise.all(
    leagues.map(async (l) => {
      const role = await adapter.getUserRole(l.id, me.id)
      return {
        id: l.id,
        name: l.name,
        created_at: l.createdAt,
        invite_code: l.inviteCode,
        league_members: [{ role: role ?? 'member' }],
      }
    })
  )
  return { leagues: out, error: null }
}

export async function getLeague(leagueId: string) {
  const me = await getCurrentUser()
  if (!me) return { league: null, error: 'Unauthorized' }
  const adapter = await getDataAdapter()
  const league = await adapter.getLeague(leagueId, me.id)
  if (!league) {
    return { league: null, error: 'Access denied - not a member of this league' }
  }
  return {
    league: {
      id: league.id,
      name: league.name,
      created_at: league.createdAt,
      invite_code: league.inviteCode,
      created_by: league.createdBy,
    },
    error: null,
  }
}

export async function getLeagueMembers(leagueId: string) {
  const adapter = await getDataAdapter()
  const members = await adapter.getLeagueMembers(leagueId)
  // Reshape to the legacy structure the UI expects.
  return {
    members: members.map((m) => ({
      id: `${leagueId}::${m.user.id}`,
      user_id: m.user.id,
      full_name: m.user.fullName,
      email: m.user.email,
      avatar_url: m.user.avatarUrl,
      raw_user_meta_data: { full_name: m.user.fullName, avatar_url: m.user.avatarUrl },
      role: m.role,
      joined_at: m.joinedAt,
    })),
    error: null,
  }
}

export async function getCurrentUserRole(leagueId: string) {
  const me = await getCurrentUser()
  if (!me) return { role: null, error: null }
  const adapter = await getDataAdapter()
  const role = await adapter.getUserRole(leagueId, me.id)
  return { role, error: null }
}

// ─── Mutations ────────────────────────────────────────────────────────────
// Stubbed during the mock-iteration phase — they revalidate the relevant
// path so the UI re-renders, but don't persist anywhere.

// Invite codes are short, alphanumeric, lowercase. Bias toward characters
// that don't ambiguate over a text message (no 0/O, 1/I/l).
const INVITE_CHARSET = 'abcdefghjkmnpqrstuvwxyz23456789'
function generateInviteCode(len = 6): string {
  let out = ''
  for (let i = 0; i < len; i++) {
    out += INVITE_CHARSET[Math.floor(Math.random() * INVITE_CHARSET.length)]
  }
  return out
}

export interface CreateLeagueInput {
  name: string
  inviteCode?: string
  slateDaysIncluded?: string[]
  slateIncludeHolidays?: boolean
  lockOffsetMinutes?: number
}

export async function createLeague(input: CreateLeagueInput) {
  const me = await getCurrentUser()
  if (!me) return { error: 'Unauthorized', leagueId: null }

  const name = input.name?.trim() ?? ''
  if (name.length < 3) {
    return { error: 'League name must be at least 3 characters', leagueId: null }
  }
  if (name.length > 60) {
    return { error: 'League name is too long (60 char max)', leagueId: null }
  }

  // Code may be user-supplied (wizard step 1) or auto-generated. If
  // user-supplied, normalize + collision-check; if missing, generate
  // until we find a free one (collision probability tiny but possible).
  let inviteCode = input.inviteCode?.trim().toLowerCase() ?? ''
  if (inviteCode) {
    if (!/^[a-z0-9]{4,12}$/.test(inviteCode)) {
      return {
        error: 'Invite code must be 4–12 letters/numbers',
        leagueId: null,
      }
    }
    const taken = await db
      .select({ id: leagues.id })
      .from(leagues)
      .where(eq(leagues.inviteCode, inviteCode))
      .limit(1)
    if (taken[0]) {
      return { error: 'That invite code is taken — try another', leagueId: null }
    }
  } else {
    // Retry up to 5 times against accidental collisions.
    for (let i = 0; i < 5; i++) {
      const candidate = generateInviteCode()
      const exists = await db
        .select({ id: leagues.id })
        .from(leagues)
        .where(eq(leagues.inviteCode, candidate))
        .limit(1)
      if (!exists[0]) {
        inviteCode = candidate
        break
      }
    }
    if (!inviteCode) {
      return { error: 'Could not allocate an invite code; try again', leagueId: null }
    }
  }

  const slateDays = input.slateDaysIncluded?.length
    ? input.slateDaysIncluded
    : ['sun', 'mon']
  const lockOffset = input.lockOffsetMinutes ?? 10
  const includeHolidays = input.slateIncludeHolidays ?? true

  // Insert league + creator-as-owner row in sequence. Wrap in a tx if
  // we ever need more steps here (e.g. seeding default polls/charter).
  const [created] = await db
    .insert(leagues)
    .values({
      name,
      inviteCode,
      createdBy: me.id,
      slateDaysIncluded: slateDays,
      slateIncludeHolidays: includeHolidays,
      lockOffsetMinutes: lockOffset,
    })
    .returning({ id: leagues.id })

  await db.insert(leagueMembers).values({
    leagueId: created.id,
    userId: me.id,
    role: 'owner',
  })

  // Pre-warm league_weeks cache with the right lock times so the league
  // page renders correctly from the first load. Cheap.
  try {
    await recomputeAllLockTimesForLeague(created.id)
  } catch (err) {
    // Non-fatal: if it fails, the cron job will catch up.
    console.warn('[createLeague] lock-time prewarm failed:', err)
  }

  revalidatePath('/')
  return { leagueId: created.id, error: null }
}

// Back-compat shim for the old name-only form. Will be removed once
// the wizard is the only entry point.
export async function createLeagueFromForm(formData: FormData) {
  const name = formData.get('name') as string
  const res = await createLeague({ name })
  if (res.error) return { error: res.error }
  if (res.leagueId) redirect(`/leagues/${res.leagueId}`)
  return { error: 'Unknown error' }
}

export async function inviteMember(_leagueId: string, _email: string) {
  console.warn('[mock] inviteMember no-op')
  return {
    error: null,
    message: 'Invitation simulated (mock mode)',
    inviteUrl: null as string | null,
  }
}

export async function updateMemberRole(
  _leagueId: string,
  _memberId: string,
  newRole: 'admin' | 'member' | 'owner'
) {
  console.warn('[mock] updateMemberRole no-op', newRole)
  return { error: null }
}

export async function removeMember(_leagueId: string, _memberId: string) {
  console.warn('[mock] removeMember no-op')
  return { error: null }
}

export async function getLeagueByInviteCode(inviteCode: string) {
  const adapter = await getDataAdapter()
  const me = await getCurrentUser()
  if (!me) return { league: null, error: null }
  const leagues = await adapter.getLeaguesForUser(me.id)
  const match = leagues.find((l) => l.inviteCode === inviteCode)
  if (!match) return { league: null, error: 'Invite code not found' }
  return {
    league: { id: match.id, name: match.name, invite_code: match.inviteCode },
    error: null,
  }
}

export async function joinLeagueByInviteCode(inviteCode: string) {
  const me = await getCurrentUser()
  if (!me) {
    return { success: false, leagueId: null, error: 'Sign in first' }
  }
  const normalized = inviteCode.trim().toLowerCase()
  if (!normalized) {
    return { success: false, leagueId: null, error: 'No invite code provided' }
  }
  const [target] = await db
    .select({ id: leagues.id })
    .from(leagues)
    .where(eq(leagues.inviteCode, normalized))
    .limit(1)
  if (!target) {
    return { success: false, leagueId: null, error: 'Invite code not found' }
  }
  // Membership PK is (league_id, user_id) — onConflictDoNothing makes
  // re-joining a no-op instead of an error.
  await db
    .insert(leagueMembers)
    .values({ leagueId: target.id, userId: me.id, role: 'member' })
    .onConflictDoNothing()
  revalidatePath('/')
  return { success: true, leagueId: target.id, error: null }
}

export async function regenerateInviteCode(_leagueId: string) {
  console.warn('[mock] regenerateInviteCode no-op')
  return { inviteCode: `mock${Date.now().toString(36).slice(-4)}`, error: null }
}
