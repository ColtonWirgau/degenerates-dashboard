import { getLeagueOverviewCached } from '@/lib/data/league-overview-cached'
import { getLeagueWeeksCached } from '@/lib/data/league-weeks-cached'
import { getCurrentUser } from '@/lib/data/auth-bridge'
import { getDataAdapter } from '@/lib/data/adapter'
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
import { SeasonPanel } from '@/components/chrome/panels/season-panel'
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

  const chromeWeeks: ChromeWeek[] = weeks.map((w) => {
    const wd = w.parlayId ? byParlay.get(w.parlayId) : undefined
    return {
      id: w.nflWeekId,
      weekNumber: w.weekNumber,
      kind: w.kind,
      hasSlate: w.kind !== 'preseason',
      parlayId: w.parlayId,
      parlayState: wd?.parlayState ?? 'open',
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
    me: {
      id: p.me.id,
      fullName: p.me.fullName,
      email: p.me.email,
      avatarUrl: p.me.avatarUrl,
    },
  }

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
              <SeasonPanel availableSeasons={p.availableSeasons} />
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
              <BoardPanel entries={p.leaderboard} currentUserId={p.me.id} />
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

        {/* Everything you can DO to the league — opened from the season
            panel's tiles, on whichever page you pressed. */}
        <LeagueSheet
          leagueId={p.league.id}
          leagueName={p.league.name}
          memberCount={p.members.length}
          inviteCode={p.league.invite_code}
          season={p.season}
          availableSeasons={p.availableSeasons}
          canManage={p.currentUserRole === 'owner' || p.currentUserRole === 'admin'}
          currentUserRole={p.currentUserRole ?? 'member'}
          currentUserId={p.me.id}
          members={p.members.map((m) => ({
            userId: m.user_id,
            fullName: m.full_name,
            email: m.email,
            avatarUrl: m.avatar_url,
            role: m.role,
          }))}
          leaderboard={p.leaderboard}
          weeks={p.allWeeksData}
          currentWeekIndex={p.currentWeekIndex}
          devPhase={devPhase}
          mock={mock}
        />

      </div>
    </LeagueChromeProvider>
  )
}
