'use server'

import { getDataAdapter } from '@/lib/data/adapter'
import { getCurrentUser } from '@/lib/data/auth-bridge'
import { getActiveScenario } from '@/lib/data/active-scenario'
import { generateMockPolls } from '@/lib/data/mock-polls'
import type { LeaguePoll } from '@/lib/data/mock-polls'
import { generateMockCharter } from '@/lib/data/mock-charter'
import type { CharterEntry } from '@/lib/data/mock-charter'

// Single composite read used by the league page. Pulls everything the page
// needs from the adapter so the page itself can stay thin (no data plumbing,
// just rendering).
//
// Returns legacy-shaped objects to match what the existing components
// (week-navigator, leaderboard, recent-legs) consume, until those get
// migrated to the typed domain shapes.

export async function getLeagueOverview(leagueId: string) {
  const me = await getCurrentUser()
  if (!me) {
    return { error: 'Unauthorized' as const, payload: null }
  }
  const adapter = await getDataAdapter()

  const league = await adapter.getLeague(leagueId, me.id)
  if (!league) {
    return { error: 'Access denied - not a member of this league' as const, payload: null }
  }

  const scenario = await getActiveScenario()
  // Resolve which season's data to display based on the season state. In
  // offseason / preseason there's no current season to populate the page
  // with, so we recap the most recently completed one.
  const seasonState = await adapter.getSeasonState()
  const displaySeason =
    (seasonState.kind === 'offseason' || seasonState.kind === 'preseason') &&
    seasonState.kind === 'offseason' &&
    seasonState.lastSeason
      ? seasonState.lastSeason
      : seasonState.kind === 'preseason'
        ? // Preseason → recap the most recently completed season.
          (() => {
            const startYear = parseInt(scenario.currentSeason.split('-')[0]!, 10)
            return `${startYear - 1}-${startYear}`
          })()
        : scenario.currentSeason

  const [members, role, currentWeek, parlays, leaderboard, userStats] = await Promise.all([
    adapter.getLeagueMembers(leagueId),
    adapter.getUserRole(leagueId, me.id),
    adapter.getCurrentWeek(scenario.currentSeason),
    adapter.getLeagueParlays(leagueId, displaySeason),
    adapter.getLeaderboard(leagueId, displaySeason),
    adapter.getUserStats(leagueId, me.id, displaySeason),
  ])
  const season = displaySeason

  // Seasons the user can switch between in the user-detail sheet picker.
  // Mock generates the current scenario season + the immediately-prior one.
  // Future Sleeper history walking will extend this list.
  const prevSeason = (() => {
    const startYear = parseInt(scenario.currentSeason.split('-')[0]!, 10)
    return `${startYear - 1}-${startYear}`
  })()
  const availableSeasons = [scenario.currentSeason, prevSeason]

  // Build per-week summaries the league page expects.
  const allWeeksData = parlays.map((p) => {
    const userLeg = p.legs.find((l) => l.user.id === me.id) ?? null
    const winners = p.legs
      .filter((l) => l.result === 'win')
      .map((l) => ({
        userId: l.user.id,
        fullName: l.user.fullName,
        email: l.user.email,
        avatarUrl: l.user.avatarUrl,
      }))
    const losers = p.legs
      .filter((l) => l.result === 'loss')
      .map((l) => ({
        userId: l.user.id,
        fullName: l.user.fullName,
        email: l.user.email,
        avatarUrl: l.user.avatarUrl,
      }))
    const submittedUsers = p.legs.map((l) => ({
      userId: l.user.id,
      fullName: l.user.fullName,
      email: l.user.email,
      avatarUrl: l.user.avatarUrl,
    }))
    const submittedIds = new Set(submittedUsers.map((u) => u.userId))
    const notSubmittedUsers = members
      .filter((m) => !submittedIds.has(m.user.id))
      .map((m) => ({
        userId: m.user.id,
        fullName: m.user.fullName,
        email: m.user.email,
        avatarUrl: m.user.avatarUrl,
      }))

    return {
      week: {
        id: p.id, // URL convention: weekId in URL is the parlay id
        week_number: p.week.weekNumber,
        season: p.week.season,
        deadline: p.week.startDate ?? '',
        status: ((p.state === 'open'
          ? 'open'
          : p.state === 'locked' || p.state === 'graded'
            ? 'locked'
            : 'closed') as 'open' | 'locked' | 'closed'),
        league_id: p.leagueId,
      },
      submissionCount: submittedUsers.length,
      userLeg: userLeg
        ? {
            id: userLeg.id,
            description: userLeg.description,
            odds: String(userLeg.odds),
            result: userLeg.result,
            user_id: userLeg.user.id,
            parlay_id: userLeg.parlayId,
            leg_number: userLeg.legNumber,
            created_at: userLeg.createdAt,
          }
        : null,
      weekStats: {
        wins: p.legs.filter((l) => l.result === 'win').length,
        losses: p.legs.filter((l) => l.result === 'loss').length,
        pushes: p.legs.filter((l) => l.result === 'push').length,
        pending: p.legs.filter((l) => l.result === null).length,
      },
      // Full leg roster — used by the week sheet to render a flat list of
      // every member's leg once the parlay locks (results-implied; the
      // separate Winners/Losers drill pages collapse into one stream).
      legs: p.legs.map((l) => ({
        id: l.id,
        userId: l.user.id,
        fullName: l.user.fullName,
        email: l.user.email,
        avatarUrl: l.user.avatarUrl,
        description: l.description,
        odds: l.odds,
        result: l.result,
      })),
      winners,
      losers,
      submittedUsers,
      notSubmittedUsers,
      parlayState: p.state,
      totalOdds: p.totalOdds,
    }
  })

  // Recent legs for the current user (across all weeks, latest first, dedup
  // by week, take top 3 — matching the prior page's behavior).
  const myLegsByWeek = new Map<number, { id: string; description: string; odds: string; result: 'win' | 'loss' | 'push' | null; week_number: number; week_id: string }>()
  for (const p of [...parlays].reverse()) {
    const myLeg = p.legs.find((l) => l.user.id === me.id)
    if (!myLeg) continue
    if (myLegsByWeek.has(p.week.weekNumber)) continue
    myLegsByWeek.set(p.week.weekNumber, {
      id: myLeg.id,
      description: myLeg.description,
      odds: String(myLeg.odds),
      result: myLeg.result,
      week_number: p.week.weekNumber,
      week_id: p.id,
    })
  }
  const currentWeekNumber = currentWeek?.weekNumber
  const myFinishedLegs = Array.from(myLegsByWeek.values())
    .filter((l) => l.week_number !== currentWeekNumber)
    .sort((a, b) => b.week_number - a.week_number)
  const recentLegs = myFinishedLegs.slice(0, 3)
  // Sequence of the user's own results most-recent-first for the form
  // sparkline + streak callout in the performance panel. weekId + description
  // let the sparkline cells open the week sheet on tap and surface the leg
  // text on hover.
  const userResultSequence = myFinishedLegs.map((l) => ({
    weekNumber: l.week_number,
    weekId: l.week_id,
    result: l.result,
    description: l.description,
  }))

  const currentWeekIndex = currentWeek
    ? allWeeksData.findIndex((wd) => wd.week.week_number === currentWeek.weekNumber)
    : -1

  // Polls + charter: branch by data source. In neon mode read real rows
  // (auto-seeding the charter template the first time a league hits this
  // path). In mock mode use the deterministic generators we've been
  // iterating against. Schema-shape is identical either way so consumers
  // don't notice.
  const dataSource = process.env.NEXT_PUBLIC_DATA_SOURCE ?? 'mock'
  let polls: LeaguePoll[]
  let charter: CharterEntry[]
  if (dataSource === 'neon') {
    polls = await adapter.getPolls(league.id, { statuses: ['open', 'closed'] })
    charter = await adapter.getCharter(league.id, season)
    // First-time load for this league/season → bootstrap the standard
    // 26-entry charter template, then re-read.
    if (charter.length === 0) {
      await adapter.seedCharterForLeague(league.id, season, me.id)
      charter = await adapter.getCharter(league.id, season)
    }
  } else {
    polls = generateMockPolls({
      leagueId: league.id,
      members: members.map((m) => m.user),
      viewerId: me.id,
      now: new Date(scenario.now),
      viewerAnsweredEverything: seasonState.kind === 'preseason',
    })
    charter = generateMockCharter({
      leagueId: league.id,
      members: members.map((m) => m.user),
      viewerId: me.id,
      now: new Date(scenario.now),
      season,
      polls,
    })
  }

  return {
    error: null,
    payload: {
      me,
      league: {
        id: league.id,
        name: league.name,
        invite_code: league.inviteCode,
        created_by: league.createdBy,
      },
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
      currentUserRole: role,
      currentWeek: currentWeek
        ? {
            id: `${league.id}::${currentWeek.id}`,
            week_number: currentWeek.weekNumber,
            season: currentWeek.season,
            kind: currentWeek.kind,
            startDate: currentWeek.startDate,
            endDate: currentWeek.endDate,
          }
        : null,
      currentWeekIndex: currentWeekIndex >= 0 ? currentWeekIndex : 0,
      allWeeksData,
      userStats: {
        wins: userStats.wins,
        losses: userStats.losses,
        pushes: userStats.pushes,
        winRate: userStats.winRate,
      },
      leaderboard: leaderboard.map((e) => ({
        userId: e.user.id,
        fullName: e.user.fullName,
        email: e.user.email,
        avatarUrl: e.user.avatarUrl,
        wins: e.wins,
        losses: e.losses,
        pushes: e.pushes,
        total: e.total,
        winRate: e.winRate,
      })),
      recentLegs,
      userResultSequence,
      season,
      seasonState,
      availableSeasons,
      polls,
      charter,
    },
  }
}
