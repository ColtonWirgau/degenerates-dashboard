'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { getWeekStage, type WeekStagePayload } from '@/app/actions/week-stage'
import { useLeagueChrome, useViewedWeek } from '@/components/chrome/league-chrome-context'
import { WeekHeader } from '@/components/week-header'
import { WeekSlate } from '@/components/week-slate'

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
}: {
  leagueId: string
  /** The season's current week, rendered on the server. */
  initial: WeekStagePayload | null
  /** Week 0's content — the charter and the votes, server-rendered once
   *  because it's league-level and doesn't change with the week. */
  preseason: React.ReactNode
}) {
  const chrome = useLeagueChrome()
  const viewed = useViewedWeek()

  // Every week we've loaded, kept for the rest of the session — flipping
  // back and forth between weeks should be instant after the first look.
  const cache = useRef(
    new Map<string, WeekStagePayload>(initial ? [[initial.nflWeekId, initial]] : [])
  )
  const [, force] = useState(0)
  const [loading, setLoading] = useState(false)

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

  if (isPreseason) return <>{preseason}</>

  if (!stage) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="text-neon-blue h-6 w-6 animate-spin" />
      </div>
    )
  }

  return (
    <div className={loading ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
      {/* No win/loss takeover. Whether your leg hit is written on your
          face in THE LAY and on the week card in the list; a full-screen
          message announcing it a third time is just something to dismiss
          before you can look at the thing you came for. */}
      <WeekHeader
        leagueId={leagueId}
        nflWeekId={stage.nflWeekId}
        weekNumber={stage.weekNumber}
        state={stage.submissionsOpen ? 'open' : stage.parlayState}
        locked={stage.locked}
        reopenable={stage.reopenable}
        canLock={stage.canLock}
        firstKickoff={stage.firstKickoff}
        lockAt={stage.lockAt}
        kickoff={stage.kickoff}
        scopeCounts={stage.scopeCounts}
        onLockChanged={() => reload(stage.nflWeekId)}
      />

      <WeekSlate
        firstKickoff={stage.kickoff}
        games={stage.games}
        nflWeekId={stage.nflWeekId}
        legs={stage.legs}
        currentUserId={chrome?.me.id}
      />
    </div>
  )
}
