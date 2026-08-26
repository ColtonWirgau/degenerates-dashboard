'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Lock, Pencil } from 'lucide-react'
import { SubmitLegForm } from '@/components/submit-leg-form'
import { useViewedWeek } from '@/components/chrome/league-chrome-context'
import { markWeekDirty } from '@/components/chrome/canvas-store'
import { deleteLeg, openWeekForSubmission } from '@/app/actions/legs'

export interface SubmitRevealLeg {
  /** The leg's own id — what changing it needs, since editing is
   *  delete-then-resubmit all the way down. */
  id: string
  description: string
  odds: number
  /** The game it's on, so CHANGE IT reopens still pointed at it. */
  nflGameId?: string | null
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
  // Mid-change: the old leg is gone and the composer is up, carrying
  // what it said. The text is captured HERE rather than read back off
  // the leg, because by the time the composer renders the leg has been
  // deleted and there is nothing left to read.
  const [changing, setChanging] = useState<{
    description: string
    odds: string
    nflGameId?: string | null
  } | null>(null)
  const [dropping, drop] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

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

      {myLeg && !changing ? (
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

          {/* CHANGE IT, here. This said "open the week and delete your
              leg first — then resubmit", which described a route that
              doesn't exist any more: the week page has no delete on it
              since the lay became a panel. So the only instruction the
              panel gave was one you couldn't follow.
              
              Editing is still delete-then-resubmit underneath, because
              that's what keeps one leg per person per week true. The
              difference is that the panel does it, and hands the
              composer back with what you had in it. */}
          {week.parlayState === 'open' && !week.closed && parlayId ? (
            <button
              type="button"
              disabled={dropping}
              onClick={() =>
                drop(async () => {
                  const res = await deleteLeg(parlayId, myLeg.id, leagueId)
                  if (!res.success) {
                    setError(res.error ?? 'Could not change it')
                    return
                  }
                  setChanging({
                    description: myLeg.description,
                    odds: String(myLeg.odds),
                    // Whatever it was already on. Losing this on an edit
                    // would quietly un-link a leg that knew its game.
                    nflGameId: myLeg.nflGameId ?? null,
                  })
                  markWeekDirty()
                  router.refresh()
                })
              }
              className="text-muted-foreground hover:text-neon-blue hover:border-neon-blue/30 inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-[10px] font-bold tracking-[0.2em] uppercase transition-colors disabled:opacity-50"
            >
              {dropping ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Pencil className="h-3 w-3" />
              )}
              Change it
            </button>
          ) : (
            <p className="text-muted-foreground text-[11px]">
              The week is locked — this is what went in.
            </p>
          )}
          {error && <p className="text-destructive text-[11px]">{error}</p>}
        </div>
      ) : parlayId ? (
        <SubmitLegForm
          weekId={parlayId}
          leagueId={leagueId}
          // Handed back what you had in it, so changing one word isn't
          // retyping the whole thing.
          existingLeg={changing ?? undefined}
        />
      ) : (
        <p className="text-muted-foreground px-1 py-4 text-xs italic">
          Opening the week…
        </p>
      )}
    </div>
  )
}
