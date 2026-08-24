'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Textarea } from '@/components/ui/textarea'
import {
  AlertCircle,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  Loader2,
  Minus,
  Send,
  Skull,
  Trophy,
  UserX,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { WeekDetailSheet, type WeekDetailData } from '@/components/week-detail-sheet'
import { OddsInput } from '@/components/odds-input'
import { submitLeg, type SubmitLegResult } from '@/app/actions/legs'
import confetti from 'canvas-confetti'

interface CurrentWeekDockProps {
  data: WeekDetailData
  leagueId: string
  membersCount: number
  /** Current viewer — drives the composer's avatar (so the form reads as
   *  "your post") and serves as a fallback identity. */
  currentUser: {
    fullName: string | null
    email: string
    avatarUrl: string | null
  }
}

const getInitials = (name: string | null, email: string) => {
  if (name) {
    const parts = name.split(' ')
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    return name.slice(0, 2).toUpperCase()
  }
  return email.slice(0, 2).toUpperCase()
}

/**
 * Floating bottom dock for the current week. **Always about ME** — paired
 * with `<LeagueTopDock>` which carries league-wide context. Modes:
 *
 *   1. **Composer** — open parlay, my leg not in yet. Claude-style textarea
 *      with an odds chip + Submit button.
 *
 *   2. **Your-leg pill** — my leg is in (any state). Renders my pick + odds
 *      + a status badge that mirrors the current parlay state (pending /
 *      win / loss / push). Tapping opens the week sheet (and goes straight
 *      to edit when the parlay is still open).
 *
 *   3. **Missed-deadline notice** — parlay locked/+ and I never submitted.
 *      Compact warning pill; tap opens the sheet for context.
 */
export function CurrentWeekDock({
  data,
  leagueId,
  membersCount,
  currentUser,
}: CurrentWeekDockProps) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const { parlayState, userLeg, week } = data
  const isOpen = parlayState === 'open'
  const needsSubmission = isOpen && !userLeg

  // Open + my leg: tap drills straight to the edit sub-page; otherwise
  // open the sheet on the main page (lay + winners/slackers drills).
  const sheetInitialPage = isOpen && userLeg ? 'edit-leg' : 'main'

  return (
    <>
      <div
        className="fixed inset-x-0 bottom-0 z-40 px-3 sm:px-4 pb-3 pt-2 pointer-events-none"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0.75rem)' }}
      >
        {needsSubmission ? (
          <DockComposer
            week={week}
            leagueId={leagueId}
            currentUser={currentUser}
          />
        ) : (
          <DockYourLeg
            data={data}
            currentUser={currentUser}
            onTap={() => setSheetOpen(true)}
          />
        )}
      </div>

      <WeekDetailSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        data={data}
        leagueId={leagueId}
        membersCount={membersCount}
        initialPage={sheetInitialPage}
      />
    </>
  )
}

// ─── Composer ───────────────────────────────────────────────────────────────

const DEFAULT_ODDS = -110

const fmtOdds = (n: number) => (n > 0 ? `+${n}` : `${n}`)

interface DockComposerProps {
  week: WeekDetailData['week']
  leagueId: string
  currentUser: {
    fullName: string | null
    email: string
    avatarUrl: string | null
  }
}

function DockComposer({
  week,
  leagueId,
  currentUser,
}: DockComposerProps) {
  const router = useRouter()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [description, setDescription] = useState('')
  const [odds, setOdds] = useState<number>(DEFAULT_ODDS)
  const [oddsOpen, setOddsOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<SubmitLegResult['warning'] | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setWarning(null)
    const desc = description.trim()
    if (!desc) {
      setError('Add a description for your leg.')
      textareaRef.current?.focus()
      return
    }
    setSubmitting(true)
    const result = await submitLeg(week.id, leagueId, {
      description: desc,
      odds: String(odds),
    })
    if (result.error) {
      setError(result.error)
      setSubmitting(false)
      return
    }
    setSubmitting(false)
    if (result.warning) {
      setWarning(result.warning)
      router.refresh()
      return
    }
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.85 },
      colors: ['#00D9FF', '#FF69B4', '#39FF14', '#A855F7'],
    })
    setDescription('')
    setOdds(DEFAULT_ODDS)
    setOddsOpen(false)
    router.refresh()
  }

  return (
    <motion.form
      layout
      transition={{ type: 'spring', stiffness: 400, damping: 38 }}
      onSubmit={handleSubmit}
      className={cn(
        // Liquid-glass panel — translucent white tint, heavy blur, refractive
        // top-edge highlight via the before pseudo.
        'pointer-events-auto relative mx-auto w-full max-w-3xl overflow-hidden rounded-2xl border border-white/15',
        'bg-white/[0.06] backdrop-blur-3xl shadow-[0_8px_30px_rgba(0,0,0,0.4)]',
        'before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/30 before:to-transparent',
        'focus-within:border-neon-blue/40 focus-within:shadow-[0_8px_40px_rgba(0,217,255,0.18)]'
      )}
    >
      {/* Eyebrow — submission action label only. League context (counts +
          avatars) lives elsewhere; the dock here is exclusively yours. */}
      <div className="px-4 pt-2.5">
        <span className="text-[10px] font-bold tracking-[0.25em] uppercase text-neon-blue">
          Submit your leg · Wk {week.week_number}
        </span>
      </div>

      {/* Composer body — your avatar + textarea, vertically centered. */}
      <div className="flex items-center gap-2.5 px-4 pt-2 pb-2">
        <Avatar className="h-7 w-7 shrink-0 ring-2 ring-neon-blue/40">
          <AvatarImage
            src={currentUser.avatarUrl ?? undefined}
            alt={currentUser.fullName ?? currentUser.email}
          />
          <AvatarFallback className="bg-neon-blue text-primary-foreground text-[10px] font-bold">
            {getInitials(currentUser.fullName, currentUser.email)}
          </AvatarFallback>
        </Avatar>
        <Textarea
          ref={textareaRef}
          placeholder="What's your pick? (e.g., Chiefs -3.5, Lakers ML, Over 47.5)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={1}
          className="resize-none border-0 bg-transparent px-0 py-0 min-h-7 text-base shadow-none focus-visible:ring-0 focus-visible:shadow-none placeholder:text-muted-foreground/60 leading-7"
        />
      </div>

      {/* Optional inline messages — error or AI warning. */}
      {(error || warning) && (
        <div className="px-4 pb-2 space-y-1.5">
          {error && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-2.5 py-2 text-xs text-destructive">
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {warning && (
            <div className="rounded-md border border-neon-pink/50 bg-neon-pink/5 px-2.5 py-2 text-xs space-y-1">
              <div className="flex items-start gap-2 text-neon-pink">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span className="font-bold tracking-wide uppercase">Heads up — saved anyway</span>
              </div>
              <p className="text-foreground/90">{warning.reason}</p>
              {warning.conflictsWith.length > 0 && (
                <p className="text-muted-foreground">
                  Conflicts with:{' '}
                  <span className="text-foreground">{warning.conflictsWith.join(', ')}</span>
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Odds drawer — slides in above the action row when the chip is
          tapped. Drag the handle bar at the top of the drawer downward to
          collapse, mirroring the bottom-sheet pattern. */}
      <AnimatePresence initial={false}>
        {oddsOpen && (
          <motion.div
            key="odds-drawer"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="overflow-hidden border-t border-white/10"
          >
            <motion.div
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.6 }}
              dragMomentum={false}
              onDragEnd={(_e, info) => {
                if (info.offset.y > 50 || info.velocity.y > 400) {
                  setOddsOpen(false)
                }
              }}
              className="cursor-grab active:cursor-grabbing select-none"
            >
              {/* Drag handle — small bar at the top so the drag affordance
                  is obvious and the slider below isn't a touch-target conflict. */}
              <div className="flex justify-center pt-1.5 pb-1">
                <div className="h-1 w-10 rounded-full bg-white/30" />
              </div>
              <div className="px-4 pb-3">
                <OddsInput value={odds} onChange={setOdds} />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action row — odds chip on the left, Lock button on the right. */}
      <div className="flex items-center gap-2 border-t border-white/10 px-3 py-2.5">
        <button
          type="button"
          onClick={() => setOddsOpen((v) => !v)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold tabular-nums transition-colors',
            oddsOpen
              ? 'bg-neon-blue text-primary-foreground ring-1 ring-neon-blue/40'
              : 'bg-white/5 text-foreground/90 hover:bg-white/10'
          )}
          aria-expanded={oddsOpen}
        >
          <span className="text-[9px] font-bold tracking-widest uppercase text-muted-foreground">
            Odds
          </span>
          <span>{fmtOdds(odds)}</span>
          <ChevronDown
            className={cn('h-3 w-3 transition-transform', oddsOpen && 'rotate-180')}
          />
        </button>

        <button
          type="submit"
          disabled={submitting}
          className={cn(
            'group/lock ml-auto inline-flex items-center gap-2 rounded-full px-5 py-2',
            'text-sm font-extrabold tracking-wide uppercase',
            'bg-black/60 text-neon-blue',
            'transition-colors hover:bg-neon-blue hover:text-black hover:[text-shadow:none]',
            'active:scale-[0.98]',
            'disabled:opacity-60 disabled:cursor-not-allowed'
          )}
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Submitting
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              Submit
            </>
          )}
        </button>
      </div>
    </motion.form>
  )
}

// ─── Your-leg dock (post-submission read-only / tap-to-edit) ───────────────

const fmtUserOdds = (raw: string | number | undefined): string => {
  if (raw == null) return ''
  const n = parseInt(String(raw).replace(/[^-\d]/g, ''), 10)
  if (isNaN(n)) return String(raw)
  return n > 0 ? `+${n}` : `${n}`
}

function DockYourLeg({
  data,
  currentUser,
  onTap,
}: {
  data: WeekDetailData
  currentUser: {
    fullName: string | null
    email: string
    avatarUrl: string | null
  }
  onTap: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const dockRef = useRef<HTMLDivElement>(null)
  // Click-outside-to-collapse — modal-style dismiss for the inline
  // YourGame drawer. pointerdown in capture phase so handler runs
  // before any descendant could stopPropagation it.
  useEffect(() => {
    if (!expanded) return
    const handle = (e: PointerEvent) => {
      const node = dockRef.current
      if (!node) return
      const target = e.target as Node | null
      if (target && !node.contains(target)) {
        setExpanded(false)
      }
    }
    document.addEventListener('pointerdown', handle, true)
    return () => document.removeEventListener('pointerdown', handle, true)
  }, [expanded])

  const { parlayState, userLeg, week } = data
  const isOpen = parlayState === 'open'

  // No leg on file and parlay has locked → user missed the deadline.
  if (!userLeg) {
    return (
      <button
        type="button"
        onClick={onTap}
        className={cn(
          'pointer-events-auto group relative mx-auto flex w-full max-w-3xl items-center gap-3 rounded-2xl border border-destructive/30 px-4 py-3 text-left',
          'bg-white/[0.06] backdrop-blur-3xl shadow-[0_8px_30px_rgba(0,0,0,0.4)]',
          'before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/30 before:to-transparent'
        )}
      >
        <UserX className="h-6 w-6 text-destructive shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold tracking-[0.25em] uppercase text-destructive">
            Missed Wk {week.week_number}
          </p>
          <p className="text-sm text-foreground/90 truncate">
            You didn&apos;t lock in before the deadline.
          </p>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
      </button>
    )
  }

  // ─── Tone driven by my leg's result (or pending) + parlay state ──────────
  const myResult: 'win' | 'loss' | 'push' | null =
    (userLeg.result as 'win' | 'loss' | 'push' | null) ?? null

  const tone =
    myResult === 'win'
      ? { border: 'border-neon-blue/40', text: 'text-neon-blue', Icon: Trophy, kicker: 'You hit' }
      : myResult === 'loss'
        ? { border: 'border-destructive/40', text: 'text-destructive', Icon: Skull, kicker: 'You missed' }
        : myResult === 'push'
          ? { border: 'border-white/20', text: 'text-foreground/70', Icon: Minus, kicker: 'You pushed' }
          : isOpen
            ? { border: 'border-neon-blue/40', text: 'text-neon-blue', Icon: Trophy, kicker: `Wk ${week.week_number} · Tap to edit` }
            : { border: 'border-white/15', text: 'text-muted-foreground', Icon: Clock, kicker: `Wk ${week.week_number} · Pending` }

  const ResultIcon = tone.Icon
  const oddsNum = parseInt(String(userLeg.odds ?? '').replace(/[^-\d]/g, ''), 10) || 0

  // Open + my leg → tap drills to the edit sub-page in the sheet (distinct
  // purpose). Otherwise → tap expands inline drawer with my-game detail
  // (top dock already carries the league-wide drill-down, so re-opening
  // the sheet here would be redundant).
  const handleTap = () => {
    if (isOpen) {
      onTap()
    } else {
      setExpanded((v) => !v)
    }
  }

  const trailingChevron = isOpen ? (
    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
  ) : (
    <ChevronUp
      className={cn(
        'h-4 w-4 text-muted-foreground transition-transform',
        expanded && 'rotate-180'
      )}
    />
  )

  return (
    <motion.div
      ref={dockRef}
      layout
      transition={{ type: 'spring', stiffness: 400, damping: 38 }}
      className={cn(
        'pointer-events-auto relative mx-auto w-full max-w-3xl overflow-hidden rounded-2xl border',
        'bg-white/[0.06] backdrop-blur-3xl shadow-[0_8px_30px_rgba(0,0,0,0.4)]',
        'before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/30 before:to-transparent',
        tone.border
      )}
    >
      {/* Expandable drawer — renders ABOVE the summary row (dock grows
          upward because it's anchored to the viewport bottom). */}
      <AnimatePresence initial={false}>
        {expanded && !isOpen && (
          <motion.div
            key="yourleg-drawer"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="overflow-hidden border-b border-white/10"
            onClick={(e) => {
              const target = e.target as HTMLElement | null
              if (target?.closest('button, a, input, textarea')) return
              setExpanded(false)
            }}
          >
            <YourGameDrawer
              userLeg={userLeg}
              weekDeadline={week.deadline}
              parlayState={parlayState}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <button
        type="button"
        onClick={handleTap}
        className={cn(
          'group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors',
          'hover:bg-white/[0.08]'
        )}
        aria-label={`Your week ${week.week_number} leg`}
        aria-expanded={!isOpen ? expanded : undefined}
      >
        <Avatar className="h-9 w-9 shrink-0 ring-2 ring-white/15">
          <AvatarImage
            src={currentUser.avatarUrl ?? undefined}
            alt={currentUser.fullName ?? currentUser.email}
          />
          <AvatarFallback className="bg-neon-blue text-primary-foreground text-[11px] font-bold">
            {getInitials(currentUser.fullName, currentUser.email)}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <p
            className={cn(
              'text-[10px] font-bold tracking-[0.25em] uppercase mb-0.5 flex items-center gap-1.5',
              tone.text
            )}
          >
            <ResultIcon className="h-3 w-3" />
            {tone.kicker}
          </p>
          <p className="text-sm font-medium text-foreground/90 break-words line-clamp-1">
            {userLeg.description || 'No description'}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span
            className={cn(
              'text-base font-bold tabular-nums leading-none',
              oddsNum > 0 ? 'text-foreground/90' : 'text-muted-foreground'
            )}
          >
            {fmtUserOdds(userLeg.odds)}
          </span>
          {trailingChevron}
        </div>
      </button>
    </motion.div>
  )
}

/**
 * Drawer body — placeholder while we wait on the live NFL feed. Surfaces
 * kickoff time so the panel has something to show even pre-API. Once we
 * wire the feed, this is where score / quarter / player stats go.
 */
function YourGameDrawer({
  userLeg,
  weekDeadline,
  parlayState,
}: {
  userLeg: NonNullable<WeekDetailData['userLeg']>
  weekDeadline: string
  parlayState: WeekDetailData['parlayState']
}) {
  const result = userLeg.result as 'win' | 'loss' | 'push' | null
  // Branch the visual on the lifecycle state.
  //   - `locked`            → pre-kickoff countdown
  //   - `graded` + no result → game is mid-flight, mock live scoreboard
  //   - result set / won/lost → final scoreboard
  let mode: 'pre' | 'live' | 'final'
  if (parlayState === 'locked') mode = 'pre'
  else if (result === null && parlayState === 'graded') mode = 'live'
  else mode = 'final'

  return (
    <div className="px-4 py-3 space-y-2.5">
      <p className="text-[10px] font-bold tracking-[0.25em] uppercase text-muted-foreground">
        Your game
      </p>
      <p className="text-sm text-foreground/90 break-words">
        {userLeg.description || 'No description'}
      </p>
      {mode === 'pre' && <KickoffCountdown deadline={weekDeadline} />}
      {mode === 'live' && <LiveGameMock leg={userLeg} />}
      {mode === 'final' && <FinalGameMock leg={userLeg} result={result} />}
      <p className="text-[9px] tracking-widest uppercase text-muted-foreground/40 italic text-center">
        Illustrative — real live tracking lights up when the live feed is wired.
      </p>
    </div>
  )
}

// ─── Visual mocks ──────────────────────────────────────────────────────────

const hashStr = (s: string) => {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h)
}

function KickoffCountdown({ deadline }: { deadline: string }) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  const target = new Date(deadline)
  const diffMs = target.getTime() - now.getTime()
  if (Number.isNaN(target.getTime()) || diffMs <= 0) {
    return (
      <div className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-3 text-center">
        <p className="text-[10px] font-bold tracking-[0.25em] uppercase text-neon-pink">
          Kickoff Imminent
        </p>
      </div>
    )
  }
  const totalSec = Math.floor(diffMs / 1000)
  const days = Math.floor(totalSec / 86400)
  const hours = Math.floor((totalSec % 86400) / 3600)
  const minutes = Math.floor((totalSec % 3600) / 60)
  const seconds = totalSec % 60
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-3 text-center">
      <p className="text-[9px] font-bold tracking-[0.3em] uppercase text-muted-foreground/80 mb-1.5">
        Kickoff in
      </p>
      <div className="flex items-baseline justify-center gap-2 tabular-nums">
        {days > 0 && (
          <CountdownUnit value={days} label="D" />
        )}
        <CountdownUnit value={hours} label="H" />
        <CountdownUnit value={minutes} label="M" />
        <CountdownUnit value={seconds} label="S" />
      </div>
    </div>
  )
}

function CountdownUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="font-display text-2xl font-bold leading-none text-neon-blue tabular-nums">
        {value.toString().padStart(2, '0')}
      </span>
      <span className="text-[8px] font-bold tracking-widest uppercase text-muted-foreground/70 mt-0.5">
        {label}
      </span>
    </div>
  )
}

function LiveGameMock({
  leg,
}: {
  leg: NonNullable<WeekDetailData['userLeg']>
}) {
  // Stable mock values keyed off leg id — same leg always renders the
  // same scoreboard, so dev/screenshot cycles are deterministic.
  const h = hashStr(leg.id)
  const awayScore = 7 + (h % 28)
  const homeScore = 7 + ((h >> 4) % 28)
  const quarterIdx = (h >> 8) % 4
  const quarter = (['Q1', 'Q2', 'Q3', 'Q4'] as const)[quarterIdx]!
  const clockMin = (h >> 12) % 15
  const clockSec = (h >> 16) % 60
  const gameProgressPct = Math.min(
    100,
    Math.round(((quarterIdx * 15 + (15 - clockMin)) / 60) * 100)
  )

  // Mock player-prop progress: 1+ target, 0 hits so far. Wire to real
  // targets parsed from `leg.description` later.
  const target = 1
  const current = 0
  const propPct = Math.round((current / target) * 100)

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3 space-y-3">
      {/* Score box */}
      <div className="flex items-center justify-around">
        <div className="flex flex-col items-center gap-0.5 min-w-0">
          <span className="text-[8px] font-bold tracking-[0.25em] uppercase text-muted-foreground">
            Away
          </span>
          <span className="font-display text-2xl font-bold leading-none tabular-nums text-foreground/90">
            {awayScore}
          </span>
        </div>
        <span className="text-[10px] tracking-widest uppercase text-muted-foreground/40">
          @
        </span>
        <div className="flex flex-col items-center gap-0.5 min-w-0">
          <span className="text-[8px] font-bold tracking-[0.25em] uppercase text-muted-foreground">
            Home
          </span>
          <span className="font-display text-2xl font-bold leading-none tabular-nums text-foreground/90">
            {homeScore}
          </span>
        </div>
      </div>

      {/* Quarter / clock + game progress bar */}
      <div className="flex items-center gap-2.5">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold tracking-wider uppercase text-red-400 shrink-0">
          <span className="relative inline-flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75 animate-ping" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
          </span>
          {quarter} · {clockMin}:{clockSec.toString().padStart(2, '0')}
        </span>
        <div className="flex-1 h-1 rounded-full bg-white/5 overflow-hidden">
          <div
            className="h-full bg-red-500/70 rounded-full"
            style={{ width: `${gameProgressPct}%` }}
          />
        </div>
      </div>

      {/* Player prop tracker */}
      <div>
        <div className="flex items-baseline justify-between gap-2 mb-1">
          <span className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground truncate">
            Your pick
          </span>
          <span className="text-xs font-bold tabular-nums shrink-0">
            <span className="text-foreground/90">{current}</span>
            <span className="text-muted-foreground"> / {target}+</span>
          </span>
        </div>
        <div className="h-2 rounded-full bg-white/5 overflow-hidden ring-1 ring-neon-blue/20">
          <div
            className="h-full bg-neon-blue rounded-full transition-all"
            style={{ width: `${Math.max(propPct, 4)}%` }}
          />
        </div>
      </div>
    </div>
  )
}

function FinalGameMock({
  leg,
  result,
}: {
  leg: NonNullable<WeekDetailData['userLeg']>
  result: 'win' | 'loss' | 'push' | null
}) {
  const h = hashStr(leg.id)
  const awayScore = 10 + (h % 31)
  const homeScore = 10 + ((h >> 4) % 31)
  const resultTone =
    result === 'win'
      ? { ring: 'ring-neon-blue/30', label: 'Hit', text: 'text-neon-blue' }
      : result === 'loss'
        ? { ring: 'ring-destructive/30', label: 'Missed', text: 'text-destructive' }
        : result === 'push'
          ? { ring: 'ring-white/25', label: 'Push', text: 'text-foreground/70' }
          : { ring: 'ring-white/10', label: 'Final', text: 'text-muted-foreground' }
  return (
    <div
      className={cn(
        'rounded-lg border bg-white/[0.02] p-3 space-y-2 ring-1',
        resultTone.ring,
        'border-white/10'
      )}
    >
      <div className="flex items-center justify-around">
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-[8px] font-bold tracking-[0.25em] uppercase text-muted-foreground">
            Away
          </span>
          <span className="font-display text-2xl font-bold leading-none tabular-nums text-foreground/90">
            {awayScore}
          </span>
        </div>
        <span
          className={cn(
            'text-[9px] font-bold tracking-widest uppercase',
            resultTone.text
          )}
        >
          Final
        </span>
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-[8px] font-bold tracking-[0.25em] uppercase text-muted-foreground">
            Home
          </span>
          <span className="font-display text-2xl font-bold leading-none tabular-nums text-foreground/90">
            {homeScore}
          </span>
        </div>
      </div>
      <p
        className={cn(
          'text-center text-[10px] font-bold tracking-[0.25em] uppercase',
          resultTone.text
        )}
      >
        Your leg · {resultTone.label}
      </p>
    </div>
  )
}
