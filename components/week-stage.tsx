'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { getWeekStage, type WeekStagePayload } from '@/app/actions/week-stage'
import {
  useLeagueChrome,
  useOnRecap,
  useViewedWeek,
} from '@/components/chrome/league-chrome-context'
import { setWeekActions, subscribeWeekDirty } from '@/components/chrome/canvas-store'
import { WeekHeader, WeekTiming } from '@/components/week-header'
import { WeekSlate } from '@/components/week-slate'
import { WeekPolls } from '@/components/week-polls'
import { SeasonRecap } from '@/components/season-recap'
import { Skeleton } from '@/components/ui/skeleton'
import type { PollMember } from '@/components/polls/types'

/**
 * THE STAGE — the one thing on the page, showing the one week you're on.
 *
 * This app is a single page. Picking a week doesn't navigate anywhere; it
 * changes which week the chrome points at, and the stage fetches that
 * week's content and swaps it in. The shell around it — the rail, the
 * panels, the sheets — never unmounts, so the springs, the scroll
 * positions and the open panel all hold perfectly still while the middle
 * changes underneath them.
 *
 * The current week arrives server-rendered so the first paint costs
 * nothing; everything after is fetched once and kept.
 */
export function WeekStage({
  leagueId,
  initial,
  preseason,
  members,
}: {
  leagueId: string
  /** The season's current week, rendered on the server. */
  initial: WeekStagePayload | null
  /** Week 0's content — the charter and the votes, server-rendered once
   *  because it's league-level and doesn't change with the week. */
  preseason: React.ReactNode
  /** The roster — whose faces appear against a week's votes. */
  members: PollMember[]
}) {
  const chrome = useLeagueChrome()
  const viewed = useViewedWeek()
  const onRecap = useOnRecap()

  // Every week we've loaded, kept for the rest of the session — flipping
  // back and forth between weeks should be instant after the first look.
  const cache = useRef(
    new Map<string, WeekStagePayload>(initial ? [[initial.nflWeekId, initial]] : [])
  )
  const [, force] = useState(0)
  const [loading, setLoading] = useState(false)

  // A refresh — switching seasons, mostly — server-renders a NEW current
  // week and hands it down here. Take it: without this the effect below
  // sees a cache miss and goes back to the server for the payload we were
  // just given, which is a whole round trip of skeleton for nothing.
  //
  // Keyed on identity, not on the id, so it only ever fires for a payload
  // the server has actually re-rendered. Re-seeding on every render would
  // let a stale `initial` clobber whatever reload() just refreshed.
  const seeded = useRef(initial)
  if (initial && initial !== seeded.current) {
    seeded.current = initial
    cache.current.set(initial.nflWeekId, initial)
  }

  const targetId = viewed?.id ?? chrome?.currentWeekId ?? initial?.nflWeekId ?? null
  const stage = targetId ? (cache.current.get(targetId) ?? null) : null
  const isPreseason = viewed?.kind === 'preseason'

  useEffect(() => {
    if (!targetId || isPreseason || cache.current.has(targetId)) return
    let cancelled = false
    setLoading(true)
    getWeekStage(leagueId, targetId)
      .then((res) => {
        if (cancelled) return
        if (res.payload) cache.current.set(targetId, res.payload)
        force((n) => n + 1)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [leagueId, targetId, isPreseason])

  // The cache is the whole point of the stage, so anything that changes a
  // week server-side has to say so. Refetch in place rather than dropping
  // the entry — clearing it would blink the week away and back.
  const reload = useCallback(
    async (id: string) => {
      const res = await getWeekStage(leagueId, id)
      if (res.payload) {
        cache.current.set(id, res.payload)
        force((n) => n + 1)
      }
    },
    [leagueId]
  )

  // Something in the shell changed this week — go and look again.
  useEffect(
    () => subscribeWeekDirty(() => { if (targetId) void reload(targetId) }),
    [targetId, reload]
  )

  // The action pod lives in the shell and can't see what we just
  // fetched — hand it the week's verbs as they change.
  useEffect(() => {
    if (isPreseason || !stage) {
      setWeekActions({
        hasSlate: false,
        locked: false,
        reopenable: false,
        canLock: false,
        submitted: false,
      })
      return
    }
    setWeekActions({
      hasSlate: stage.kind !== 'preseason',
      locked: stage.locked,
      reopenable: stage.reopenable,
      canLock: stage.canLock,
      submitted: stage.legs.some((l) => l.userId === chrome?.me.id),
    })
  }, [isPreseason, stage, chrome?.me.id])

  // Checked BEFORE the preseason branch on purpose: mid-switch the viewed
  // week still resolves against the season we're leaving, so a season
  // whose current week is week 0 would flash the old league's charter on
  // its way out.
  if (chrome?.switching) return <StageSkeleton />

  if (chrome && onRecap) {
    return <SeasonRecap leagueId={leagueId} season={chrome.season} />
  }

  if (isPreseason) return <>{preseason}</>

  if (!stage) return <StageSkeleton />

  return (
    <div className={loading ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
      {/* No win/loss takeover. Whether your leg hit is written on your
          face in THE LAY and on the week card in the list; a full-screen
          message announcing it a third time is just something to dismiss
          before you can look at the thing you came for. */}
      <WeekHeader
        weekNumber={stage.weekNumber}
        state={stage.submissionsOpen ? 'open' : stage.parlayState}
        locked={stage.locked}
        scopeCounts={stage.scopeCounts}
      />

      <WeekSlate
        firstKickoff={stage.kickoff}
        games={stage.games}
        nflWeekId={stage.nflWeekId}
        legs={stage.legs}
        currentUserId={chrome?.me.id}
      />

      {/* The week's housekeeping, at the foot of everything it applies
          to rather than crowding the title. */}
      <WeekTiming
        locked={stage.locked}
        lockAt={stage.lockAt}
        firstKickoff={stage.firstKickoff ?? stage.kickoff}
      />

      {/* The week's own business, under the week's own games. Absent on
          the weeks — most of them — where nobody asked anything. */}
      {chrome && (
        <WeekPolls
          leagueId={leagueId}
          nflWeekId={stage.nflWeekId}
          polls={stage.polls}
          currentUserId={chrome.me.id}
          members={members}
          canAsk={stage.canAskLeague}
          onChanged={() => void reload(stage.nflWeekId)}
        />
      )}
    </div>
  )
}

/**
 * THE STAGE, before it knows anything.
 *
 * Built out of the real thing's own geometry rather than a stack of grey
 * bars: the corner slab at its actual size and clip, the state word's
 * line, the lock's square, the slate's rule, then rows on the same grid
 * the games use. The point is that nothing MOVES when the content lands —
 * the layout is already correct and only the facts are missing, which is
 * the honest description of what's happening.
 */
function StageSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading the week">
      <header className="flex items-stretch justify-between gap-3">
        {/* Same negative margins and slant as WeekCornerDoor, so the
            corner is occupied from the first frame. */}
        <div
          aria-hidden
          className="relative -mt-8 -ml-4 flex w-[7.5rem] shrink-0 items-center justify-center overflow-hidden rounded-tl-[20px] pt-8 pb-5 lg:-ml-14 lg:w-[8.75rem] lg:pl-6"
          style={{
            clipPath: 'polygon(0 0, 100% 0, calc(100% - 13px) 100%, 0 100%)',
            background:
              'linear-gradient(150deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))',
          }}
        >
          <Skeleton className="-mr-2 h-11 w-12 rounded-lg" />
        </div>

        {/* The state word is flex-1 with its text left-aligned, so the
            bar standing in for it has to be too — a centred bar drifts
            into the middle of the card and then jumps left on arrival. */}
        <div className="min-w-0 flex-1 self-center pt-1">
          <Skeleton className="h-8 w-40 sm:h-9" />
        </div>

        <Skeleton className="size-14 shrink-0 rounded-2xl" />
      </header>

      <div className="mt-4 mb-3 flex items-end justify-between gap-3 border-b border-white/[0.07] pb-2.5">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-6 w-44 rounded-full" />
      </div>

      {/* 3.7rem is the measured height of a real game row, and eight of
          them is a normal Sunday — so the card fills to roughly the
          height it's about to be. */}
      <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-[3.7rem] rounded-xl" />
        ))}
      </div>
    </div>
  )
}
