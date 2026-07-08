import { getLeagueOverview } from '@/app/actions/league-overview'
import { Header } from '@/components/header'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { PerformanceSection } from '@/components/performance-section'
import { CurrentWeekDock } from '@/components/current-week-dock'
import { OffseasonPollsHub } from '@/components/offseason-polls-hub'
import { WeekSlate } from '@/components/week-slate'
import { WeekSlateDock } from '@/components/week-slate-dock'
import { LeagueBar } from '@/components/league-bar'
import { SaveLastLeague } from '@/components/save-last-league'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Lock } from 'lucide-react'

export default async function LeaguePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const result = await getLeagueOverview(id)

  if (result.error === 'Access denied - not a member of this league') {
    return (
      <div className="min-h-[100dvh] ambient-glow">
        <Header />
        <main className="container mx-auto px-4 py-8 pt-24 pb-24">
          <Card className="glass-card border-primary/30 max-w-2xl mx-auto">
            <CardContent className="text-center py-12 space-y-4">
              <Lock className="h-10 w-10 text-muted-foreground mx-auto" />
              <div>
                <h3 className="text-2xl font-bold mb-2">Access Denied</h3>
                <p className="text-muted-foreground mb-4">
                  You are not a member of this league. Ask a league admin for an invite link to join.
                </p>
                <Link href="/">
                  <Button className="neon-glow-blue">Back to Leagues</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    )
  }

  if (result.error || !result.payload) notFound()

  const {
    me,
    league,
    members,
    currentUserRole,
    currentWeekIndex,
    allWeeksData,
    userStats,
    leaderboard,
    recentLegs,
    userResultSequence,
    seasonState,
    season,
    availableSeasons,
    polls,
    charter,
  } = result.payload

  const currentWeekData = allWeeksData[currentWeekIndex]
  const isOffOrPreseason =
    seasonState.kind === 'offseason' || seasonState.kind === 'preseason'

  const canManage = currentUserRole === 'owner' || currentUserRole === 'admin'
  const isInSeason =
    seasonState.kind === 'regular-season' ||
    seasonState.kind === 'playoffs' ||
    seasonState.kind === 'super-bowl'
  // The strip pulses the "current" week — only meaningful in-season. For
  // off/preseason recap we render it with no current marker.
  const sheetCurrentWeekIndex = isInSeason ? currentWeekIndex : -1

  // Member roster used by the LeagueSheet's Members tab.
  const sheetMembers = members.map((m) => ({
    userId: m.user_id,
    fullName: m.full_name,
    email: m.email,
    avatarUrl: m.avatar_url,
    role: m.role,
  }))

  return (
    <div className="min-h-[100dvh] ambient-glow">
      <SaveLastLeague leagueId={id} />

      <LeagueBar
        leagueId={league.id}
        leagueName={league.name}
        memberCount={members.length}
        season={season}
        inviteCode={league.invite_code}
        canManage={canManage}
        weeks={allWeeksData}
        currentWeekIndex={sheetCurrentWeekIndex}
        members={sheetMembers}
        currentUserId={me.id}
        leaderboard={leaderboard}
        availableSeasons={availableSeasons}
      />

      <main className="container mx-auto px-4 py-8 pt-24 pb-56">
        {/* Dual-dock — for off-/preseason the dual-dock pivots to polls
            (results aggregate up top, single-poll editor at the bottom).
            In-season the league-context dock is folded into the WeekSlate
            section's heading (<WeekSlateDock>), so this slot only mounts
            <OffseasonPollsHub>'s top dock for the polls flow. */}
        {isOffOrPreseason && (
          <OffseasonPollsHub
            leagueId={league.id}
            polls={polls}
            charter={charter}
            seasonState={seasonState}
            currentUserId={me.id}
            membersCount={members.length}
            members={members.map((m) => ({
              id: m.user_id,
              fullName: m.full_name,
              email: m.email,
              avatarUrl: m.avatar_url,
            }))}
          />
        )}

        {isInSeason && (
          <>
            {/* WeekSlate's section heading IS the in-season top dock —
                "WEEK N · SLATE" with state-aware status (live pulse, locks
                countdown, won/lost) in the trailing slot and the league's
                lay (legs + slackers) in the expanded panel. */}
            {currentWeekData && (
              <WeekSlateDock
                data={currentWeekData}
                currentUserId={me.id}
                membersCount={members.length}
              />
            )}

            {userStats && (
              <section className="mt-10 sm:mt-12">
                <PerformanceSection
                  leagueId={id}
                  currentUserId={me.id}
                  recentLegs={recentLegs}
                  userResultSequence={userResultSequence}
                  stats={userStats}
                  leaderboard={leaderboard}
                  allWeeksData={allWeeksData}
                  membersCount={members.length}
                  availableSeasons={availableSeasons}
                  defaultSeason={season}
                />
              </section>
            )}
          </>
        )}

        {/* Preseason — Week 1 slate preview. Same `<WeekSlate>` used
            in-season so the drill-down + day grouping stays consistent
            across the season lifecycle. */}
        {seasonState.kind === 'preseason' && (
          <WeekSlate weekNumber={1} firstKickoff={seasonState.nextKickoff} />
        )}
      </main>

      {/* Floating bottom dock — primary action surface for the current week.
          Only renders during in-season states; offseason/preseason have no
          week. */}
      {currentWeekData && isInSeason && (
        <CurrentWeekDock
          data={currentWeekData}
          leagueId={id}
          membersCount={members.length}
          currentUser={{
            fullName: me.fullName,
            email: me.email,
            avatarUrl: me.avatarUrl,
          }}
        />
      )}

      {/* Off-/preseason bottom dock is mounted by <OffseasonPollsHub>
          above (paired with its top dock). No separate render here. */}
    </div>
  )
}
