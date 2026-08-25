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
import { WeekHero, type WeekHeroLeg } from '@/components/week-hero'
import type { ParlayState } from '@/lib/data/types'
import { cn } from '@/lib/utils'


/**
 * THE WEEK'S TWO ROWS: its own fixture band, then the slate's heading.
 *
 * The band is WeekHero — the draft hero's twin, because a week is the
 * same kind of object as the draft: a thing with a name, a state, and
 * something worth looking at beside it. It used to be a corner slab, a
 * state word and a padlock across an otherwise empty strip.
 *
 * The padlock went with it. It said one word — open or not — that the
 * state beside it already says in words, and the pod is where closing a
 * week actually happens. A read-only padlock next to a control that does
 * the same job is two things claiming one verb.
 */
export function WeekHeader({
  weekNumber,
  state,
  scopeCounts,
  legs,
  currentUserId,
}: {
  weekNumber: number
  state: ParlayState
  /** How many games each scope would show. Null hides the switch. */
  scopeCounts: Record<SlateScope, number> | null
  /** Everyone in the league and how their leg went — the hero's chart. */
  legs: WeekHeroLeg[]
  currentUserId: string | undefined
}) {
  const postLock = state !== 'open'
  const actionCount = scopeCounts?.action ?? 0

  // The week decides how wide the slate opens; changing weeks re-decides.
  useEffect(() => {
    resetSlateScope(postLock, actionCount)
  }, [weekNumber, postLock, actionCount])

  return (
    <>
      <WeekHero
        weekNumber={weekNumber}
        state={state}
        legs={legs}
        currentUserId={currentUserId}
      />

      {/* THE SLATE'S OWN HEADING — it names what you're looking at, and
          the switch that changes it sits at the other end of the same
          line. The switch used to carry that name stacked above itself,
          which put the label and the thing it labels a hand's width
          apart with nothing between them. */}
      {scopeCounts && <SlateHeading counts={scopeCounts} />}
    </>
  )
}

export function SlateHeading({ counts }: { counts: Record<SlateScope, number> }) {
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
        'group relative -mt-8 -ml-4 flex shrink-0 items-center justify-center overflow-hidden rounded-tl-[20px] pt-8 pb-5 transition-[filter] hover:brightness-125 lg:-ml-20',
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
