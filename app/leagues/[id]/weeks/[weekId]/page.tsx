import { getWeekOverview } from '@/app/actions/week-overview'
import { Header } from '@/components/header'
import { LeagueBar } from '@/components/league-bar'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { SubmitLegForm } from '@/components/submit-leg-form'
import { AddLegForUserDialog } from '@/components/add-leg-for-user-dialog'
import { TheLay } from '@/components/the-lay'
import { YourLockedLeg } from '@/components/your-locked-leg'
import { SubmissionProgress } from '@/components/submission-progress'
import { ParlayResultAnimation } from '@/components/parlay-result-animation'
import { SaveLastLeague } from '@/components/save-last-league'
import { DeadlineDisplay } from '@/components/deadline-display'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Clock, Lock, CheckCircle2, Trophy, Skull } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { ParlayState } from '@/lib/data/types'

// Thin dispatcher. Reads the composite week overview, branches on
// derived ParlayState, renders one of five focused views.
//
//   1. open + you haven't submitted     → submission form + progress
//   2. open + you've submitted (locked) → your-locked-leg + progress
//   3. locked (everyone in, no results) → TheLay (assembled, awaiting)
//   4. graded (some results in)         → TheLay (with grading chips)
//   5. won / lost                       → TheLay (hero + leg breakdown)

export default async function WeekDetailPage({
  params,
}: {
  params: Promise<{ id: string; weekId: string }>
}) {
  const { id: leagueId, weekId } = await params
  const result = await getWeekOverview(leagueId, weekId)

  if (result.error === 'Access denied - not a member of this league') {
    return (
      <div className="min-h-screen ambient-glow">
        <Header />
        <main className="container mx-auto px-4 py-8 pt-24">
          <Card className="glass-card border-primary/30 max-w-2xl mx-auto">
            <CardContent className="text-center py-12 space-y-4">
              <Lock className="h-10 w-10 text-muted-foreground mx-auto" />
              <h3 className="text-2xl font-bold">Access Denied</h3>
              <p className="text-muted-foreground">
                You are not a member of this league.
              </p>
              <Link href="/">
                <Button className="neon-glow-blue">Back to Leagues</Button>
              </Link>
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
    week,
    parlayId,
    parlayState,
    parlayResult,
    totalOdds,
    legs,
    myLeg,
    members,
    notSubmittedMembers,
    currentUserRole,
  } = result.payload

  const canManage = currentUserRole === 'owner' || currentUserRole === 'admin'
  const submittedMembers = members.filter((m) =>
    legs.some((l) => l.user.id === m.userId)
  )

  // The adapter's ParlayState says 'locked' the moment all *submitted* legs
  // are locked — but the parlay isn't really sealed until every member is
  // in. From the user's perspective, the experience is:
  //   - Submissions still open if anyone is missing → states 1 or 2
  //   - Everyone in, no results → state 3 (locked)
  //   - Some results in / fully graded → states 4 / 5
  // We collapse that here so the rest of the page is a simple branch.
  const everyoneIn = legs.length >= members.length && legs.length > 0
  const submissionsOpen = parlayState === 'open' || (parlayState === 'locked' && !everyoneIn)

  return (
    <div className="min-h-screen ambient-glow">
      <SaveLastLeague leagueId={leagueId} />

      {/* Win/loss confetti — fires once when graded results land for the
          current user. */}
      {(parlayState === 'won' || parlayState === 'lost') && myLeg && !canManage && (
        <ParlayResultAnimation
          result={myLeg.result}
          userParlay={{ legs: [{ result: myLeg.result }] }}
        />
      )}

      <LeagueBar
        leagueId={league.id}
        leagueName={league.name}
        memberCount={members.length}
        season={week.season}
        inviteCode={league.inviteCode}
        canManage={canManage}
        currentUserRole={currentUserRole ?? 'member'}
        weeks={[]}
        currentWeekIndex={-1}
        members={members.map((m) => ({
          userId: m.userId,
          fullName: m.fullName,
          email: m.email,
          avatarUrl: m.avatarUrl,
          role: m.role,
        }))}
        currentUserId={me.id}
        leaderboard={[]}
        availableSeasons={[week.season]}
      />

      <main className="container mx-auto px-4 py-8 pt-24 pb-24">
        {/* Header — back arrow, title, status pill */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
          <Link href={`/leagues/${leagueId}`}>
            <Button variant="outline" size="icon" className="glass border-primary/30">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl sm:text-4xl font-bold">Week {week.weekNumber}</h1>
              <StatusPill state={submissionsOpen ? 'open' : parlayState} />
            </div>
            {week.startDate && (
              <p className="text-muted-foreground text-sm sm:text-base mt-1">
                Kickoff: <DeadlineDisplay deadline={week.startDate} />
              </p>
            )}
          </div>
        </div>

        {/* State dispatch */}
        {submissionsOpen && !myLeg && (
          <OpenNotSubmittedView
            weekId={parlayId}
            leagueId={leagueId}
            canManage={canManage}
            members={members}
            submittedMembers={submittedMembers}
            notSubmittedMembers={notSubmittedMembers}
            existingLegUserIds={legs.map((l) => l.user.id)}
          />
        )}

        {submissionsOpen && myLeg && (
          <OpenSubmittedView
            weekId={parlayId}
            leagueId={leagueId}
            canManage={canManage}
            myLeg={myLeg}
            me={me}
            members={members}
            submittedMembers={submittedMembers}
            notSubmittedMembers={notSubmittedMembers}
            existingLegUserIds={legs.map((l) => l.user.id)}
          />
        )}

        {!submissionsOpen && (
          <TheLay
            weekId={parlayId}
            leagueId={leagueId}
            legs={legs}
            notSubmittedMembers={notSubmittedMembers}
            currentUserId={me.id}
            canManage={canManage}
            parlayState={parlayState}
            parlayResult={parlayResult}
            totalOdds={totalOdds}
          />
        )}
      </main>
    </div>
  )
}

function StatusPill({ state }: { state: ParlayState }) {
  switch (state) {
    case 'open':
      return (
        <Badge
          variant="outline"
          className="flex items-center gap-1.5 text-neon-blue bg-[#00D9FF]/10 border-[#00D9FF]/30"
        >
          <Clock className="h-3.5 w-3.5" />
          OPEN
        </Badge>
      )
    case 'locked':
      return (
        <Badge
          variant="outline"
          className="flex items-center gap-1.5 text-neon-blue bg-[#00D9FF]/10 border-[#00D9FF]/30"
        >
          <Lock className="h-3.5 w-3.5" />
          LOCKED
        </Badge>
      )
    case 'graded':
      return (
        <Badge
          variant="outline"
          className="flex items-center gap-1.5 text-muted-foreground bg-white/5 border-white/20"
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          GRADING
        </Badge>
      )
    case 'won':
      return (
        <Badge
          variant="outline"
          className="flex items-center gap-1.5 text-neon-blue bg-[#00D9FF]/10 border-[#00D9FF]/30"
        >
          <Trophy className="h-3.5 w-3.5" />
          WON
        </Badge>
      )
    case 'lost':
      return (
        <Badge
          variant="outline"
          className="flex items-center gap-1.5 text-destructive bg-destructive/10 border-destructive/30"
        >
          <Skull className="h-3.5 w-3.5" />
          LOST
        </Badge>
      )
  }
}

// ─── State 1: open, you haven't submitted ────────────────────────────────

function OpenNotSubmittedView({
  weekId,
  leagueId,
  canManage,
  members,
  submittedMembers,
  notSubmittedMembers,
  existingLegUserIds,
}: {
  weekId: string
  leagueId: string
  canManage: boolean
  members: { userId: string; fullName: string | null; email: string; avatarUrl: string | null }[]
  submittedMembers: { userId: string; fullName: string | null; email: string; avatarUrl: string | null }[]
  notSubmittedMembers: { userId: string; fullName: string | null; email: string; avatarUrl: string | null }[]
  existingLegUserIds: string[]
}) {
  // Adapter shape for the legacy AddLegForUserDialog
  const legacyMembers = members.map((m) => ({
    user_id: m.userId,
    user: {
      id: m.userId,
      email: m.email,
      raw_user_meta_data: {
        full_name: m.fullName ?? undefined,
        avatar_url: m.avatarUrl ?? undefined,
      },
    },
  }))

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        <SubmitLegForm weekId={weekId} leagueId={leagueId} existingLeg={undefined} />
        {canManage && (
          <AddLegForUserDialog
            weekId={weekId}
            leagueId={leagueId}
            members={legacyMembers}
            existingLegUserIds={existingLegUserIds}
          />
        )}
      </div>
      <div>
        <SubmissionProgress
          total={members.length}
          submittedMembers={submittedMembers}
          notSubmittedMembers={notSubmittedMembers}
        />
      </div>
    </div>
  )
}

// ─── State 2: open, you've submitted ──────────────────────────────────────

function OpenSubmittedView({
  weekId,
  leagueId,
  canManage,
  myLeg,
  me,
  members,
  submittedMembers,
  notSubmittedMembers,
  existingLegUserIds,
}: {
  weekId: string
  leagueId: string
  canManage: boolean
  myLeg: { id: string; description: string; odds: number; lockedAt: string | null }
  me: { id: string; email: string; fullName: string | null; avatarUrl: string | null }
  members: { userId: string; fullName: string | null; email: string; avatarUrl: string | null }[]
  submittedMembers: { userId: string; fullName: string | null; email: string; avatarUrl: string | null }[]
  notSubmittedMembers: { userId: string; fullName: string | null; email: string; avatarUrl: string | null }[]
  existingLegUserIds: string[]
}) {
  const legacyMembers = members.map((m) => ({
    user_id: m.userId,
    user: {
      id: m.userId,
      email: m.email,
      raw_user_meta_data: {
        full_name: m.fullName ?? undefined,
        avatar_url: m.avatarUrl ?? undefined,
      },
    },
  }))

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        <YourLockedLeg
          weekId={weekId}
          leagueId={leagueId}
          leg={myLeg}
          user={{
            fullName: me.fullName,
            email: me.email,
            avatarUrl: me.avatarUrl,
          }}
        />
        {canManage && (
          <AddLegForUserDialog
            weekId={weekId}
            leagueId={leagueId}
            members={legacyMembers}
            existingLegUserIds={existingLegUserIds}
          />
        )}
      </div>
      <div>
        <SubmissionProgress
          total={members.length}
          submittedMembers={submittedMembers}
          notSubmittedMembers={notSubmittedMembers}
        />
      </div>
    </div>
  )
}
