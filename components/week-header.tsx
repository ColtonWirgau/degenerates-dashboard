'use client'

import { CheckCircle2, Skull, Trophy } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { DeadlineDisplay } from '@/components/deadline-display'
import { useEffect } from 'react'
import {
  resetSlateScope,
  SlateScopePill,
  type SlateScope,
} from '@/components/week-scope'
import type { ParlayState } from '@/lib/data/types'
import { cn } from '@/lib/utils'

/**
 * THE WEEK, named once.
 *
 * The number on the left; on the right the two things that act on the
 * week — the padlock that closes it to new entries, and the switch for
 * how much of the slate you're looking at. The slate below has no
 * heading of its own, because this row is its heading; a "SLATE / WEEK
 * 1" bar under "Week 1" was the same sentence twice.
 */
export function WeekHeader({
  weekNumber,
  state,
  locked,
  firstKickoff,
  lockAt,
  kickoff,
  scopeCounts,
}: {
  weekNumber: number
  state: ParlayState
  /** Somebody has closed this week to new entries. */
  locked: boolean
  /** First kickoff among the games we bet. */
  firstKickoff: string | null
  /** When the week was closed, if it was. */
  lockAt: string | null
  kickoff: string | null
  /** How many games each scope would show. Null hides the switch. */
  scopeCounts: Record<SlateScope, number> | null
}) {
  const postLock = state !== 'open'
  const actionCount = scopeCounts?.action ?? 0

  // The week decides how wide the slate opens; changing weeks re-decides.
  useEffect(() => {
    resetSlateScope(postLock, actionCount)
  }, [weekNumber, postLock, actionCount])

  return (
    <header className="mb-5">
      <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
        <h1 className="text-3xl font-bold sm:text-4xl">Week {weekNumber}</h1>
        {/* Terminal states aren't a lock question any more — a week that
            won or lost says so, and there's nothing to press. */}
        {(state === 'graded' || state === 'won' || state === 'lost') && (
          <StatusPill state={state} />
        )}
        {/* Scope first, then the lock — the padlock sits at the very end
            of the row, where the week's last word belongs. */}
        <div className="ml-auto flex items-end gap-2">
          {scopeCounts && <SlateScopePill counts={scopeCounts} />}
          <LockMark locked={locked} weekNumber={weekNumber} />
        </div>
      </div>
      <WeekTiming locked={locked} lockAt={lockAt} firstKickoff={firstKickoff ?? kickoff} />
    </header>
  )
}

/** When it closed, or when you'll want to close it by. */
function WeekTiming({
  locked,
  lockAt,
  firstKickoff,
}: {
  locked: boolean
  lockAt: string | null
  firstKickoff: string | null
}) {
  if (locked && lockAt) {
    return (
      <p className="text-muted-foreground mt-1 text-sm">
        Closed <DeadlineDisplay deadline={lockAt} />
      </p>
    )
  }
  if (!firstKickoff) return null
  // Not a deadline — nothing closes on its own. It's the fact that tells
  // you when you'd better have the ticket in.
  return (
    <p className="text-muted-foreground mt-1 text-sm">
      First kickoff: <DeadlineDisplay deadline={firstKickoff} />
    </p>
  )
}

/**
 * Whether the week is still taking entries, said once, where the week is
 * named. It doesn't do anything: closing a week is the ACTIONS pod's
 * job, and a padlock you can press in two different places is two
 * things claiming the same verb.
 */
function LockMark({ locked, weekNumber }: { locked: boolean; weekNumber: number }) {
  const label = locked
    ? `Week ${weekNumber} is closed to new entries`
    : `Week ${weekNumber} is open for entries`
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn(
        'flex size-9 items-center justify-center rounded-full border',
        locked
          ? 'border-neon-blue/40 bg-neon-blue/10 text-neon-blue'
          : 'text-muted-foreground/70 border-white/10 bg-white/[0.02]'
      )}
    >
      <Padlock shut={locked} />
    </span>
  )
}

/**
 * A padlock in two parts, so the shackle can actually move.
 *
 * Open, it stands proud of the body and tilted; closing drops it into
 * the body and squares it up. Lucide's Lock/LockOpen are two separate
 * glyphs — swapping them would cut, not animate — so this is hand-rolled
 * to keep one continuous object across the change.
 */
function Padlock({ shut }: { shut: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-[18px]"
      aria-hidden
    >
      <path
        d="M8 11V7a4 4 0 0 1 8 0v4"
        className="origin-[12px_11px] transition-transform duration-[320ms] ease-[cubic-bezier(0.34,1.4,0.5,1)]"
        style={{
          transform: shut
            ? 'translateY(0) rotate(0deg)'
            : 'translateY(-2.5px) rotate(-14deg)',
        }}
      />
      <rect x="4" y="11" width="16" height="10" rx="2" />
    </svg>
  )
}

function StatusPill({ state }: { state: ParlayState }) {
  switch (state) {
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
    default:
      return null
  }
}
