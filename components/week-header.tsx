'use client'

import { CheckCircle2, Clock, Lock, Skull, Trophy } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { DeadlineDisplay } from '@/components/deadline-display'
import { useEffect } from 'react'
import {
  resetSlateScope,
  SlateScopePill,
  type SlateScope,
} from '@/components/week-scope'
import type { ParlayState } from '@/lib/data/types'

/**
 * THE WEEK, named once.
 *
 * One row carries everything the week IS: its number, its state, and —
 * pushed to the far right — the switch controlling how much of the slate
 * you're looking at. The slate below has no heading of its own, because
 * this row is its heading; a "SLATE / WEEK 1" bar under "Week 1" was the
 * same sentence twice.
 */
export function WeekHeader({
  weekNumber,
  state,
  lockAt,
  kickoff,
  scopeCounts,
}: {
  weekNumber: number
  state: ParlayState
  /** True lock moment; null falls back to kickoff. */
  lockAt: string | null
  kickoff: string | null
  /** How many games each scope would show. Null hides the switch. */
  scopeCounts: Record<SlateScope, number> | null
}) {
  const when = lockAt ?? kickoff
  const postLock = state !== 'open'
  const actionCount = scopeCounts?.action ?? 0

  // The week decides how wide the slate opens; changing weeks re-decides.
  useEffect(() => {
    resetSlateScope(postLock, actionCount)
  }, [weekNumber, postLock, actionCount])

  return (
    <header className="mb-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="text-3xl font-bold sm:text-4xl">Week {weekNumber}</h1>
        <StatusPill state={state} />
        {scopeCounts && <SlateScopePill counts={scopeCounts} className="ml-auto" />}
      </div>
      {when && (
        <p className="text-muted-foreground mt-1 text-sm">
          {lockAt ? 'Locks' : 'Kickoff'}: <DeadlineDisplay deadline={when} />
        </p>
      )}
    </header>
  )
}

function StatusPill({ state }: { state: ParlayState }) {
  switch (state) {
    case 'open':
      return (
        <Badge
          variant="outline"
          className="text-neon-blue flex items-center gap-1.5 border-[#00D9FF]/30 bg-[#00D9FF]/10"
        >
          <Clock className="h-3.5 w-3.5" />
          OPEN
        </Badge>
      )
    case 'locked':
      return (
        <Badge
          variant="outline"
          className="text-neon-blue flex items-center gap-1.5 border-[#00D9FF]/30 bg-[#00D9FF]/10"
        >
          <Lock className="h-3.5 w-3.5" />
          LOCKED
        </Badge>
      )
    case 'graded':
      return (
        <Badge
          variant="outline"
          className="text-muted-foreground flex items-center gap-1.5 border-white/20 bg-white/5"
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          GRADING
        </Badge>
      )
    case 'won':
      return (
        <Badge
          variant="outline"
          className="text-neon-blue flex items-center gap-1.5 border-[#00D9FF]/30 bg-[#00D9FF]/10"
        >
          <Trophy className="h-3.5 w-3.5" />
          WON
        </Badge>
      )
    case 'lost':
      return (
        <Badge
          variant="outline"
          className="text-destructive border-destructive/30 bg-destructive/10 flex items-center gap-1.5"
        >
          <Skull className="h-3.5 w-3.5" />
          LOST
        </Badge>
      )
  }
}
