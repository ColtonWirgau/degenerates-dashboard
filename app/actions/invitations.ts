'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@/auth'
import { db } from '@/db/client'
import { leagueInvitations, leagueMembers, leagues } from '@/db/schema'
import { and, eq } from 'drizzle-orm'

// Email invitations: rows are written by inviteMember (app/actions/
// leagues.ts) and consumed here by the /invite/[token] page.

export async function getInvitation(token: string): Promise<{
  invitation: { email: string; leagues: { id: string; name: string } } | null
  error: string | null
}> {
  const [row] = await db
    .select({
      email: leagueInvitations.email,
      expiresAt: leagueInvitations.expiresAt,
      acceptedAt: leagueInvitations.acceptedAt,
      leagueId: leagues.id,
      leagueName: leagues.name,
    })
    .from(leagueInvitations)
    .innerJoin(leagues, eq(leagues.id, leagueInvitations.leagueId))
    .where(eq(leagueInvitations.token, token))
    .limit(1)

  if (!row) return { invitation: null, error: 'Invitation not found' }
  if (row.acceptedAt) return { invitation: null, error: 'Invitation already used' }
  if (row.expiresAt < new Date()) return { invitation: null, error: 'Invitation expired' }

  return {
    invitation: {
      email: row.email,
      leagues: { id: row.leagueId, name: row.leagueName },
    },
    error: null,
  }
}

export async function acceptInvitation(token: string): Promise<{
  success: boolean
  leagueId: string | null
  error: string | null
}> {
  const session = await auth()
  const userId = session?.user?.id
  const userEmail = session?.user?.email?.toLowerCase()
  if (!userId || !userEmail) {
    return { success: false, leagueId: null, error: 'Sign in first' }
  }

  const [row] = await db
    .select()
    .from(leagueInvitations)
    .where(eq(leagueInvitations.token, token))
    .limit(1)

  if (!row) return { success: false, leagueId: null, error: 'Invitation not found' }
  if (row.acceptedAt) return { success: false, leagueId: null, error: 'Invitation already used' }
  if (row.expiresAt < new Date()) {
    return { success: false, leagueId: null, error: 'Invitation expired' }
  }
  // The page checks too, but enforce here — the invite is addressed.
  if (row.email.toLowerCase() !== userEmail) {
    return { success: false, leagueId: null, error: 'This invitation was sent to a different email' }
  }

  await db
    .insert(leagueMembers)
    .values({ leagueId: row.leagueId, userId, role: 'member' })
    .onConflictDoNothing()
  await db
    .update(leagueInvitations)
    .set({ acceptedAt: new Date() })
    .where(and(eq(leagueInvitations.id, row.id), eq(leagueInvitations.token, token)))

  revalidatePath('/')
  revalidatePath(`/leagues/${row.leagueId}`)
  return { success: true, leagueId: row.leagueId, error: null }
}
