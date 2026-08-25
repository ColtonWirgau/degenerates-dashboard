'use client'

import { DeadlineDisplay } from '@/components/deadline-display'
import { useEffect } from 'react'
import { openPanel } from '@/components/chrome/canvas-store'
import {
  resetSlateScope,
  SCOPE_LABEL,
  SlateScopePill,
  useSlateScope,
  type SlateScope,
} from '@/components/week-scope'
import type { ParlayState } from '@/lib/data/types'
import { cn } from '@/lib/utils'

/** The week's verdict, in one word. */
const STATE_WORD: Record<ParlayState, string> = {
  open: 'Open',
  locked: 'Locked',
  graded: 'In progress',
  won: 'Won',
  lost: 'Lost',
}

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
    <>
      {/* THE WEEK. Its number in the left corner, its lock in the right,
          the full width of the card between them — the two facts that
          belong to the week itself rather than to the slate below. */}
      <header className="flex items-stretch justify-between gap-3">
        {/* The number IS the title. Screen readers get the words. */}
        <h1 className="sr-only">Week {weekNumber}</h1>
        <WeekCornerDoor
          weekNumber={weekNumber}
          tone={won ? 'won' : lost ? 'lost' : 'neutral'}
        />

        {/* HOW IT WENT, next to the number and at its scale — outside the
            slab, so the slab stays the door and this stays the verdict.
            It was a chip in the far corner, which is where you put a
            label, not a result. */}
        <p
          className={cn(
            'font-display min-w-0 flex-1 self-center truncate pt-1 text-3xl leading-none tracking-tight uppercase sm:text-4xl',
            won
              ? 'text-neon-blue'
              : lost
                ? 'text-destructive'
                : 'text-foreground/35'
          )}
        >
          {STATE_WORD[state]}
        </p>

        <LockMark locked={locked} weekNumber={weekNumber} />
      </header>

      {/* THE SLATE'S OWN HEADING — it names what you're looking at, and
          the switch that changes it sits at the other end of the same
          line. The switch used to carry that name stacked above itself,
          which put the label and the thing it labels a hand's width
          apart with nothing between them. */}
      {scopeCounts && <SlateHeading counts={scopeCounts} />}
    </>
  )
}

function SlateHeading({ counts }: { counts: Record<SlateScope, number> }) {
  const scope = useSlateScope()
  return (
    // A hairline under the whole row — title at one end, switch at the
    // other, and the rule tying them together and holding the games off.
    <div className="mt-4 mb-3 flex items-end justify-between gap-3 border-b border-white/[0.07] pb-2.5">
      <h2 className="font-display text-foreground/80 text-xl leading-none tracking-tight uppercase">
        {SCOPE_LABEL[scope]}
        <span className="text-muted-foreground/60 ml-2 text-sm tabular-nums">
          {counts[scope]}
        </span>
      </h2>
      <SlateScopePill counts={counts} hideLabel />
    </div>
  )
}

/**
 * THE CORNER DOOR — the week's number, reaching into the card's top-left
 * corner, and the way into the week list.
 *
 * Negative margins cancel the page gutter and the top padding so it sits
 * ON the corner rather than near it, and its own top-left is rounded to
 * the card's radius. Pressing it opens the list, which is why the rail
 * no longer carries a bubble wearing this same number six inches away —
 * and why RAIL_TOP starts below it.
 */
export function WeekCornerDoor({
  weekNumber,
  tone = 'neutral',
  label,
}: {
  weekNumber: number
  tone?: 'neutral' | 'won' | 'lost'
  /**
   * A word instead of the number, for the week that hasn't got one.
   * There is no week 0 in the NFL — the slab was asserting an ordinal
   * that doesn't exist, and then the word beside it had to say
   * "Preseason" anyway. So the slab says it, at whatever width the word
   * needs, and nothing has to repeat it.
   */
  label?: string
}) {
  const won = tone === 'won'
  const lost = tone === 'lost'
  return (
    <button
      type="button"
      onClick={() => openPanel('slate')}
      aria-label={
        weekNumber === 0
          ? 'Preseason — open the week list'
          : `Week ${weekNumber} — open the week list`
      }
      className={cn(
        'group relative -mt-8 -ml-4 flex shrink-0 items-center justify-center overflow-hidden rounded-tl-[20px] pt-8 pb-5 transition-[filter] hover:brightness-125 lg:-ml-14',
        // A digit gets a fixed box; a word gets the width it needs. The
        // slanted edge and the corner radius don't care how wide it is.
        label
          ? 'w-auto px-7 lg:pr-10 lg:pl-20'
          : 'w-[7.5rem] lg:w-[8.75rem] lg:pl-6'
      )}
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
        aria-hidden
        className={cn(
          'font-display -mr-2 leading-none uppercase',
          // A word carries at less size than a lone digit does, and this
          // one is nine letters — Anton is condensed, but not that
          // condensed.
          label ? 'text-3xl tracking-tight sm:text-4xl' : 'text-6xl tabular-nums',
          won ? 'text-neon-blue' : lost ? 'text-destructive' : 'text-foreground/75'
        )}
      >
        {label ?? weekNumber}
      </span>
    </button>
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
      // Sized to answer the week's number across the card, not to sit
      // quietly beside a switch — it's the other thing that's true about
      // the week as a whole.
      className={cn(
        'flex size-14 items-center justify-center rounded-2xl border',
        locked
          ? 'border-neon-blue/40 bg-neon-blue/10 text-neon-blue'
          : 'text-muted-foreground/70 border-white/10 bg-white/[0.02]'
      )}
    >
      <Padlock shut={locked} big />
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
function Padlock({ shut, big = false }: { shut: boolean; big?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={big ? 'size-7' : 'size-[18px]'}
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
