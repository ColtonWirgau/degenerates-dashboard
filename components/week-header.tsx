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
 * THE WEEK, named once — as the number, on the same slab the week list
 * and the game rows use.
 *
 * It's the largest instance of a shape the app now repeats at three
 * sizes: tinted slab, slanted inner edge, the thing that identifies the
 * row set big in the display face. Here it identifies the page, so it's
 * the page's title, and "WEEK" is a word the number doesn't need spelled
 * out beside it at this scale.
 *
 * On the right, the two things that act on the week: the switch for how
 * much of the slate you're looking at, and the padlock saying whether
 * it's still taking entries. The slate below has no heading of its own,
 * because this row is its heading.
 */
export function WeekHeader({
  weekNumber,
  state,
  locked,
  scopeCounts,
}: {
  weekNumber: number
  state: ParlayState
  /** Somebody has closed this week to new entries. */
  locked: boolean
  /** How many games each scope would show. Null hides the switch. */
  scopeCounts: Record<SlateScope, number> | null
}) {
  const postLock = state !== 'open'
  const actionCount = scopeCounts?.action ?? 0

  // The week decides how wide the slate opens; changing weeks re-decides.
  useEffect(() => {
    resetSlateScope(postLock, actionCount)
  }, [weekNumber, postLock, actionCount])

  const won = state === 'won'
  const lost = state === 'lost'

  return (
    <header className="mb-5 flex items-stretch gap-3">
      {/* The number IS the title. Screen readers get the words. */}
      <h1 className="sr-only">Week {weekNumber}</h1>
      <div
        aria-hidden
        // Exactly as wide as the game rows' slabs below it, so the page
        // keeps one left column all the way down instead of two edges
        // that nearly agree.
        className="relative flex w-[7.5rem] shrink-0 items-center justify-center overflow-hidden rounded-l-xl py-5"
        style={{
          clipPath: 'polygon(0 0, 100% 0, calc(100% - 13px) 100%, 0 100%)',
          background: won
            ? 'linear-gradient(150deg, rgba(0,217,255,0.22), rgba(0,217,255,0.04))'
            : lost
              ? 'linear-gradient(150deg, rgba(255,105,180,0.22), rgba(255,105,180,0.04))'
              : 'linear-gradient(150deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))',
        }}
      >
        <span
          className={cn(
            'font-display -mr-2 text-6xl leading-none tabular-nums',
            won
              ? 'text-neon-blue'
              : lost
                ? 'text-destructive'
                : 'text-foreground/75'
          )}
        >
          {weekNumber}
        </span>
      </div>

      <div className="flex min-w-0 flex-1 flex-wrap items-end justify-end gap-x-3 gap-y-2 pb-1">
        {/* Terminal states aren't a lock question any more — a week that
            won or lost says so, and there's nothing to press. */}
        {(state === 'graded' || won || lost) && <StatusPill state={state} />}
        {scopeCounts && <SlateScopePill counts={scopeCounts} />}
        <LockMark locked={locked} weekNumber={weekNumber} />
      </div>
    </header>
  )
}

/**
 * When it closed, or when you'll want to close it by.
 *
 * A footnote, and set like one: centred under everything it applies to,
 * at the bottom of the section. It was sitting under the week's name in
 * body copy, which gave a housekeeping detail the same weight as the
 * title.
 */
export function WeekTiming({
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
      <p className="text-muted-foreground/60 mt-6 text-center text-[11px] tracking-wider">
        Closed <DeadlineDisplay deadline={lockAt} />
      </p>
    )
  }
  if (!firstKickoff) return null
  // Not a deadline — nothing closes on its own. It's the fact that tells
  // you when you'd better have the ticket in.
  return (
    <p className="text-muted-foreground/60 mt-6 text-center text-[11px] tracking-wider">
      First kickoff <DeadlineDisplay deadline={firstKickoff} />
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
