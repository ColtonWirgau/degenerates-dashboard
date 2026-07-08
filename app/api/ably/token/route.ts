// Ably token endpoint. Signs scoped capability tokens for the browser
// client so we never ship the root API key. Capabilities are derived
// from the viewer's Auth.js session + their league memberships.

import { NextResponse } from 'next/server'
import * as Ably from 'ably'
import { auth } from '@/auth'
import { db } from '@/db/client'
import { leagueMembers } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { channelName } from '@/lib/ably/channels'

export async function POST() {
  const apiKey = process.env.ABLY_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'ABLY_API_KEY not set on server' },
      { status: 503 }
    )
  }

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // Look up the user's leagues so we can scope channel capabilities.
  const memberships = await db
    .select({ leagueId: leagueMembers.leagueId })
    .from(leagueMembers)
    .where(eq(leagueMembers.userId, session.user.id))

  // Build capability map. Each league grants subscribe-only access to its
  // four event channels. The viewer can never *publish* directly — all
  // writes go through Server Actions which use the REST client server-side.
  // Read history too so a reconnect can backfill missed events.
  type Cap = ('subscribe' | 'history')[]
  const capability: { [channel: string]: Cap } = {}
  for (const m of memberships) {
    capability[channelName.polls(m.leagueId)] = ['subscribe', 'history']
    capability[channelName.charter(m.leagueId)] = ['subscribe', 'history']
    capability[channelName.roster(m.leagueId)] = ['subscribe', 'history']
    // Parlay-leg channels are league-scoped by prefix — wildcard the parlayId
    capability[`league:${m.leagueId}:parlay:*:legs`] = ['subscribe', 'history']
  }
  // NFL game channels are public (schedule data); any signed-in viewer can subscribe.
  capability['nfl:games:*'] = ['subscribe', 'history']

  const rest = new Ably.Rest({ key: apiKey })
  const tokenRequest = await rest.auth.createTokenRequest({
    clientId: session.user.id,
    capability: JSON.stringify(capability),
    ttl: 60 * 60 * 1000, // 1 hour
  })

  return NextResponse.json(tokenRequest)
}
