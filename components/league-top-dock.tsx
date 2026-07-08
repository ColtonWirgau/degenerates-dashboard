'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { LiveLegsRow } from '@/components/live-legs-row'
import {
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Clock,
  Crown,
  Flame,
  Minus,
  Skull,
  Snowflake,
  Sparkles,
  Trophy,
  UserX,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WeekDetailData } from '@/components/week-detail-sheet'
import type { SeasonState } from '@/lib/data/types'

interface LeagueTopDockProps {
  /** Active week. Null in offseason / preseason where there is no week. */
  data: WeekDetailData | null
  seasonState: SeasonState
  membersCount: number
  currentUserId: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const getInitials = (name: string | null, email: string) => {
  if (name) {
    const parts = name.split(' ')
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    return name.slice(0, 2).toUpperCase()
  }
  return email.slice(0, 2).toUpperCase()
}

const formatOdds = (n: number) => (n > 0 ? `+${n}` : `${n}`)

/** "47m" / "5h 12m" / "Sun 1:00 PM" — `null` when target is in the past. */
function formatTimeUntil(iso: string | null, now: Date): string | null {
  if (!iso) return null
  const target = new Date(iso)
  if (Number.isNaN(target.getTime())) return null
  const diffMs = target.getTime() - now.getTime()
  if (diffMs <= 0) return null
  const totalMins = Math.round(diffMs / 60_000)
  if (totalMins < 60) return `${Math.max(1, totalMins)}m`
  const hours = totalMins / 60
  if (hours < 24) {
    const h = Math.floor(hours)
    const m = totalMins % 60
    return m > 0 ? `${h}h ${m}m` : `${h}h`
  }
  return target.toLocaleString('en-US', {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/** Tick a `Date` every minute so deadline/kickoff countdowns advance. */
function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

// ─── Eyebrow ────────────────────────────────────────────────────────────────

interface EyebrowSpec {
  Icon: LucideIcon
  label: string
  tone: string
}

function eyebrowFor(seasonState: SeasonState, weekNumber?: number): EyebrowSpec {
  switch (seasonState.kind) {
    case 'super-bowl':
      return { Icon: Crown, label: 'Championship', tone: 'text-neon-blue' }
    case 'playoffs':
      return { Icon: Flame, label: seasonState.roundLabel, tone: 'text-neon-blue' }
    case 'preseason':
      return { Icon: Sparkles, label: 'Preseason', tone: 'text-neon-pink' }
    case 'offseason':
      return { Icon: Snowflake, label: 'Offseason', tone: 'text-neon-blue' }
    case 'regular-season':
      return {
        Icon: CalendarDays,
        label: weekNumber != null ? `Week ${weekNumber}` : 'Regular Season',
        tone: 'text-neon-blue',
      }
  }
}

function Eyebrow({ spec }: { spec: EyebrowSpec }) {
  const { Icon, label, tone } = spec
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-[10px] font-bold tracking-[0.25em] uppercase shrink-0',
        tone
      )}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  )
}

// ─── Public ─────────────────────────────────────────────────────────────────

/**
 * Always-visible top dock — the league/context surface. Pairs with the
 * bottom dock (`<CurrentWeekDock>`) which owns the user's personal action.
 *
 * Renders distinct copy per state:
 *   - `open`: "X / N in · Locks in 5h 12m" + expandable lay-so-far
 *   - `locked`: "Locked · Kickoff in 2h" + expandable full lay
 *   - `graded`(live): "Live · 6 of 12 so far · 6W 0L 6 pending" + inline LiveLegsRow
 *   - `won`/`lost`: final tally + expandable graded lay
 *   - offseason / preseason: stateful headline (no expand)
 *
 * Absorbs the old `<SeasonStateBanner>` — the eyebrow icon + tone carry the
 * special-week chrome (Crown for Super Bowl, Flame for playoffs, etc).
 */
export function LeagueTopDock({
  data,
  seasonState,
  membersCount,
  currentUserId,
}: LeagueTopDockProps) {
  const now = useNow()

  if (!data) {
    return <NoWeekDock seasonState={seasonState} />
  }

  return (
    <ActiveWeekDock
      data={data}
      seasonState={seasonState}
      membersCount={membersCount}
      currentUserId={currentUserId}
      now={now}
    />
  )
}

// ─── Active-week dock ───────────────────────────────────────────────────────

function ActiveWeekDock({
  data,
  seasonState,
  membersCount,
  currentUserId,
  now,
}: LeagueTopDockProps & { data: WeekDetailData; now: Date }) {
  const [expanded, setExpanded] = useState(false)
  const dockRef = useRef<HTMLDivElement>(null)
  // Click-outside-to-collapse — modal-style dismiss. Uses pointerdown
  // in capture phase so the handler runs *before* any descendant or
  // framer-motion handler can swallow the event with stopPropagation.
  // Listener only attaches while expanded, so the open-click itself
  // (which queues the state change that wires this up) is naturally
  // immune.
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

  const { parlayState, weekStats, week, totalOdds, legs, submittedUsers, notSubmittedUsers } = data
  const isLive = parlayState === 'graded' && weekStats.pending > 0
  const eyebrow = eyebrowFor(seasonState, week.week_number)

  // What goes in the expanded panel:
  //   - `open`         → other members' submitted legs + slackers
  //   - everything else → full lay (you can see your own leg's result too)
  const showAllLegs = parlayState !== 'open'
  const expandedLegs = showAllLegs ? legs : legs.filter((l) => l.userId !== currentUserId)
  const slackers = parlayState === 'open' || parlayState === 'locked' ? notSubmittedUsers : []
  const hasLay = expandedLegs.length > 0 || slackers.length > 0

  return (
    <div ref={dockRef} className="sticky top-[68px] z-30 -mx-1 mb-6">
      <div className="relative mx-auto w-full max-w-3xl">
        {/* Compact card */}
        <div
          className={cn(
            'relative overflow-hidden border border-white/15 rounded-t-2xl',
            !expanded && 'rounded-b-2xl',
            'bg-white/[0.06] backdrop-blur-3xl shadow-[0_8px_30px_rgba(0,0,0,0.4)]',
            'before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/30 before:to-transparent'
          )}
        >
          <button
            type="button"
            onClick={hasLay ? () => setExpanded((v) => !v) : undefined}
            disabled={!hasLay}
            className={cn(
              'group flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors',
              hasLay && !expanded && 'hover:bg-white/[0.04]',
              !hasLay && 'cursor-default'
            )}
            aria-expanded={hasLay ? expanded : undefined}
          >
            <Eyebrow spec={eyebrow} />
            <Headline
              parlayState={parlayState}
              submitted={submittedUsers.length}
              membersCount={membersCount}
              wins={weekStats.wins}
              losses={weekStats.losses}
              pending={weekStats.pending}
              deadline={week.deadline}
              totalOdds={totalOdds}
              now={now}
            />
            {hasLay &&
              (expanded ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
              ))}
          </button>

          {/* Inline LiveLegsRow — only in live state, desktop only (mobile
              dock is too narrow for 12 dots + avatars). */}
          {isLive && legs.length > 0 && (
            <div className="hidden md:block w-full border-t border-white/10 px-4 py-3">
              <LiveLegsRow legs={legs} />
            </div>
          )}
        </div>

        {/* Floating expanded panel — overlays content below. Because the
            panel visually covers the page area beneath the sticky compact
            card, the document outside-click handler can't detect taps on
            "what's underneath" — those taps hit the panel surface. So
            the panel also closes on tap, unless the user hit an
            interactive child. */}
        <AnimatePresence initial={false}>
          {expanded && hasLay && (
            <motion.div
              key="topdock-body"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className={cn(
                'absolute top-full inset-x-0 overflow-hidden',
                'rounded-b-2xl border border-t-0 border-white/15',
                'bg-white/[0.06] backdrop-blur-3xl shadow-[0_8px_30px_rgba(0,0,0,0.4)]'
              )}
              onClick={(e) => {
                const target = e.target as HTMLElement | null
                if (target?.closest('button, a, input, textarea')) return
                setExpanded(false)
              }}
            >
              <ExpandedPanel legs={expandedLegs} slackers={slackers} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

// ─── Headline (one per parlay state) ────────────────────────────────────────

function Headline({
  parlayState,
  submitted,
  membersCount,
  wins,
  losses,
  pending,
  deadline,
  totalOdds,
  now,
}: {
  parlayState: WeekDetailData['parlayState']
  submitted: number
  membersCount: number
  wins: number
  losses: number
  pending: number
  deadline: string
  totalOdds: string | null
  now: Date
}) {
  const timeLeft = formatTimeUntil(deadline, now)

  if (parlayState === 'open') {
    return (
      <span className="text-[11px] tabular-nums text-muted-foreground truncate min-w-0 flex-1">
        <span className="text-foreground/90 font-semibold">
          {submitted}/{membersCount}
        </span>{' '}
        in
        {timeLeft && (
          <>
            {' · '}
            <span className="text-foreground/70">Locks in {timeLeft}</span>
          </>
        )}
      </span>
    )
  }

  if (parlayState === 'locked') {
    return (
      <span className="text-[11px] tabular-nums text-muted-foreground truncate min-w-0 flex-1">
        <span className="text-neon-blue font-bold uppercase tracking-wide text-[10px]">Locked</span>
        {timeLeft ? (
          <>
            {' · '}
            <span className="text-foreground/70">Kickoff in {timeLeft}</span>
          </>
        ) : (
          <>
            {' · '}
            <span className="text-foreground/70">Awaiting kickoff</span>
          </>
        )}
      </span>
    )
  }

  if (parlayState === 'graded') {
    const live = pending > 0
    if (!live) {
      return (
        <span className="text-[11px] tabular-nums text-muted-foreground truncate min-w-0 flex-1">
          Grading…
        </span>
      )
    }
    // The LiveLegsRow dots below carry the tally — text just marks state.
    return (
      <span className="text-[11px] truncate min-w-0 flex-1 inline-flex items-center gap-1.5">
        <span className="relative inline-flex h-2 w-2 shrink-0">
          <span className="absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75 animate-ping" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
        </span>
        <span className="text-red-400 uppercase tracking-wide font-bold text-[10px]">Live</span>
      </span>
    )
  }

  if (parlayState === 'won') {
    return (
      <span className="text-[11px] tabular-nums truncate min-w-0 flex-1 inline-flex items-center gap-2">
        <span className="text-neon-blue font-bold uppercase tracking-wide text-[10px]">Won</span>
        {totalOdds && <span className="text-neon-blue font-bold tabular-nums">{totalOdds}</span>}
      </span>
    )
  }

  if (parlayState === 'lost') {
    return (
      <span className="text-[11px] tabular-nums truncate min-w-0 flex-1 inline-flex items-center gap-2">
        <span className="text-destructive font-bold uppercase tracking-wide text-[10px]">Lost</span>
        <span className="text-foreground/70">
          {wins} hit · {losses} missed
        </span>
      </span>
    )
  }

  return null
}

// ─── Expanded panel ─────────────────────────────────────────────────────────

interface SlackerUser {
  userId: string
  fullName: string | null
  email: string
  avatarUrl: string | null
}

function ExpandedPanel({
  legs,
  slackers,
}: {
  legs: WeekDetailData['legs']
  slackers: SlackerUser[]
}) {
  return (
    <div className="max-h-[40dvh] overflow-y-auto scrollbar-hide">
      {legs.length > 0 && (
        <ul className="px-3 py-2 space-y-1.5">
          {legs.map((leg) => (
            <LegRow key={leg.id} leg={leg} />
          ))}
        </ul>
      )}

      {slackers.length > 0 && (
        <div className="border-t border-white/10 px-3 py-2.5">
          <p className="flex items-center gap-1.5 text-[10px] font-bold tracking-[0.25em] uppercase text-muted-foreground mb-1.5">
            <UserX className="h-3 w-3" />
            Slackers · {slackers.length}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {slackers.map((u) => (
              <div
                key={u.userId}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.02] px-2 py-0.5"
              >
                <Avatar className="h-4 w-4">
                  <AvatarImage src={u.avatarUrl ?? undefined} alt={u.fullName ?? u.email} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-[8px] font-bold">
                    {getInitials(u.fullName, u.email)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-[10px] text-muted-foreground truncate max-w-[6rem]">
                  {u.fullName?.split(' ')[0] ?? u.email.split('@')[0]}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function LegRow({ leg }: { leg: WeekDetailData['legs'][number] }) {
  // Result badge sits in the bottom-right corner of the avatar — same
  // pattern as `<MemberLegRow>` in the week detail sheet so the UI reads
  // consistently across surfaces. Pending uses Clock + yellow.
  const tone =
    leg.result === 'win'
      ? { border: 'border-neon-blue/30', badgeBg: 'bg-neon-blue', Icon: Trophy }
      : leg.result === 'loss'
        ? { border: 'border-destructive/30', badgeBg: 'bg-destructive', Icon: Skull }
        : leg.result === 'push'
          ? { border: 'border-white/20', badgeBg: 'bg-gray-300', Icon: Minus }
          : { border: 'border-white/15', badgeBg: 'bg-white/50', Icon: Clock }
  const ResultIcon = tone.Icon
  const displayName = leg.fullName ?? leg.email.split('@')[0]
  return (
    <li
      className={cn(
        'flex items-center gap-2.5 rounded-lg border bg-white/[0.02] px-2.5 py-2',
        tone.border
      )}
    >
      <div className="relative shrink-0">
        <Avatar className="h-9 w-9 ring-1 ring-white/10">
          <AvatarImage src={leg.avatarUrl ?? undefined} alt={displayName} />
          <AvatarFallback className="bg-primary text-primary-foreground text-[10px] font-bold">
            {getInitials(leg.fullName, leg.email)}
          </AvatarFallback>
        </Avatar>
        <span
          aria-hidden
          className={cn(
            'absolute -bottom-1 -right-1 inline-flex h-5 w-5 items-center justify-center rounded-full ring-2 ring-black/60',
            tone.badgeBg
          )}
        >
          <ResultIcon className="h-3 w-3 text-black" strokeWidth={2.5} />
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground truncate">
          {displayName}
        </p>
        <p className="text-sm font-medium text-foreground/90 break-words line-clamp-1">
          {leg.description || 'No description'}
        </p>
      </div>
      <span
        className={cn(
          'shrink-0 text-sm font-bold tabular-nums leading-none',
          leg.odds > 0 ? 'text-foreground/90' : 'text-muted-foreground'
        )}
      >
        {formatOdds(leg.odds)}
      </span>
    </li>
  )
}

// ─── No-week dock (offseason / preseason) ───────────────────────────────────

function NoWeekDock({ seasonState }: { seasonState: SeasonState }) {
  const eyebrow = eyebrowFor(seasonState)
  let headline: React.ReactNode = null

  if (seasonState.kind === 'offseason') {
    headline = (
      <span className="text-[11px] text-muted-foreground truncate min-w-0 flex-1">
        {seasonState.lastSeason && (
          <>
            <span className="text-foreground/90 font-semibold">{seasonState.lastSeason}</span> wrapped
            {' · '}
          </>
        )}
        {seasonState.expectedKickoff ? (
          <span className="text-foreground/70">
            Next kickoff{' '}
            {new Date(seasonState.expectedKickoff).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            })}
          </span>
        ) : (
          <span className="text-foreground/70">Schedule TBD</span>
        )}
      </span>
    )
  } else if (seasonState.kind === 'preseason') {
    const days = seasonState.daysUntilKickoff
    const dateLabel = new Date(seasonState.nextKickoff).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
    headline = (
      <span className="text-[11px] text-muted-foreground truncate min-w-0 flex-1">
        <span className="text-foreground/90 font-semibold">
          Kickoff in {days}
          {days === 1 ? ' day' : ' days'}
        </span>
        {' · '}
        <span className="text-foreground/70">{dateLabel}</span>
      </span>
    )
  }

  return (
    <div className="sticky top-[68px] z-30 -mx-1 mb-6">
      <div className="relative mx-auto w-full max-w-3xl">
        <div
          className={cn(
            'relative overflow-hidden rounded-2xl border border-white/15',
            'bg-white/[0.06] backdrop-blur-3xl shadow-[0_8px_30px_rgba(0,0,0,0.4)]',
            'before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/30 before:to-transparent'
          )}
        >
          <div className="flex items-center gap-3 px-4 py-2.5">
            <Eyebrow spec={eyebrow} />
            {headline}
          </div>
        </div>
      </div>
    </div>
  )
}
