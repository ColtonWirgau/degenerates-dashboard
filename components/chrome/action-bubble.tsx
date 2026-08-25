'use client'

import { useEffect, useLayoutEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Lock,
  LockOpen,
  MessageCircleQuestion,
  Pencil,
  Plus,
  ScrollText,
  Ticket,
} from 'lucide-react'
import {
  markWeekDirty,
  openPanel,
  openSubmit,
  subscribePanel,
  subscribeWeekActions,
  type CanvasPanel,
  type WeekActions,
} from '@/components/chrome/canvas-store'
import {
  useLeagueChrome,
  useOnRecap,
  useViewedWeek,
} from '@/components/chrome/league-chrome-context'
import { setWeekLock } from '@/app/actions/week-lock'
import { ArcLabel } from '@/components/chrome/arc-label'
import { DISC_CENTER } from '@/components/chrome/bite-geometry'
import {
  ACTION_HOME_C,
  emitSplitFrame,
  isSplit,
  rank2C,
  rank3C,
  rank4C,
  setActionBite,
  setSplit,
  subscribeSplitFrame,
  subscribeSplitState,
} from '@/components/chrome/bubble-layout'

/**
 * The card's RIGHT-edge, bottom: ONE bubble, ACTIONS — tap it and it
 * SPLITS. The week's two verbs spring up out of it while the slot under
 * your cursor becomes CLOSE, so folding is one re-click without moving
 * the mouse. The card's cutout follows the spring frame by frame, off
 * the same numbers that move the discs (bubble-layout.ts).
 *
 * A WEEK WITH A SLATE has the two halves of how it runs:
 *
 *   YOUR LEG   — what you're putting in.
 *   SUBMIT     — the commish saying "that's everyone, I'm placing it",
 *                which closes the week. Tap it again to reopen, right up
 *                until the first game we bet kicks off.
 *
 * THE PRESEASON WEEK has no slate, and for a long time that meant no pod
 * at all — so its creates ended up scattered through the page as inline
 * furniture: a dashed "add a topic" card at the foot, an "add an item"
 * button buried inside each topic's sheet, and no way to open a plain
 * question at all. They're verbs like any other week's, so they live
 * where verbs live:
 *
 *   ADD        — one form that makes a topic, an item, or a vote, because
 *                an item with two answers IS a vote and a topic is just
 *                the name you file it under.
 *   ASK        — a question that settles nothing in the book.
 *
 * Both are commish-only server-side, so for everyone else the preseason
 * pod isn't carved at all — a bubble that can only ever refuse you is
 * worse than no bubble.
 *
 * Once the week is closed, the things that can no longer be done say so
 * rather than disappearing: the disc wears a padlock and stops
 * responding. A verb that vanishes leaves you wondering where it went; a
 * verb wearing a lock tells you exactly why it won't move.
 */

/**
 * Who may close a week. Roles are already in the schema
 * (league_members.role: owner | admin | member) and the season panel's
 * roster is where they're handed out — so gating this is a one-word
 * change to `week?.canLock`. Open to everyone until the league says
 * otherwise.
 */
const LOCKING_IS_COMMISH_ONLY = false

export function ActionBubble() {
  const chrome = useLeagueChrome()
  const week = useViewedWeek()
  const onRecap = useOnRecap()
  const router = useRouter()
  const [panel, setPanel] = useState<CanvasPanel>(null)
  const [split, setSplitOpen] = useState(false)
  const [actions, setActions] = useState<WeekActions | null>(null)
  const [pending, start] = useTransition()

  // Both verbs ride the split spring; each tracks it through a ref, the
  // same value PageSheetCard carves the card by.
  const legBtn = useRef<HTMLButtonElement>(null)
  const legFace = useRef<HTMLSpanElement>(null)
  const lockBtn = useRef<HTMLButtonElement>(null)
  const lockFace = useRef<HTMLSpanElement>(null)
  const askBtn = useRef<HTMLButtonElement>(null)
  const askFace = useRef<HTMLSpanElement>(null)
  const [legVisible, setLegVisible] = useState(false)
  const [lockVisible, setLockVisible] = useState(false)
  const [askVisible, setAskVisible] = useState(false)

  useEffect(() => subscribePanel(setPanel), [])
  useEffect(() => subscribeSplitState(setSplitOpen), [])
  useEffect(() => subscribeWeekActions(setActions), [])

  // WHICH PAIR OF VERBS the pod is holding. The recap is a season rather
  // than a week, so it gets none — offering to put a leg into a year that
  // finished in February is worse than offering nothing.
  const hasSlate = !onRecap && (actions?.hasSlate ?? week?.hasSlate ?? false)
  const preseason =
    !onRecap && !hasSlate && week?.kind === 'preseason' && (chrome?.canManage ?? false)
  const armed = hasSlate || preseason
  useEffect(() => {
    setActionBite(armed)
  }, [armed])

  useEffect(
    () =>
      subscribeSplitFrame((t, third, fourth) => {
        setLegVisible(t > 0.001)
        setLockVisible(third > 0.001)
        setAskVisible(fourth > 0.001)
        const face = String(Math.max(0, Math.min(1, (t - 0.2) * 1.7)))
        if (legBtn.current) legBtn.current.style.bottom = `${rank2C(t) - DISC_CENTER}px`
        if (legFace.current) legFace.current.style.opacity = face
        if (lockBtn.current)
          lockBtn.current.style.bottom = `${rank3C(third) - DISC_CENTER}px`
        if (lockFace.current)
          lockFace.current.style.opacity = String(
            Math.max(0, Math.min(1, (third - 0.2) * 1.7))
          )
        if (askBtn.current)
          askBtn.current.style.bottom = `${rank4C(fourth) - DISC_CENTER}px`
        if (askFace.current)
          askFace.current.style.opacity = String(
            Math.max(0, Math.min(1, (fourth - 0.2) * 1.7))
          )
      }),
    []
  )

  // A reveal can open from elsewhere (the dock, a deep link); split so
  // its ✕ has a bubble to live on.
  useEffect(() => {
    if (panel === 'submit' || panel === 'compose' || panel === 'ask') setSplit(true)
  }, [panel])

  // A disc mounts BECAUSE of a frame, so it misses that frame's ref
  // writes — re-emit once it's in the DOM. Reduced motion has no second
  // frame to catch it, and the stack would sit at the home slot.
  useLayoutEffect(() => {
    if (legVisible || lockVisible || askVisible) emitSplitFrame()
  }, [legVisible, lockVisible, askVisible])

  // Folding: any press outside the pod puts it back together. Surfaces
  // marked data-split-keep (the submit reveal) don't count as outside —
  // the pod holds while you work in them.
  useEffect(() => {
    if (!split) return
    const fold = (e: PointerEvent) => {
      const t = e.target as Element | null
      if (t?.closest?.('[data-action-bubble], [data-split-keep]')) return
      if (isSplit()) setSplit(false)
    }
    document.addEventListener('pointerdown', fold, true)
    return () => document.removeEventListener('pointerdown', fold, true)
  }, [split])

  if (!week || !chrome || !armed) return null

  const locked = actions?.locked ?? week.parlayState !== 'open'
  const submitted = actions?.submitted ?? week.submitted
  const mayLock = LOCKING_IS_COMMISH_ONLY ? (actions?.canLock ?? false) : true
  // Reopening stops being on the table once the games start; closing
  // stops being on the table once it's closed.
  const lockToggleable = mayLock && (!locked || (actions?.reopenable ?? false))

  const toggleLock = () => {
    if (!lockToggleable || pending) return
    // A week with NOTHING in it is never one you meant to end. Locking
    // is reversible right up to kickoff, so this is a speed bump rather
    // than a guard — but the accident it prevents is a whole week of
    // twelve people's entries closed before anybody made one.
    if (
      !locked &&
      (actions?.submissionCount ?? week.submissionCount) === 0 &&
      !window.confirm(
        `Lock week ${week.weekNumber}? Nobody has a leg in yet — locking now ends it with an empty board.`
      )
    ) {
      return
    }
    setSplit(false)
    start(async () => {
      await setWeekLock(chrome.leagueId, week.id, !locked)
      markWeekDirty() // the stage's cached copy of this week
      router.refresh() // the rail, the week list, the standings
    })
  }

  return (
    <>
      {/* ─── THE PRESEASON PAIR ─────────────────────────────────────── */}
      {preseason && lockVisible && (
        <Bubble
          ref={lockBtn}
          faceRef={lockFace}
          label="ASK"
          labelVisible={split}
          open={panel === 'ask'}
          onClick={() => openPanel('ask')}
        >
          <MessageCircleQuestion size={21} strokeWidth={2.25} />
        </Bubble>
      )}
      {preseason && legVisible && (
        <Bubble
          ref={legBtn}
          faceRef={legFace}
          label="ADD"
          labelVisible={split}
          open={panel === 'compose'}
          onClick={() => openPanel('compose')}
        >
          <ScrollText size={20} strokeWidth={2.25} />
        </Bubble>
      )}

      {/* ASK — the top rank, and the commish's alone. A week can raise a
          question of its own (someone welched, the punishment needs
          settling) and until now the only way to open one was a dashed
          tile sitting under every week that had none. */}
      {hasSlate && chrome?.canManage && askVisible && (
        <Bubble
          ref={askBtn}
          faceRef={askFace}
          label="ASK"
          labelVisible={split}
          open={panel === 'ask'}
          onClick={() => openPanel('ask')}
        >
          <MessageCircleQuestion size={21} strokeWidth={2.25} />
        </Bubble>
      )}

      {/* ─── THE WEEK PAIR ──────────────────────────────────────────── */}
      {/* LOCK — the top rank. Ending the week is the last thing that
          happens to it, so it sits furthest from the resting slot.
          
          It said SUBMIT, which is what this app calls entering your leg
          EVERYWHERE else — the dock's own disc is labelled "Submit your
          leg" — and it sat directly above ADD LEG. Pressing the obvious
          word ended the week for twelve people instead of entering one
          bet. That is exactly how week 1 of this season got shut with
          nothing in it.
          
          LOCK, because the app already says a week is open or locked and
          a leg is locked in; CLOSE stays what it is everywhere else,
          the thing that puts a sheet away. */}
      {hasSlate && lockVisible && (
        <Bubble
          ref={lockBtn}
          faceRef={lockFace}
          label={locked ? (lockToggleable ? 'UNLOCK' : 'LOCKED') : 'LOCK'}
          labelVisible={split}
          disabled={!lockToggleable}
          onClick={toggleLock}
        >
          {locked ? (
            lockToggleable ? (
              <LockOpen size={20} strokeWidth={2.25} />
            ) : (
              <Lock size={20} strokeWidth={2.25} />
            )
          ) : (
            <Ticket size={21} strokeWidth={2.25} />
          )}
        </Bubble>
      )}

      {/* YOUR LEG — springs up out of the home slot to the middle rank. */}
      {hasSlate && legVisible && (
        <Bubble
          ref={legBtn}
          faceRef={legFace}
          // MISSED, not LOCKED. The disc above now says LOCKED for a
          // week that's shut, and two adjacent discs wearing one word
          // for two different facts is how this pod got into trouble in
          // the first place. This one is about YOU: the week closed and
          // you never got a leg in.
          label={locked && !submitted ? 'MISSED' : submitted ? 'YOUR LEG' : 'ADD LEG'}
          labelVisible={split}
          open={panel === 'submit'}
          // A closed week you never entered has nothing to show you; one
          // you did still opens, read-only, so you can see what you put
          // in.
          disabled={locked && !submitted}
          onClick={openSubmit}
        >
          {locked && !submitted ? (
            <Lock size={20} strokeWidth={2.25} />
          ) : submitted ? (
            <Pencil size={19} strokeWidth={2.25} />
          ) : (
            <Plus size={22} strokeWidth={2.25} />
          )}
        </Bubble>
      )}

      {/* The home slot — where you clicked. ACTIONS folded, CLOSE once
          split; putting it back never moves the cursor. */}
      <Bubble
        label={split ? 'CLOSE' : 'ACTIONS'}
        onClick={() => setSplit(!split)}
        hero
        style={{ bottom: ACTION_HOME_C - DISC_CENTER }}
      >
        {split ? (
          <span aria-hidden className="text-[1.15rem] leading-none">
            ✕
          </span>
        ) : (
          <Plus size={24} strokeWidth={2.25} />
        )}
      </Bubble>
    </>
  )
}

function Bubble({
  ref,
  faceRef,
  label,
  labelVisible = true,
  open = false,
  disabled = false,
  hero = false,
  onClick,
  style,
  children,
}: {
  ref?: React.Ref<HTMLButtonElement>
  faceRef?: React.Ref<HTMLSpanElement>
  label: string
  labelVisible?: boolean
  open?: boolean
  disabled?: boolean
  /** The resting slot wears the glow; the ranks that spring out of it
   *  don't, or the pod reads as three equal shouts. */
  hero?: boolean
  onClick: () => void
  /** Omitted for the ranks that ride the spring: their `bottom` is owned
   *  by the frame listener's ref write, and a value here would be
   *  re-applied by React on every render, yanking them back to the home
   *  slot mid-flight. The resting slot doesn't move, so it keeps one. */
  style?: React.CSSProperties
  children: React.ReactNode
}) {
  return (
    <button
      ref={ref}
      type="button"
      data-sheet-bubble
      data-action-bubble
      onClick={onClick}
      disabled={disabled}
      aria-label={open ? `Close ${label.toLowerCase()}` : label.toLowerCase()}
      aria-expanded={open}
      // Same focus treatment as the left bubbles: ring the disc, not the
      // rectangular hit-box.
      className="group hidden focus-visible:outline-none lg:block"
      style={{
        position: 'absolute',
        right: 0,
        transform: 'translateX(50%)',
        width: 64,
        height: 75,
        zIndex: 40,
        ...style,
      }}
    >
      {/* The name curved on the card side of the bite — mirrored twin of
          the left bubbles' stamps. (The wrapper is static, so the svg
          still positions against the button; it only carries the fade.) */}
      <span style={{ opacity: labelVisible ? 1 : 0, transition: 'opacity 180ms' }}>
        <ArcLabel
          text={label}
          cx={44}
          cy={49.5}
          r={39.5}
          side="left"
          boxW={88}
          boxH={99}
          inset={12}
          fontSize={8}
          bias={1.2}
        />
      </span>
      <span
        ref={faceRef}
        className={
          'neon-disc group-focus-visible:ring-2 group-focus-visible:ring-white absolute flex items-center justify-center rounded-full' +
          (hero ? ' neon-disc-hero' : '') +
          (disabled ? ' opacity-45' : '')
        }
        style={{ left: 10, top: 15.5, width: 44, height: 44 }}
      >
        {/* Keyed by identity so a CHANGED face pops into place. */}
        <span
          key={`${label}-${open}`}
          className="face-pop flex items-center justify-center"
        >
          {open ? (
            <span aria-hidden className="text-[1.15rem] leading-none">
              ✕
            </span>
          ) : (
            children
          )}
        </span>
      </span>
    </button>
  )
}
