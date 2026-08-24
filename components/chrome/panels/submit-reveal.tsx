'use client'

import { Clock, Lock } from 'lucide-react'
import { SubmitLegForm } from '@/components/submit-leg-form'
import { DeadlineDisplay } from '@/components/deadline-display'
import { useLeagueChrome } from '@/components/chrome/league-chrome-context'

export interface SubmitRevealLeg {
  description: string
  odds: number
  result: 'win' | 'loss' | 'push' | null
}

/**
 * The SUBMIT reveal: the week's one verb. Not submitted → the leg
 * composer; submitted → your locked leg (delete-then-resubmit is the edit
 * path, and that lives on the week page). Off-season this panel never
 * opens (the action bubble pivots to VOTE).
 */
export function SubmitReveal({
  leagueId,
  myLeg,
}: {
  leagueId: string
  myLeg: SubmitRevealLeg | null
}) {
  const chrome = useLeagueChrome()
  if (!chrome || chrome.currentWeekId == null) {
    return (
      <p className="text-muted-foreground px-1 py-4 text-xs italic">
        No open week right now.
      </p>
    )
  }

  return (
    <div className="scrollbar-hide flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="mb-3 flex shrink-0 items-center justify-between gap-2">
        <p className="text-muted-foreground text-[10px] font-bold tracking-[0.3em] uppercase">
          Week {chrome.weekNumber} · Your leg
        </p>
        {chrome.lockAt && (
          <span className="text-muted-foreground inline-flex items-center gap-1 text-[10px] tabular-nums">
            <Clock className="h-3 w-3" />
            <DeadlineDisplay deadline={chrome.lockAt} />
          </span>
        )}
      </div>

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
      ) : (
        <SubmitLegForm weekId={chrome.currentWeekId} leagueId={leagueId} />
      )}
    </div>
  )
}
