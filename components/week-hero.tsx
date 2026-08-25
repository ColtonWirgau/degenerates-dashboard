'use client'

/**
 * THE WEEK, as a fixture band — the draft hero's twin.
 *
 * Week 0 opens with PRESEASON on a slanted, tinted half and the room on
 * the other. A week with games gets the same construction, because it's
 * the same kind of object: a thing with a name, a state, and something
 * worth looking at beside it.
 *
 *   left    ‹ ALL WEEKS, then WEEK n at the size a title deserves.
 *   right   EVERY LEG IN THE LEAGUE, as the recap's own chart — a
 *           connected run of dots, blue where somebody won and pink
 *           where they didn't, with their face under each instead of a
 *           week number.
 *
 * The chart is the recap's, deliberately. It already means "how this
 * went" everywhere else in the app; pointed at one week instead of one
 * season it means the same thing read the other way, and nobody has to
 * learn a second chart.
 *
 * It is NOT the lay. THE LAY panel is the legs themselves — what each
 * person actually took, at what odds. This is the shape of the week:
 * who's in, who's missing, and how it went. A glance, not a read.
 */

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ConnectedDots, type ConnectedDotsResult } from '@/components/connected-dots'
import { openPanel } from '@/components/chrome/canvas-store'
import type { ParlayState } from '@/lib/data/types'
import { cn } from '@/lib/utils'

/* The seam, written out longhand — Tailwind reads source as TEXT, so a
 * class built from a template literal is one it never generates. See the
 * same note in draft-hero. */
const SEAM_WIDTH = 'sm:w-[42%] lg:w-[38%]'
const SEAM_CLIP = 'sm:[clip-path:polygon(0_0,100%_0,calc(100%-46px)_100%,0_100%)]'

/** The one line both eyebrows sit on. `sm:top-*` matches the band's two
 *  heights (10.5rem / 12.5rem) so the label keeps the same air above it
 *  at either size; the horizontal side is each caller's to say. */
const EYEBROW =
  'text-muted-foreground/60 group-hover:text-neon-blue inline-flex items-center gap-1 text-[10px] font-bold tracking-[0.28em] uppercase transition-colors sm:absolute sm:top-9 lg:top-11'

export interface WeekHeroLeg {
  userId: string
  fullName: string | null
  email: string
  avatarUrl: string | null
  /** Null while pending — or because they never put one in. */
  result: 'win' | 'loss' | 'push' | null
  description: string | null
}

export function WeekHero({
  weekNumber,
  state,
  legs,
  currentUserId,
}: {
  weekNumber: number
  state: ParlayState
  /** Everyone in the league, in board order — including who didn't pick. */
  legs: WeekHeroLeg[]
  currentUserId: string | undefined
}) {
  const won = state === 'won'
  const lost = state === 'lost'

  const dots: ConnectedDotsResult[] = legs.map((l) => ({
    weekNumber,
    weekId: l.userId,
    result: l.result,
    title: `${l.fullName ?? l.email}${
      l.description ? ` — ${l.description}` : ' — no pick'
    }`,
    label: (
      <Avatar
        className={cn(
          'h-6 w-6 ring-1',
          l.userId === currentUserId ? 'ring-neon-blue/70' : 'ring-white/15'
        )}
      >
        <AvatarImage src={l.avatarUrl ?? undefined} alt="" />
        <AvatarFallback className="bg-primary/70 text-primary-foreground text-[8px] font-bold">
          {initials(l.fullName, l.email)}
        </AvatarFallback>
      </Avatar>
    ),
  }))

  return (
    <section aria-label={`Week ${weekNumber}`} className="relative -mx-4 -mt-8 mb-8 lg:-mx-20">
      <h1 className="sr-only">Week {weekNumber}</h1>
      <div className="relative flex flex-col overflow-hidden sm:h-[10.5rem] sm:flex-row sm:items-stretch lg:h-[12.5rem]">
        {/* THE WEEK — its name, and the door to the list of them. */}
        <button
          type="button"
          onClick={() => openPanel('slate')}
          aria-label={`Week ${weekNumber} — open the week list`}
          className={cn(
            'group relative z-20 flex w-full flex-col items-start justify-center px-4 py-5 text-left transition-[filter] hover:brightness-110 sm:shrink-0 sm:py-0 sm:pr-12 lg:pl-20',
            SEAM_WIDTH,
            SEAM_CLIP
          )}
          style={{
            backgroundColor: '#0A0A0A',
            backgroundImage: won
              ? 'linear-gradient(115deg, rgba(0,217,255,0.26), rgba(0,217,255,0.06) 62%, rgba(0,217,255,0.02))'
              : lost
                ? 'linear-gradient(115deg, rgba(255,105,180,0.24), rgba(255,105,180,0.05) 62%, rgba(255,105,180,0.02))'
                : 'linear-gradient(115deg, rgba(0,217,255,0.22), rgba(0,217,255,0.06) 62%, rgba(0,217,255,0.02))',
          }}
        >
          {/* Both eyebrows are pinned to ONE line rather than each being
              centred with the block under it — the two halves hold
              different things (a title, a chart), so "centre each side"
              put them at different heights and the band read as two
              pieces instead of one. Below sm the halves stack and each
              flows normally. */}
          <span className={cn(EYEBROW, 'mb-1.5 sm:left-4 lg:left-20')}>
            <ChevronLeftMark />
            All weeks
          </span>
          <span
            className={cn(
              'font-display text-4xl leading-[0.85] tracking-tight uppercase sm:text-5xl lg:text-6xl',
              won ? 'text-neon-blue' : lost ? 'text-destructive' : 'text-foreground'
            )}
          >
            Week {weekNumber}
          </span>
        </button>

        {/* THE LEAGUE'S WEEK, and the door to it. The chart is the shape
            of the lay — who's in, who's missing, how it went — so
            pressing it opens the lay itself, at full detail. THE LAY had
            a rung on the rail wearing a count, which was a second, worse
            way of saying what this whole half already says. */}
        <button
          type="button"
          onClick={() => openPanel('parlay')}
          aria-label={`Week ${weekNumber} — open the lay`}
          className="group relative z-10 flex min-w-0 flex-1 flex-col justify-center px-4 py-6 text-left transition-[filter] hover:brightness-125 sm:py-0 sm:pl-14 lg:pr-20">
          {/* The name of the door, at the far edge — the mirror of ALL
              WEEKS on the other half, pointing the other way because
              that's the direction it takes you. It used to be the week's
              state word, which named the thing you were looking at
              instead of the thing pressing it would open. */}
          <span className={cn(EYEBROW, 'mb-3 ml-auto sm:right-4 lg:right-20')}>
            The lay
            <ChevronRightMark />
          </span>
          {dots.length > 0 ? (
            // 24px of avatar, not 12px of numeral — the band under the
            // dots has to make room or the faces crowd the run.
            <ConnectedDots results={dots} labelHeight={26} />
          ) : (
            <span className="text-muted-foreground/50 text-xs italic">
              Nobody&apos;s in yet.
            </span>
          )}
        </button>
      </div>
    </section>
  )
}

/** The chevron, hand-rolled so the hero doesn't pull an icon set in for
 *  one 12px glyph. */
function ChevronLeftMark() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="h-3 w-3"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15 18 9 12l6-6" />
    </svg>
  )
}

/** Its mirror. */
function ChevronRightMark() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="h-3 w-3"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  )
}

function initials(name: string | null, email: string): string {
  if (name) {
    const parts = name.split(' ').filter(Boolean)
    if (parts.length >= 2) return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase()
    return name.slice(0, 2).toUpperCase()
  }
  return email.slice(0, 2).toUpperCase()
}
