'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getDataAdapter } from '@/lib/data/adapter'
import { getCurrentUser } from '@/lib/data/auth-bridge'
import { db } from '@/db/client'
import { leagues, leagueMembers, leagueInvitations } from '@/db/schema'
import { and, eq, sql } from 'drizzle-orm'
import { randomBytes } from 'crypto'
import { sendLeagueInviteEmail } from '@/lib/email'

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
    })
    .returning({ id: leagues.id })

  await db.insert(leagueMembers).values({
    leagueId: created.id,
    userId: me.id,
    role: 'owner',
  })

  // No lock-time prewarm: a new league's weeks are simply open until
  // somebody closes them, so there's nothing to precompute.

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

/** Caller's role, or null — the mutation guards below all start here. */
async function callerRole(leagueId: string) {
  const me = await getCurrentUser()
  if (!me) return { me: null, role: null }
  const adapter = await getDataAdapter()
  const role = await adapter.getUserRole(leagueId, me.id)
  return { me, role }
}

export async function inviteMember(leagueId: string, email: string) {
  const { me, role } = await callerRole(leagueId)
  if (!me) return { error: 'Unauthorized', message: null, inviteUrl: null as string | null }
  if (role !== 'owner' && role !== 'admin') {
    return { error: 'Only owners and admins can invite members', message: null, inviteUrl: null }
  }

  const normalized = email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return { error: 'That does not look like an email address', message: null, inviteUrl: null }
  }

  const adapter = await getDataAdapter()
  const members = await adapter.getLeagueMembers(leagueId)
  if (members.some((m) => m.user.email.toLowerCase() === normalized)) {
    return { error: 'That person is already in the league', message: null, inviteUrl: null }
  }

  const [league] = await db
    .select({ name: leagues.name })
    .from(leagues)
    .where(eq(leagues.id, leagueId))
    .limit(1)
  if (!league) return { error: 'League not found', message: null, inviteUrl: null }

  const token = randomBytes(24).toString('base64url')
  await db.insert(leagueInvitations).values({
    leagueId,
    email: normalized,
    invitedBy: me.id,
    token,
    expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
  })

  const base = process.env.NEXT_PUBLIC_APP_URL ?? process.env.AUTH_URL ?? 'http://localhost:3001'
  const inviteUrl = `${base.replace(/\/$/, '')}/invite/${token}`

  // Email is best-effort: the link is returned either way so the sheet's
  // copy button works even when SMTP hiccups.
  try {
    await sendLeagueInviteEmail({
      to: normalized,
      leagueName: league.name,
      inviterName: me.fullName ?? me.email,
      inviteUrl,
    })
    return { error: null, message: `Invitation sent to ${normalized}`, inviteUrl }
  } catch (err) {
    console.error('[inviteMember] email send failed:', err)
    return {
      error: null,
      message: `Couldn't send the email — copy the invite link instead`,
      inviteUrl,
    }
  }
}

export async function updateMemberRole(
  leagueId: string,
  memberId: string,
  newRole: 'admin' | 'member' | 'owner'
) {
  const { me, role } = await callerRole(leagueId)
  if (!me) return { error: 'Unauthorized' }
  // Ownership transfer is deliberately out of scope — one owner, always.
  if (newRole === 'owner') return { error: 'Ownership cannot be transferred here' }
  if (role !== 'owner') return { error: 'Only the owner can change roles' }

  const adapter = await getDataAdapter()
  const target = await adapter.getUserRole(leagueId, memberId)
  if (!target) return { error: 'Not a member of this league' }
  if (target === 'owner') return { error: "The owner's role cannot be changed" }

  await db
    .update(leagueMembers)
    .set({ role: newRole })
    .where(and(eq(leagueMembers.leagueId, leagueId), eq(leagueMembers.userId, memberId)))
  revalidatePath(`/leagues/${leagueId}`)
  return { error: null }
}

export async function removeMember(leagueId: string, memberId: string) {
  const { me, role } = await callerRole(leagueId)
  if (!me) return { error: 'Unauthorized' }
  if (role !== 'owner' && role !== 'admin') {
    return { error: 'Only owners and admins can remove members' }
  }
  if (memberId === me.id) {
    return { error: 'You cannot remove yourself' }
  }

  const adapter = await getDataAdapter()
  const target = await adapter.getUserRole(leagueId, memberId)
  if (!target) return { error: 'Not a member of this league' }
  if (target === 'owner') return { error: 'The owner cannot be removed' }
  if (target === 'admin' && role !== 'owner') {
    return { error: 'Only the owner can remove an admin' }
  }

  // Their past legs stay — the ledger is history, membership is not.
  await db
    .delete(leagueMembers)
    .where(and(eq(leagueMembers.leagueId, leagueId), eq(leagueMembers.userId, memberId)))
  revalidatePath(`/leagues/${leagueId}`)
  return { error: null }
}

export async function getLeagueByInviteCode(inviteCode: string) {
  // Deliberately NO membership filter: the whole point of a join link is
  // that a non-member holds it. Only name + code are exposed.
  const normalized = inviteCode.trim().toLowerCase()
  const [match] = await db
    .select({ id: leagues.id, name: leagues.name, inviteCode: leagues.inviteCode })
    .from(leagues)
    .where(eq(leagues.inviteCode, normalized))
    .limit(1)
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

export async function regenerateInviteCode(leagueId: string) {
  const { me, role } = await callerRole(leagueId)
  if (!me) return { inviteCode: null, error: 'Unauthorized' }
  if (role !== 'owner' && role !== 'admin') {
    return { inviteCode: null, error: 'Only owners and admins can regenerate the code' }
  }

  for (let i = 0; i < 5; i++) {
    const candidate = generateInviteCode()
    const exists = await db
      .select({ id: leagues.id })
      .from(leagues)
      .where(eq(leagues.inviteCode, candidate))
      .limit(1)
    if (!exists[0]) {
      await db.update(leagues).set({ inviteCode: candidate }).where(eq(leagues.id, leagueId))
      revalidatePath(`/leagues/${leagueId}`)
      return { inviteCode: candidate, error: null }
    }
  }
  return { inviteCode: null, error: 'Could not allocate a new code; try again' }
}

/**
 * Is there a league at all yet?
 *
 * The app is single-tenant: one league IS the app, and the creation
 * wizard is for the very first run against an empty database. A signed-in
 * person with no membership is therefore two completely different
 * situations — the founder, or somebody on the wrong email — and only
 * this tells them apart.
 *
 * Deliberately a COUNT and nothing else: it answers a yes/no question for
 * somebody who is, by definition, not a member of anything, so it must
 * not hand back a name, an id or an invite code.
 */
export async function anyLeagueExists(): Promise<boolean> {
  const me = await getCurrentUser()
  // Signed out, this question isn't anybody's business.
  if (!me) return false
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(leagues)
  return (row?.n ?? 0) > 0
}
