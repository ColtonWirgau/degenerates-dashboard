import Link from 'next/link'
import { Lock } from 'lucide-react'
import { getLeagueOverviewCached } from '@/lib/data/league-overview-cached'
import { getLeagueWeeksCached } from '@/lib/data/league-weeks-cached'
import { getWeekStage } from '@/app/actions/week-stage'
import { getDataAdapter } from '@/lib/data/adapter'
import { Header } from '@/components/header'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { SaveLastLeague } from '@/components/save-last-league'
import { WeekStage } from '@/components/week-stage'
import { WeekCornerDoor } from '@/components/week-header'
import { DraftHero } from '@/components/charter/draft-hero'
import { groupFor } from '@/lib/charter-groups'
import { OffseasonPollsHub } from '@/components/offseason-polls-hub'

/**
 * THE LEAGUE — one page, and that's the whole app.
 *
 * Everything you can look at is a week, and picking a week is state, not
 * a URL: the shell stays mounted and the stage in the middle swaps its
 * content. So there's exactly one route, and it opens on whichever week
 * the season is actually on.
 */
export default async function LeaguePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const result = await getLeagueOverviewCached(id)

  if (result.error === 'Access denied - not a member of this league') {
    return (
      <div className="ambient-glow min-h-[100dvh]">
        <Header />
        <main className="container mx-auto px-4 py-8 pt-24 pb-24">
          <Card className="glass-card border-primary/30 mx-auto max-w-2xl">
            <CardContent className="space-y-4 py-12 text-center">
              <Lock className="text-muted-foreground mx-auto h-10 w-10" />
              <div>
                <h3 className="mb-2 text-2xl font-bold">Access Denied</h3>
                <p className="text-muted-foreground mb-4">
                  You are not a member of this league. Ask a league admin for an
                  invite link to join.
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

  if (result.error || !result.payload) return null
  const p = result.payload

  const { currentWeek } = await getLeagueWeeksCached(id, p.season)

  // The current week comes down rendered so the first paint costs nothing.
  // Week 0 has no slate to fetch — its content is the charter, which is
  // league-level and already loaded.
  const initial =
    currentWeek && currentWeek.kind !== 'preseason'
      ? (await getWeekStage(id, currentWeek.nflWeekId)).payload
      : null

  return (
    <div>
      <SaveLastLeague leagueId={id} />
      {/* The card's edges are BITTEN: each bubble cuts BITE_R (31.5px)
          into it, so anything sitting at a 16px gutter is inside the
          hole, not beside it. On desktop the gutter has to clear the
          bite and then leave air, or the content looks like it's being
          crowded off the card by the rail — 3.5rem left only 24px of
          that air, which read as crowding. 5rem leaves 48.

          This number is PAIRED: every corner slab cancels it with an
          equal negative margin to sit ON the card's corner rather than
          near it. Change one, change all of them (grep lg:-ml-20). */}
      {/* No `container mx-auto` here: the CARD is the container, and it
          already floats inset from the canvas. Centring a second, capped
          box inside it left an auto margin that grew with the viewport —
          which the corner slab's negative margin can't reach, so it
          could never actually touch the card's edge. */}
      <main className="w-full px-4 py-8 pb-28 lg:px-20 lg:pb-12">
        <WeekStage
          leagueId={id}
          initial={initial}
          preseason={<PreseasonStage payload={p} />}
          members={p.members.map((m) => ({
            id: m.user_id,
            fullName: m.full_name,
            email: m.email,
            avatarUrl: m.avatar_url,
          }))}
        />
      </main>
    </div>
  )
}

type Payload = NonNullable<
  Awaited<ReturnType<typeof getLeagueOverviewCached>>['payload']
>

/**
 * WEEK 0 — no games, so no slate and nothing to bet. What it has instead
 * is the league's own business: the charter, and the votes that settle it.
 */
async function PreseasonStage({ payload: p }: { payload: Payload }) {
  const adapter = await getDataAdapter()
  const dataSource = process.env.NEXT_PUBLIC_DATA_SOURCE ?? 'mock'
  const preseasonWeek = (
    await getLeagueWeeksCached(p.league.id, p.season)
  ).weeks.find((w) => w.kind === 'preseason')

  const polls =
    dataSource === 'neon' && preseasonWeek
      ? await adapter.getPolls(p.league.id, {
          statuses: ['open', 'closed'],
          nflWeekId: preseasonWeek.nflWeekId,
        })
      : p.polls

  return (
    <>
      {/* THE DRAFT IS THE HEADER. It was a card in the body under a
          header that said nothing the page didn't already say — so the
          header became the fixture, matchup-style: when, where, and AT
          on the seam between them. The venue side plays the venue.

          The charter supplies it, so the values are whatever somebody
          typed; DraftHero degrades on each of them independently. */}
      <DraftHero
        entries={p.charter
          .filter((e) => groupFor(e) === 'Draft')
          .map((e) => ({
            id: e.id,
            key: e.key,
            value: e.value,
            status: e.status,
            metadata: e.metadata,
          }))}
        leagueName={p.league.name}
        memberCount={p.members.length}
      />

      <OffseasonPollsHub
        leagueId={p.league.id}
        polls={polls}
        charter={p.charter}
        seasonState={p.seasonState}
        currentUserId={p.me.id}
        membersCount={p.members.length}
        canManage={p.currentUserRole === 'owner' || p.currentUserRole === 'admin'}
        members={p.members.map((m) => ({
          id: m.user_id,
          fullName: m.full_name,
          email: m.email,
          avatarUrl: m.avatar_url,
        }))}
      />
    </>
  )
}
