'use client'

import { useEffect, useState } from 'react'
import { Lock } from 'lucide-react'
import { SubmitLegForm } from '@/components/submit-leg-form'
import { useViewedWeek } from '@/components/chrome/league-chrome-context'
import { openWeekForSubmission } from '@/app/actions/legs'

export interface SubmitRevealLeg {
  description: string
  odds: number
  result: 'win' | 'loss' | 'push' | null
}

/**
 * The SUBMIT reveal: the WEEK'S one verb, for whichever week you're
 * looking at. Not submitted → the leg composer; submitted → your locked
 * leg (delete-then-resubmit is the edit path, and that lives on the week
 * page). The preseason week never opens this — it has no slate, so its
 * action bubble doesn't exist.
 */
export function SubmitReveal({
  leagueId,
  legsByWeek,
}: {
  leagueId: string
  /** The viewer's leg for each week that has one, keyed by week id. */
  legsByWeek: Record<string, SubmitRevealLeg>
}) {
  const week = useViewedWeek()

  // A week nobody has opened yet has no parlay row, because they're made
  // lazily by the stage. That used to be the end of it: ADD LEG showed
  // on week 12, you pressed it, and the panel said there was nothing to
  // submit. Any week that isn't locked should take a leg — the slate is
  // published and the deadline is weeks off — so open one on demand.
  const needsParlay = week != null && week.hasSlate && !week.closed && !week.parlayId
  const [opened, setOpened] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const weekId = week?.id
  useEffect(() => {
    if (!needsParlay || !weekId) return
    let alive = true
    setOpened(null)
    setFailed(false)
    void openWeekForSubmission(leagueId, weekId).then((r) => {
      if (!alive) return
      if (r.parlayId) setOpened(r.parlayId)
      else setFailed(true)
    })
    return () => {
      alive = false
    }
  }, [needsParlay, weekId, leagueId])

  const parlayId = week?.parlayId ?? opened

  if (!week || !week.hasSlate || (!parlayId && (failed || week.closed))) {
    return (
      <p className="text-muted-foreground px-1 py-4 text-xs italic">
        Nothing to submit for this week.
      </p>
    )
  }

  const myLeg = legsByWeek[week.id] ?? null

  return (
    <div className="scrollbar-hide flex min-h-0 flex-1 flex-col overflow-y-auto">
      {/* Which week, and nothing else. "Your leg" is what the bubble you
          just pressed said, and the form underneath is plainly a leg —
          repeating it in a heading is the third telling. */}
      <p className="text-muted-foreground mb-3 shrink-0 text-[10px] font-bold tracking-[0.3em] uppercase">
        Week {week.weekNumber}
      </p>

      {myLeg ? (
        <div className="space-y-3">
          <div className="border-neon-blue/30 bg-neon-blue/5 rounded-lg border px-3 py-3">
            <p className="text-neon-blue mb-1 inline-flex items-center gap-1.5 text-[10px] font-bold tracking-[0.25em] uppercase">
              <Lock className="h-3 w-3" /> Locked in
            </p>
            <p className="text-foreground/90 text-sm font-medium break-words">
              {myLeg.description}
            </p>
            <p className="text-muted-foreground mt-1 text-xs font-bold tabular-nums">
              {myLeg.odds > 0 ? `+${myLeg.odds}` : myLeg.odds}
            </p>
          </div>
          <p className="text-muted-foreground text-[11px]">
            Need to change it? Open the week and delete your leg first —
            then resubmit.
          </p>
        </div>
      ) : parlayId ? (
        <SubmitLegForm weekId={parlayId} leagueId={leagueId} />
      ) : (
        <p className="text-muted-foreground px-1 py-4 text-xs italic">
          Opening the week…
        </p>
      )}
    </div>
  )
}
