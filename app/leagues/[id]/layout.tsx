import { getLeagueOverviewCached } from '@/lib/data/league-overview-cached'
import { getLeagueWeeksCached } from '@/lib/data/league-weeks-cached'
import { getCurrentUser } from '@/lib/data/auth-bridge'
import { getDataAdapter } from '@/lib/data/adapter'
import { getDevNow } from '@/lib/data/dev-now'
import { getDevToolbarData, getDevPhaseData } from '@/lib/data/dev-toolbar-data'
import {
  LeagueChromeProvider,
  type ChromeWeek,
  type LeagueChrome,
} from '@/components/chrome/league-chrome-context'
import { Masthead } from '@/components/chrome/masthead'
import { CanvasSheet } from '@/components/chrome/canvas-sheet'
import { PageSheet } from '@/components/chrome/page-sheet'
import { MobileDock } from '@/components/chrome/mobile-dock'
import { LeagueSheet } from '@/components/chrome/league-sheet'
import {
  SeasonPanel,
  type SeasonPanelMember,
} from '@/components/chrome/panels/season-panel'
import { PanelReveal } from '@/components/chrome/panel-reveal'
import { SlatePanel } from '@/components/chrome/panels/slate-panel'
import { BoardPanel } from '@/components/chrome/panels/board-panel'
import {
  PollsPanel,
  type PollsPanelPoll,
} from '@/components/chrome/panels/polls-panel'
import {
  SubmitReveal,
  type SubmitRevealLeg,
} from '@/components/chrome/panels/submit-reveal'
import {
  ParlayPanel,
  type ParlayPanelWeek,
} from '@/components/chrome/panels/parlay-panel'
import { ProfilePanel } from '@/components/chrome/panels/profile-panel'

/**
 * The league shell — the canvas-reveal chrome around every league route.
 *
 * A segment layout on purpose: the league id is in the URL, so this can
 * fetch everything the chrome needs per-league, and Next keeps layouts
 * mounted across navigations within the segment — the bubbles, dock, open
 * panels and springs hold perfectly still while only the card's content
 * swaps from one week to the next.
 *
 * What it hands the chrome is THE SEASON'S WEEKS. Every bubble, cell and
 * bite is a function of the week you're looking at, so the shell holds
 * all of them and the week page says which one it is (see WeekSync).
 */
export default async function LeagueShellLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const result = await getLeagueOverviewCached(id)

  // No access / not signed in → no chrome; the page renders its own
  // error surface on the bare canvas.
  if (result.error || !result.payload) {
    return <>{children}</>
  }

  const p = result.payload
  const me = await getCurrentUser()
  const [{ weeks, currentWeek }, mock, devPhase] = await Promise.all([
    getLeagueWeeksCached(id, p.season),
    getDevToolbarData(),
    getDevPhaseData(),
  ])

  // Week rows carry their parlay's state, which the overview already
  // computed — keyed by parlay id, since that's what allWeeksData calls
  // a "week".
  const byParlay = new Map(p.allWeeksData.map((wd) => [wd.week.id, wd]))
  // A rank only means something once somebody has actually won or lost.
  // Before then the table is twelve zeroes in arbitrary order, and
  // stamping "#3" on the viewer's bubble would be inventing a standing.
  const seasonHasResults = p.leaderboard.some((e) => e.wins + e.losses + e.pushes > 0)
  const myRankIdx = seasonHasResults
    ? p.leaderboard.findIndex((e) => e.userId === p.me.id)
    : -1

  const now = await getDevNow()
  const chromeWeeks: ChromeWeek[] = weeks.map((w) => {
    const wd = w.parlayId ? byParlay.get(w.parlayId) : undefined
    // A week nobody ever opened a parlay for still ended when it ended.
    // Defaulting those to 'open' is what left whole finished seasons
    // claiming they were still taking legs.
    const closed = w.endDate !== null && new Date(w.endDate) <= now
    return {
      id: w.nflWeekId,
      weekNumber: w.weekNumber,
      kind: w.kind,
      hasSlate: w.kind !== 'preseason',
      parlayId: w.parlayId,
      closed,
      parlayState: wd?.parlayState ?? (closed ? 'locked' : 'open'),
      submissionCount: wd?.submissionCount ?? w.submissionCount,
      myResult: wd?.userLeg?.result ?? null,
      submitted: wd?.userLeg != null,
      lockAt: wd?.week.deadline || null,
      openPollCount: w.openPollCount,
      pollCount: w.pollCount,
    }
  })

  const chrome: LeagueChrome = {
    leagueId: p.league.id,
    leagueName: p.league.name,
    season: p.season,
    seasonKind: p.seasonState.kind,
    weeks: chromeWeeks,
    currentWeekId: currentWeek?.nflWeekId ?? null,
    myRank: myRankIdx >= 0 ? myRankIdx + 1 : null,
    memberCount: p.members.length,
    // The BOARD bubble wears the podium. Same guard as the rank: before
    // anyone has a result the table is twelve zeroes in arbitrary order,
    // and gilding the first three of those would be inventing a standing.
    podium: seasonHasResults
      ? p.leaderboard.slice(0, 3).map((e) => ({
          userId: e.userId,
          fullName: e.fullName,
          email: e.email,
          avatarUrl: e.avatarUrl,
        }))
      : [],
    me: {
      id: p.me.id,
      fullName: p.me.fullName,
      email: p.me.email,
      avatarUrl: p.me.avatarUrl,
    },
  }

  // The roster, each carrying their record for the season being shown —
  // the season panel is where "who was in it and how did they do" gets
  // answered, so the two facts travel together.
  const recordByUser = new Map(p.leaderboard.map((e) => [e.userId, e]))
  const seasonMembers: SeasonPanelMember[] = p.members.map((m) => {
    const record = recordByUser.get(m.user_id)
    return {
      userId: m.user_id,
      fullName: m.full_name,
      email: m.email,
      avatarUrl: m.avatar_url,
      role: m.role,
      wins: record?.wins ?? 0,
      losses: record?.losses ?? 0,
      pushes: record?.pushes ?? 0,
    }
  })

  // Every poll in the season, tagged with its week — the panel picks out
  // the viewed week's without another round trip when you change weeks.
  const adapter = await getDataAdapter()
  const dataSource = process.env.NEXT_PUBLIC_DATA_SOURCE ?? 'mock'
  const seasonPolls =
    dataSource === 'neon'
      ? await adapter.getPolls(p.league.id, { statuses: ['open', 'closed'] })
      : p.polls
  const weekIds = new Set(weeks.map((w) => w.nflWeekId))
  const preseasonId = weeks.find((w) => w.kind === 'preseason')?.nflWeekId ?? null
  const pollRows: PollsPanelPoll[] = seasonPolls
    // A poll with no week is league business by default → the preseason.
    .map((poll) => ({ poll, weekId: poll.nflWeekId ?? preseasonId }))
    .filter((r): r is { poll: (typeof seasonPolls)[number]; weekId: string } =>
      r.weekId != null && weekIds.has(r.weekId)
    )
    .map(({ poll, weekId }) => ({
      id: poll.id,
      nflWeekId: weekId,
      title: poll.title,
      status: poll.status,
      totalVotes: poll.responses.length,
      viewerVoted: poll.responses.some((r) => r.userId === p.me.id),
    }))

  // Per-week payloads for the two right/left panels that answer for
  // "the week you're looking at": your own leg, and the whole lay.
  const legsByWeek: Record<string, SubmitRevealLeg> = {}
  const layByWeek: Record<string, ParlayPanelWeek> = {}
  for (const w of chromeWeeks) {
    const wd = w.parlayId ? byParlay.get(w.parlayId) : undefined
    if (!wd) continue
    if (wd.userLeg) {
      legsByWeek[w.id] = {
        description: wd.userLeg.description,
        odds: parseInt(wd.userLeg.odds, 10) || 0,
        result: wd.userLeg.result,
      }
    }
    layByWeek[w.id] = {
      legs: wd.legs,
      missing: wd.notSubmittedUsers,
      totalOdds: wd.totalOdds,
    }
  }

  return (
    <LeagueChromeProvider value={chrome}>
      <div className="flex min-h-[100dvh] flex-col lg:h-svh lg:overflow-hidden">
        <Masthead />
        <CanvasSheet
          seasonPanel={
            <PanelReveal panel="season">
              <SeasonPanel
                availableSeasons={p.availableSeasons}
                members={seasonMembers}
                currentUserId={p.me.id}
                currentUserRole={p.currentUserRole ?? 'member'}
                devPhase={devPhase}
              />
            </PanelReveal>
          }
          slatePanel={
            <PanelReveal panel="slate">
              <SlatePanel laysByWeek={layByWeek} />
            </PanelReveal>
          }
          parlayPanel={
            <PanelReveal panel="parlay">
              <ParlayPanel weeks={layByWeek} />
            </PanelReveal>
          }
          boardPanel={
            <PanelReveal panel="board">
              <BoardPanel
                entries={p.leaderboard}
                currentUserId={p.me.id}
                weeks={chromeWeeks}
                laysByWeek={layByWeek}
              />
            </PanelReveal>
          }
          pollsPanel={
            <PanelReveal panel="polls">
              <PollsPanel polls={pollRows} />
            </PanelReveal>
          }
          submitPanel={
            <PanelReveal panel="submit">
              <SubmitReveal leagueId={p.league.id} legsByWeek={legsByWeek} />
            </PanelReveal>
          }
          profilePanel={
            <PanelReveal panel="profile">
              {me && (
                <ProfilePanel user={me} myRank={chrome.myRank} stats={p.userStats} />
              )}
            </PanelReveal>
          }
        >
          <PageSheet>{children}</PageSheet>
        </CanvasSheet>
        <MobileDock />

        {/* The invite flow — the last thing that still wants a portaled
            sheet rather than a 19rem column. */}
        <LeagueSheet
          leagueId={p.league.id}
          inviteCode={p.league.invite_code}
          canManage={p.currentUserRole === 'owner' || p.currentUserRole === 'admin'}
          mock={mock}
        />

      </div>
    </LeagueChromeProvider>
  )
}
