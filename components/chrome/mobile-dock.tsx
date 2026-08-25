'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, Layers, ListTodo, Plus, Trophy } from 'lucide-react'
import { openPanel, openSubmit } from '@/components/chrome/canvas-store'
import {
  useLeagueChrome,
  useOnRecap,
  useViewedWeek,
} from '@/components/chrome/league-chrome-context'

/**
 * The mobile dock (ported from RoarTracker): a floating glass PILL of five
 * fixed SLOTS that never move — the center slot is THE button: an
 * electric-blue disc, the one distinguished thing on the bar.
 *
 * It's the left rail at phone width, so it says the same things in the
 * same order — and like the rail it's a function of the WEEK you're
 * looking at, with the disc holding that week's verb:
 *
 *   a week with a slate:  WEEK · LAY · (+/✓) · BOARD ·
 *   the preseason week:   WEEK ·     · (VOTES) · BOARD · ADD
 *
 * Each slot crossfades its face (face-pop) when its live fact changes.
 * There is no Home cell because home IS the week behind the sheets, no
 * League cell because the league lives in the masthead's lockup, and no
 * Profile cell because your face is up there beside it.
 *
 * FIXED, floating over the card: content clears the bar with its own
 * padding, honoring the home-indicator safe area in standalone.
 */
type Face = {
  /** Identity — a changed key is what triggers the face-pop. */
  key: string
  label: string
  onClick: () => void
  content: React.ReactNode
  /** The word under the mark. */
  below?: string
}

export function MobileDock() {
  const chrome = useLeagueChrome()
  const week = useViewedWeek()
  const onRecap = useOnRecap()
  const nav = useRef<HTMLElement>(null)
  // Reserved for face-morph paging when the dock grows a second page.
  const [page] = useState<'root'>('root')
  void page

  useEffect(() => {
    // Placeholder for the outside-tap fold once paging exists.
  }, [])

  if (!chrome) return null

  const hasSlate = week?.hasSlate ?? false
  const openPolls = week?.openPollCount ?? 0
  const weekFace = week
    ? week.kind === 'preseason'
      ? 'PRE'
      : `WK ${week.weekNumber}`
    : 'WK –'

  // Every number on this bar belongs to a season, and mid-switch they all
  // belong to the one you just left. The cells keep their places — the bar
  // must not reshuffle under a thumb — and go quiet until the real ones
  // land. Same treatment as the desktop rail's faces.
  const waiting = chrome.switching

  const weekCell: Face = {
    key: `week-${waiting ? 'switching' : (week?.id ?? '')}`,
    label: 'Weeks',
    onClick: () => openPanel('slate'),
    content: waiting ? (
      <Waiting />
    ) : (
      <span className="font-display text-[0.82rem]">{weekFace}</span>
    ),
    below: 'Week',
  }
  const boardCell: Face = {
    key: `board-${waiting ? 'switching' : (chrome.myRank ?? '')}`,
    label: 'Leaderboard',
    onClick: () => openPanel('board'),
    content: waiting ? (
      <Waiting />
    ) : chrome.myRank != null ? (
      <span className="font-display text-[0.82rem]">#{chrome.myRank}</span>
    ) : (
      <Trophy size={16} strokeWidth={2.25} />
    ),
    below: 'Board',
  }
  const addCell: Face = {
    key: 'add',
    label: 'Add to the book',
    onClick: () => openPanel('compose'),
    content: <Plus size={16} strokeWidth={2.25} />,
    below: 'Add',
  }
  const layCell: Face = {
    key: `lay-${waiting ? 'switching' : (week?.submissionCount ?? 0)}`,
    label: 'The lay',
    onClick: () => openPanel('parlay'),
    content: waiting ? (
      <Waiting />
    ) : (week?.submissionCount ?? 0) > 0 ? (
      <span className="font-display text-[0.82rem]">{week!.submissionCount}</span>
    ) : (
      <Layers size={16} strokeWidth={2.25} />
    ),
    below: 'Lay',
  }

  // The disc is the week's verb. A week with a slate wants your leg; the
  // preseason week wants your vote. A missing cell collapses rather than
  // reshuffling its neighbours, so the bar never moves under your thumb.
  // Same reasoning as the rail: on the recap the lay is about a week
  // that isn't on screen and the board already is. The week cell stays —
  // it's the way back out.
  const hasParlay = week?.parlayId != null && !onRecap
  // The rail's rungs, in the rail's order, and then the preseason's
  // create verb — the commish's alone. The disc stays the MEMBER's verb:
  // go and vote.
  const isPreseason = week?.kind === 'preseason' && !onRecap
  const slots: (Face | 'park' | null)[] = [
    weekCell,
    hasParlay ? layCell : null,
    'park',
    onRecap ? null : boardCell,
    onRecap ? null : isPreseason && chrome.canManage ? addCell : null,
  ]

  const disc = hasSlate
    ? week!.submitted
      ? {
          at: 0.5,
          faceKey: 'submitted',
          label: 'Your leg',
          onClick: openSubmit,
          icon: <Check size={20} strokeWidth={2.5} />,
        }
      : {
          at: 0.5,
          faceKey: 'submit',
          label: 'Submit your leg',
          onClick: openSubmit,
          icon: <Plus size={22} strokeWidth={2.5} />,
        }
    : {
        // The preseason week's verb is voting, and the votes are ON the
        // page rather than behind a panel — so the disc takes you to
        // them. Worth a slot because the charter under the ballot runs
        // long on a phone, and this is the way back up.
        at: 0.5,
        faceKey: `ballot-${openPolls}`,
        label: openPolls > 0 ? 'Go to the vote' : 'Go to the draft',
        onClick: toBallot,
        icon:
          openPolls > 0 ? (
            <span className="font-display text-[1rem] leading-none">{openPolls}</span>
          ) : (
            <ListTodo size={20} strokeWidth={2.5} />
          ),
      }

  return (
    <nav
      ref={nav}
      aria-label="Main"
      className="fixed inset-x-3 z-40 lg:hidden"
      style={{ bottom: 'max(0.75rem, calc(env(safe-area-inset-bottom) + 0.25rem))' }}
    >
      {/* A PILL floating free of the card. overflow-hidden + isolate pin
          the glass blur inside the radius on iOS, which otherwise paints
          it as a square. */}
      <div className="glass neon-glow-blue isolate relative flex items-center overflow-hidden rounded-full border border-primary/25 px-2 py-1.5">
        {slots.map((face, i) => (
          <Slot key={i} face={face} />
        ))}
        <HeroDisc {...disc} />
      </div>
    </nav>
  )
}

/** One dock slot. A live face grows to an equal share of the bar and
 *  crossfades in place when it changes (keyed face-pop); "park" holds an
 *  equal share EMPTY under the disc; a vacated slot collapses to nothing
 *  (animated flex-grow) so its neighbors spread out to fill the pill. */
function Slot({ face }: { face: Face | 'park' | null }) {
  const live = typeof face === 'object' && face !== null
  return (
    <button
      type="button"
      disabled={!live}
      onClick={live ? face.onClick : undefined}
      aria-label={live ? face.label : undefined}
      aria-hidden={!live}
      tabIndex={live ? undefined : -1}
      className={`flex min-w-0 flex-col items-center justify-center gap-0.5 overflow-hidden rounded-full py-1.5 transition-[flex-grow,opacity] duration-300 ease-[cubic-bezier(0.2,0.9,0.25,1)] ${
        live
          ? 'text-muted-foreground hover:bg-white/10 hover:text-foreground'
          : 'pointer-events-none opacity-0'
      }`}
      style={{ flexGrow: face ? 1 : 0.0001, flexBasis: 0, minHeight: 44 }}
    >
      {live && (
        <span key={face.key} className="face-pop flex flex-col items-center gap-0.5">
          <span className="flex items-center justify-center gap-1 whitespace-nowrap">
            {face.content}
          </span>
          {face.below && (
            <span className="text-[0.52rem] tracking-[0.1em] whitespace-nowrap uppercase">
              {face.below}
            </span>
          )}
        </span>
      )}
    </button>
  )
}

/** THE button: an electric-blue disc floating over the bar. Its face
 *  morphs (keyed face-pop); the slide plumbing (`at`) is ready for paging. */
function HeroDisc({
  at,
  faceKey,
  label,
  onClick,
  icon,
}: {
  at: number
  faceKey: string
  label: string
  onClick: () => void
  icon: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="absolute top-1/2 z-10 transition-[left] duration-300 ease-[cubic-bezier(0.2,0.9,0.25,1)]"
      style={{
        // px-2 pads the rail 8px each side; `at` is the center of the
        // disc's slot within what's left.
        left: `calc(8px + (100% - 16px) * ${at})`,
        transform: 'translate(-50%, -50%)',
      }}
    >
      <span className="bg-primary text-primary-foreground neon-glow-blue flex size-11 items-center justify-center rounded-full transition-transform active:scale-95">
        <span key={faceKey} className="face-pop flex items-center justify-center">
          {icon}
        </span>
      </span>
    </button>
  )
}

/** A cell with nothing true to say yet. */
function Waiting() {
  return (
    <span
      aria-hidden
      className="h-1.5 w-1.5 animate-pulse rounded-full bg-current opacity-40"
    />
  )
}

/** Scroll the preseason's votes into view — or, once they're all
 *  settled and the ballot isn't rendered, the business that replaced
 *  them. */
function toBallot() {
  const target =
    document.getElementById('preseason-ballot') ??
    document.getElementById('preseason-business')
  target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
