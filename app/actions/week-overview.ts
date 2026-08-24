'use server'

import { getDataAdapter } from '@/lib/data/adapter'
import { getCurrentUser } from '@/lib/data/auth-bridge'
import type { ParlayState } from '@/lib/data/types'

// Single composite read used by the week-detail page. Pulls everything the
// page needs from the adapter (parlay + legs + role + season state) so the
// page itself can stay thin and dispatch on parlay state.
//
// Returns typed domain shapes — the page renders them directly without
// reshaping. This is the pattern established by getLeagueOverview.

export interface WeekOverviewLeg {
  id: string
  description: string
  odds: number
  result: 'win' | 'loss' | 'push' | null
  legNumber: number
  lockedAt: string | null
  user: {
    id: string
    email: string
    fullName: string | null
    avatarUrl: string | null
  }
}

export interface WeekOverviewMember {
  userId: string
  fullName: string | null
  email: string
  avatarUrl: string | null
  role: 'owner' | 'admin' | 'member'
}

export interface WeekOverviewPayload {
  me: {
    id: string
    email: string
    fullName: string | null
    avatarUrl: string | null
  }
  league: { id: string; name: string; inviteCode: string }
  week: {
    id: string
    weekNumber: number
    season: string
    startDate: string | null
    endDate: string | null
    kind: string
  }
  parlayId: string
  parlayState: ParlayState
  parlayResult: 'won' | 'lost' | null
  /** True lock moment (earliest in-slate kickoff − lock offset); null = TBD. */
  lockAt: string | null
  totalOdds: string | null
  legs: WeekOverviewLeg[]
  myLeg: WeekOverviewLeg | null
  members: WeekOverviewMember[]
  notSubmittedMembers: WeekOverviewMember[]
  currentUserRole: 'owner' | 'admin' | 'member' | null
}

export async function getWeekOverview(
  leagueId: string,
  weekId: string
): Promise<{ error: string | null; payload: WeekOverviewPayload | null }> {
  const me = await getCurrentUser()
  if (!me) return { error: 'Unauthorized', payload: null }
  const adapter = await getDataAdapter()

  const league = await adapter.getLeague(leagueId, me.id)
  if (!league) {
    return { error: 'Access denied - not a member of this league', payload: null }
  }

  const [parlay, role, members] = await Promise.all([
    adapter.getParlay(weekId),
    adapter.getUserRole(leagueId, me.id),
    adapter.getLeagueMembers(leagueId),
  ])

  if (!parlay) return { error: 'Week not found', payload: null }

  const legs: WeekOverviewLeg[] = parlay.legs.map((l) => ({
    id: l.id,
    description: l.description,
    odds: l.odds,
    result: l.result,
    legNumber: l.legNumber,
    lockedAt: l.lockedAt,
    user: {
      id: l.user.id,
      email: l.user.email,
      fullName: l.user.fullName,
      avatarUrl: l.user.avatarUrl,
    },
  }))

  const memberShapes: WeekOverviewMember[] = members.map((m) => ({
    userId: m.user.id,
    fullName: m.user.fullName,
    email: m.user.email,
    avatarUrl: m.user.avatarUrl,
    role: m.role,
  }))

  const submittedIds = new Set(legs.map((l) => l.user.id))
  const notSubmittedMembers = memberShapes.filter((m) => !submittedIds.has(m.userId))

  const myLeg = legs.find((l) => l.user.id === me.id) ?? null

  return {
    error: null,
    payload: {
      me: {
        id: me.id,
        email: me.email,
        fullName: me.fullName,
        avatarUrl: me.avatarUrl,
      },
      league: { id: league.id, name: league.name, inviteCode: league.inviteCode },
      week: {
        id: parlay.week.id,
        weekNumber: parlay.week.weekNumber,
        season: parlay.week.season,
        startDate: parlay.week.startDate,
        endDate: parlay.week.endDate,
        kind: parlay.week.kind,
      },
      parlayId: parlay.id,
      parlayState: parlay.state,
      parlayResult: parlay.result,
      lockAt: parlay.lockAt,
      totalOdds: parlay.totalOdds,
      legs,
      myLeg,
      members: memberShapes,
      notSubmittedMembers,
      currentUserRole: role,
    },
  }
}
