import { getLeagueOverviewCached } from '@/lib/data/league-overview-cached'
import { getLeagues } from '@/app/actions/leagues'
import { getCurrentUser } from '@/lib/data/auth-bridge'
import { getDevToolbarData, getDevPhaseData } from '@/lib/data/dev-toolbar-data'
import { LeagueChromeProvider, type LeagueChrome } from '@/components/chrome/league-chrome-context'
import { Masthead } from '@/components/chrome/masthead'
import { CanvasSheet } from '@/components/chrome/canvas-sheet'
import { PageSheet } from '@/components/chrome/page-sheet'
import { MobileDock } from '@/components/chrome/mobile-dock'
import { LeagueSheetHost } from '@/components/chrome/league-sheet-host'
import { PanelReveal } from '@/components/chrome/panel-reveal'
import { SlatePanel, type SlatePanelWeek } from '@/components/chrome/panels/slate-panel'
import { BoardPanel } from '@/components/chrome/panels/board-panel'
import { PollsPanel } from '@/components/chrome/panels/polls-panel'
import { SubmitReveal } from '@/components/chrome/panels/submit-reveal'
import type { LeagueSwitcherRow } from '@/components/league-sheet'

/**
 * The league shell — the canvas-reveal chrome around every league route.
 * A segment layout on purpose: the league id is in the URL, so this can
 * fetch all panel data per-league, and Next keeps layouts mounted across
 * navigations within the segment — the chrome (bubbles, dock, open
 * panels, springs) holds perfectly still while only the card content
 * swaps between the league page and a week page.
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
  const [{ leagues }, mock, devPhase] = await Promise.all([
    me ? getLeagues() : Promise.resolve({ leagues: [] }),
    getDevToolbarData(),
    getDevPhaseData(),
  ])
  const switcherRows: LeagueSwitcherRow[] = leagues.map((l) => ({
    id: l.id,
    name: l.name,
    role: (l.league_members?.[0]?.role ?? 'member') as LeagueSwitcherRow['role'],
  }))

  const currentWeekData = p.allWeeksData[p.currentWeekIndex]
  const isInSeason =
    p.seasonState.kind === 'regular-season' ||
    p.seasonState.kind === 'playoffs' ||
    p.seasonState.kind === 'super-bowl'
  const myRankIdx = p.leaderboard.findIndex((e) => e.userId === p.me.id)

  const chrome: LeagueChrome = {
    leagueId: p.league.id,
    leagueName: p.league.name,
    season: p.season,
    seasonKind: p.seasonState.kind,
    weekNumber: isInSeason ? (currentWeekData?.week.week_number ?? null) : null,
    currentWeekId: isInSeason ? (currentWeekData?.week.id ?? null) : null,
    submitted: isInSeason ? currentWeekData?.userLeg != null : false,
    lockAt: isInSeason ? currentWeekData?.week.deadline || null : null,
    myRank: myRankIdx >= 0 ? myRankIdx + 1 : null,
    memberCount: p.members.length,
    submittedCount: isInSeason ? (currentWeekData?.submissionCount ?? 0) : 0,
    openPollCount: p.polls.filter((poll) => poll.status === 'open').length,
    me: {
      id: p.me.id,
      fullName: p.me.fullName,
      email: p.me.email,
      avatarUrl: p.me.avatarUrl,
    },
  }

  const slateWeeks: SlatePanelWeek[] = p.allWeeksData.map((wd, idx) => ({
    id: wd.week.id,
    weekNumber: wd.week.week_number,
    parlayState: wd.parlayState,
    submissionCount: wd.submissionCount,
    memberCount: p.members.length,
    myResult: wd.userLeg?.result ?? null,
    isCurrent: isInSeason && idx === p.currentWeekIndex,
  }))

  const pollRows = p.polls
    .filter((poll) => poll.status === 'open' || poll.status === 'closed')
    .map((poll) => ({
      id: poll.id,
      title: poll.title,
      status: poll.status,
      totalVotes: poll.responses.length,
      memberCount: p.members.length,
      viewerVoted: poll.responses.some((r) => r.userId === p.me.id),
    }))

  const myCurrentLeg = currentWeekData?.userLeg
    ? {
        description: currentWeekData.userLeg.description,
        odds: parseInt(currentWeekData.userLeg.odds, 10) || 0,
        result: currentWeekData.userLeg.result,
      }
    : null

  return (
    <LeagueChromeProvider value={chrome}>
      <div className="flex min-h-[100dvh] flex-col lg:h-svh lg:overflow-hidden">
        <Masthead />
        <CanvasSheet
          slatePanel={
            <PanelReveal panel="slate" title="The Slate">
              <SlatePanel leagueId={p.league.id} weeks={slateWeeks} />
            </PanelReveal>
          }
          boardPanel={
            <PanelReveal panel="board" title="Leaderboard">
              <BoardPanel entries={p.leaderboard} currentUserId={p.me.id} />
            </PanelReveal>
          }
          pollsPanel={
            <PanelReveal panel="polls" title="Polls">
              <PollsPanel leagueId={p.league.id} polls={pollRows} />
            </PanelReveal>
          }
          submitPanel={
            <PanelReveal panel="submit" title={`Week ${chrome.weekNumber ?? ''} · Your leg`}>
              <SubmitReveal leagueId={p.league.id} myLeg={myCurrentLeg} />
            </PanelReveal>
          }
        >
          <PageSheet>{children}</PageSheet>
        </CanvasSheet>
        <MobileDock />
        {me && (
          <LeagueSheetHost
            leagueId={p.league.id}
            leagueName={p.league.name}
            memberCount={p.members.length}
            season={p.season}
            inviteCode={p.league.invite_code}
            canManage={p.currentUserRole === 'owner' || p.currentUserRole === 'admin'}
            currentUserRole={p.currentUserRole ?? 'member'}
            weeks={p.allWeeksData}
            currentWeekIndex={isInSeason ? p.currentWeekIndex : -1}
            members={p.members.map((m) => ({
              userId: m.user_id,
              fullName: m.full_name,
              email: m.email,
              avatarUrl: m.avatar_url,
              role: m.role,
            }))}
            currentUserId={p.me.id}
            leaderboard={p.leaderboard}
            availableSeasons={p.availableSeasons}
            leagues={switcherRows}
            user={me}
            mock={mock}
            devPhase={devPhase}
          />
        )}
      </div>
    </LeagueChromeProvider>
  )
}
