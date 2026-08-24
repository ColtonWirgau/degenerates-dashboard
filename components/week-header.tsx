'use client'

import { CheckCircle2, Skull, Trophy } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { DeadlineDisplay } from '@/components/deadline-display'
import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { setWeekLock } from '@/app/actions/week-lock'
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
  leagueId,
  nflWeekId,
  weekNumber,
  state,
  locked,
  reopenable,
  canLock,
  firstKickoff,
  lockAt,
  kickoff,
  scopeCounts,
  onLockChanged,
}: {
  leagueId: string
  nflWeekId: string
  weekNumber: number
  state: ParlayState
  /** Somebody has closed this week to new entries. */
  locked: boolean
  /** That can still be undone — the first game we bet hasn't started. */
  reopenable: boolean
  /** The viewer runs the league. */
  canLock: boolean
  /** First kickoff among the games we bet. */
  firstKickoff: string | null
  /** When the week was closed, if it was. */
  lockAt: string | null
  kickoff: string | null
  /** How many games each scope would show. Null hides the switch. */
  scopeCounts: Record<SlateScope, number> | null
  /** Tell the stage its cached copy of this week is out of date. */
  onLockChanged: () => void
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
          <WeekLock
            leagueId={leagueId}
            nflWeekId={nflWeekId}
            weekNumber={weekNumber}
            locked={locked}
            canToggle={canLock && (!locked || reopenable)}
            onChanged={onLockChanged}
          />
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
 * THE PADLOCK — the week's one irreversible-ish act, as a physical
 * object rather than a word.
 *
 * Pressing it swings the shackle down and shuts the body; pressing a
 * closed one springs it open again. That the control IS the state is the
 * point: there's no separate badge saying "OPEN" next to a button
 * offering to close it, which was two things saying one thing.
 *
 * People who don't run the league get the same padlock, minus the
 * pointer — it still tells them whether the week is taking entries.
 */
function WeekLock({
  leagueId,
  nflWeekId,
  weekNumber,
  locked,
  canToggle,
  onChanged,
}: {
  leagueId: string
  nflWeekId: string
  weekNumber: number
  locked: boolean
  canToggle: boolean
  onChanged: () => void
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  // Optimistic: the shackle should move on the press, not after the
  // round trip — a lock that hesitates doesn't feel like a lock.
  const [shut, setShut] = useState(locked)
  useEffect(() => setShut(locked), [locked])

  const label = shut
    ? `Week ${weekNumber} is closed to new entries${canToggle ? ' — press to reopen' : ''}`
    : `Close week ${weekNumber} to new entries`

  const toggle = () => {
    if (!canToggle || pending) return
    const next = !shut
    setShut(next)
    start(async () => {
      setError(null)
      const res = await setWeekLock(leagueId, nflWeekId, next)
      if (res.error) {
        setShut(!next) // put it back; the server said no
        setError(res.error)
        return
      }
      onChanged() // the stage's cached week
      router.refresh() // the rail, the week list, the standings
    })
  }

  return (
    <div className="relative">
      <button
        type="button"
        disabled={!canToggle || pending}
        aria-pressed={shut}
        aria-label={label}
        title={label}
        onClick={toggle}
        className={cn(
          'flex size-9 items-center justify-center rounded-full border transition-colors',
          shut
            ? 'border-neon-blue/40 bg-neon-blue/10 text-neon-blue'
            : 'text-muted-foreground border-white/12 bg-white/[0.03]',
          canToggle && 'hover:border-neon-blue/60 hover:text-neon-blue cursor-pointer',
          pending && 'opacity-70'
        )}
      >
        <Padlock shut={shut} />
      </button>
      {error && (
        <p className="text-destructive absolute top-full right-0 mt-1 text-[11px] whitespace-nowrap">
          {error}
        </p>
      )}
    </div>
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
