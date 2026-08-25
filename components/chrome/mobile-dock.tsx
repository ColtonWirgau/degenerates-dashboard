'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Check,
  Lock,
  LockOpen,
  MessageCircleQuestion,
  Pencil,
  Plus,
  ScrollText,
  Ticket,
  Trophy,
  UserRoundCheck,
  X,
} from 'lucide-react'
import {
  markWeekDirty,
  openPanel,
  openSubmit,
  subscribeWeekActions,
  type WeekActions,
} from '@/components/chrome/canvas-store'
import {
  useLeagueChrome,
  useOnRecap,
  useViewedWeek,
} from '@/components/chrome/league-chrome-context'
import { setWeekLock } from '@/app/actions/week-lock'

/**
 * The mobile dock (ported from RoarTracker): a floating glass PILL of
 * five fixed SLOTS that never move — the center slot is THE button, an
 * electric-blue disc, the one distinguished thing on the bar.
 *
 *   root:      BOARD · (+) · SEASON
 *   verbs:     (✕) · the week's verbs, blooming to its right
 *
 * NO WEEK CELL, NO LAY CELL. RoarTracker's dock carries the games and
 * the money because nothing else does. DD's HERO carries both: it opens
 * with "‹ ALL WEEKS" over the week's name in 60px type, and the far end
 * of the same band is "THE LAY ›". Both were second doors to rooms the
 * hero already had a door to, an inch up the screen, whispering what
 * the page was saying out loud.
 *
 * What's left is what the hero does NOT say: the standings, and the
 * season. Three slots, and the disc parks dead centre in every posture
 * — no cell appearing or vanishing with the week, so the bar never
 * reshuffles under a thumb.
 *
 * It is the phone's whole navigation, so it has to carry what the
 * desktop carries — and the desktop carries TWO things a phone can't
 * show at once: the left rail's panels and the action pod's verbs. So
 * the slots are the panels and the DISC IS THE POD. Pressing it splits
 * the bar into the same verbs the pod holds, and pressing it again (or
 * anywhere off the bar) folds it back. That's the same gesture as the
 * pod's outside-pointerdown fold, and the same idea: the bar holds
 * still, the faces change.
 *
 * The disc used to be a verb itself, which meant the pod's other verbs
 * were unreachable on a phone — no ASK, no LOCK, and on week 0 no way
 * to put anything on the ballot at all.
 *
 * SEASON lives down here, not in the masthead. The header carries the
 * brand and you; a phone header with three things in it makes the app's
 * own name the smallest of them.
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
  disabled?: boolean
}

type Page = 'root' | 'verbs'

export function MobileDock() {
  const chrome = useLeagueChrome()
  const week = useViewedWeek()
  const onRecap = useOnRecap()
  const router = useRouter()
  const nav = useRef<HTMLElement>(null)
  const [page, setPage] = useState<Page>('root')
  const [actions, setActions] = useState<WeekActions | null>(null)
  const [locking, lock] = useTransition()

  useEffect(() => subscribeWeekActions(setActions), [])

  // A tap anywhere off the bar folds it home — the same gesture the
  // desktop pod uses, and the same reason: a bar that stays split is a
  // bar you have to dismiss.
  useEffect(() => {
    if (page === 'root') return
    const fold = (e: PointerEvent) => {
      if (nav.current && !nav.current.contains(e.target as Node)) setPage('root')
    }
    document.addEventListener('pointerdown', fold, true)
    return () => document.removeEventListener('pointerdown', fold, true)
  }, [page])

  if (!chrome) return null

  const hasSlate = (actions?.hasSlate ?? week?.hasSlate ?? false) && !onRecap
  const preseason = !onRecap && !hasSlate && week?.kind === 'preseason'
  const locked = actions?.locked ?? week?.parlayState !== 'open'
  const submitted = actions?.submitted ?? week?.submitted ?? false
  const mayLock = actions?.canLock ?? false
  const lockToggleable = mayLock && (!locked || (actions?.reopenable ?? false))

  // Every number on this bar belongs to a season, and mid-switch they all
  // belong to the one you just left. The cells keep their places — the bar
  // must not reshuffle under a thumb — and go quiet until the real ones
  // land. Same treatment as the desktop rail's faces.
  const waiting = chrome.switching
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
  // THE SEASON, down here where RoarTracker keeps it — the year and
  // everything hanging off it (who's in, the book, the settings).
  const seasonCell: Face = {
    key: `season-${chrome.season}`,
    label: 'Season and league',
    onClick: () => openPanel('season'),
    content: (
      <span className="font-display text-[0.82rem]">
        <span className="text-muted-foreground/50">&rsquo;</span>
        {chrome.season.slice(2, 4)}
      </span>
    ),
    below: 'Season',
  }

  // ─── The verbs, when the disc is open ──────────────────────────────
  const toggleLock = () => {
    if (!lockToggleable || locking || !week) return
    if (
      !locked &&
      (actions?.submissionCount ?? week.submissionCount) === 0 &&
      !window.confirm(
        `Lock week ${week.weekNumber}? Nobody has a leg in yet — locking now ends it with an empty board.`
      )
    ) {
      return
    }
    setPage('root')
    lock(async () => {
      await setWeekLock(chrome.leagueId, week.id, !locked)
      markWeekDirty()
      router.refresh()
    })
  }

  const go = (fn: () => void) => () => {
    setPage('root')
    fn()
  }

  const legVerb: Face = {
    key: `leg-${locked}-${submitted}`,
    label: locked && !submitted ? 'Missed' : submitted ? 'Your leg' : 'Add leg',
    onClick: go(openSubmit),
    disabled: locked && !submitted,
    content:
      locked && !submitted ? (
        <Lock size={16} strokeWidth={2.25} />
      ) : submitted ? (
        <Pencil size={15} strokeWidth={2.25} />
      ) : (
        <Plus size={17} strokeWidth={2.25} />
      ),
    below: locked && !submitted ? 'Missed' : submitted ? 'Your leg' : 'Leg',
  }
  const lockVerb: Face = {
    key: `lock-${locked}`,
    label: locked ? (lockToggleable ? 'Unlock' : 'Locked') : 'Lock',
    onClick: toggleLock,
    disabled: !lockToggleable,
    content: locked ? (
      lockToggleable ? (
        <LockOpen size={16} strokeWidth={2.25} />
      ) : (
        <Lock size={16} strokeWidth={2.25} />
      )
    ) : (
      <Ticket size={16} strokeWidth={2.25} />
    ),
    below: locked ? (lockToggleable ? 'Unlock' : 'Locked') : 'Lock',
  }
  const askVerb: Face = {
    key: 'ask',
    label: 'Ask the league',
    onClick: go(() => openPanel('ask')),
    content: <MessageCircleQuestion size={16} strokeWidth={2.25} />,
    below: 'Ask',
  }
  const addVerb: Face = {
    key: 'add',
    label: 'Add to the book',
    onClick: go(() => openPanel('compose')),
    content: <ScrollText size={16} strokeWidth={2.25} />,
    below: 'Add',
  }
  const keeperVerb: Face = {
    key: 'keeper',
    label: 'Your keeper',
    onClick: go(() => openPanel('keeper')),
    content: <UserRoundCheck size={16} strokeWidth={2.25} />,
    below: 'Keeper',
  }

  // The same verbs the desktop pod holds, in the same order — the leg
  // and the lock for a week with games; the charter's two and the
  // keeper for week 0. ADD and ASK stay the commissioner's.
  const verbs: Face[] = hasSlate
    ? [legVerb, lockVerb, ...(chrome.canManage ? [askVerb] : [])]
    : preseason
      ? [keeperVerb, ...(chrome.canManage ? [addVerb, askVerb] : [])]
      : []

  const armed = verbs.length > 0
  // Nothing to split into: the disc goes back to being the way to your
  // leg, and the recap keeps none of it.
  const slots: (Face | 'park' | null)[] =
    page === 'verbs'
      ? ([
          'park',
          ...verbs,
          ...Array<null>(Math.max(0, 4 - verbs.length)).fill(null),
        ].slice(0, 5) as (Face | 'park' | null)[])
      : [boardCell, 'park', seasonCell]

  // WHERE THE DISC SITS: over its park, wherever that lands.
  //
  // It used to be pinned at 50%, which is only the park's centre when
  // every slot is live — a collapsed cell slid the park out from under
  // it, onto the boundary with its neighbour. Root is symmetric now and
  // 50% happens to be right, but the VERBS page parks at the left end
  // and a member's page holds fewer verbs than a commissioner's, so the
  // position still has to be counted rather than assumed.
  const shares = slots.filter((sl) => sl !== null)
  const parkAt = shares.indexOf('park')
  const at = shares.length > 0 && parkAt >= 0 ? (parkAt + 0.5) / shares.length : 0.5

  const disc =
    page === 'verbs'
      ? {
          // Back to the left end, options blooming to its right — the
          // pod's own shape, laid on its side.
          at,
          faceKey: 'close',
          label: 'Close the menu',
          onClick: () => setPage('root'),
          icon: <X size={20} strokeWidth={2.5} />,
        }
      : armed
        ? {
            at,
            faceKey: 'actions',
            label: 'Actions',
            onClick: () => setPage('verbs'),
            icon: <Plus size={22} strokeWidth={2.5} />,
          }
        : {
            at,
            faceKey: submitted ? 'submitted' : 'submit',
            label: submitted ? 'Your leg' : 'Submit your leg',
            onClick: openSubmit,
            icon: submitted ? (
              <Check size={20} strokeWidth={2.5} />
            ) : (
              <Plus size={22} strokeWidth={2.5} />
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
      <div className="glass neon-glow-blue border-primary/25 isolate relative flex items-center overflow-hidden rounded-full border px-2 py-1.5">
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
      disabled={!live || face.disabled}
      onClick={live && !face.disabled ? face.onClick : undefined}
      aria-label={live ? face.label : undefined}
      aria-hidden={!live}
      tabIndex={live ? undefined : -1}
      className={`flex min-w-0 flex-col items-center justify-center gap-0.5 overflow-hidden rounded-full py-1.5 transition-[flex-grow,opacity] duration-300 ease-[cubic-bezier(0.2,0.9,0.25,1)] ${
        live
          ? face.disabled
            ? 'text-muted-foreground/40'
            : 'text-muted-foreground hover:bg-white/10 hover:text-foreground'
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
 *  morphs (keyed face-pop) and it SLIDES between slots when the bar
 *  pages — centre at rest, the left end once the verbs are out. */
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
