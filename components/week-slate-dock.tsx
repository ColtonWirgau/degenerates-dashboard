'use client'

import { useEffect, useState } from 'react'
import { LayoutGroup } from 'framer-motion'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { SectionDock, useSectionDock } from '@/components/ui/section-dock'
import { MiniLiveLegsRow, MorphingLiveLegsRow } from '@/components/live-legs-row'
import { WeekSlate, SlateCountdown } from '@/components/week-slate'
import {
  Calendar,
  Clock,
  Minus,
  Skull,
  Trophy,
  UserX,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WeekDetailData } from '@/components/week-detail-sheet'

interface WeekSlateDockProps {
  data: WeekDetailData
  currentUserId: string
  membersCount: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const getInitials = (name: string | null, email: string) => {
  if (name) {
    const parts = name.split(' ').filter(Boolean)
    if (parts.length >= 2) return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase()
    return name.slice(0, 2).toUpperCase()
  }
  return email.slice(0, 2).toUpperCase()
}

const formatOdds = (n: number) => (n > 0 ? `+${n}` : `${n}`)

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

function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

// ─── WeekSlateDock — section heading + dock-style expanded panel ───────────

/**
 * `<WeekSlate>` wrapped in a `<SectionDock>`. The dock's heading is the
 * section's own heading ("WEEK 8 SLATE"), with state-aware status pills in
 * the trailing slot (countdown / live pulse / final tally) and an expandable
 * panel that surfaces the league's submitted legs + slackers — same payload
 * the old standalone top dock owned.
 *
 * The dock collapses to a pure section header when no parlay data is
 * available (e.g. preseason preview).
 */
export function WeekSlateDock({
  data,
  currentUserId,
  membersCount,
}: WeekSlateDockProps) {
  const now = useNow()
  const { parlayState, weekStats, week, totalOdds, legs, submittedUsers, notSubmittedUsers } = data
  const isLive = parlayState === 'graded' && weekStats.pending > 0
  const postLock =
    parlayState === 'locked' ||
    parlayState === 'graded' ||
    parlayState === 'won' ||
    parlayState === 'lost'

  // Expanded panel contents are state-aware:
  //   - open       → other members' legs + slackers
  //   - everything → full lay (you see your own outcome too)
  const showAllLegs = parlayState !== 'open'
  const expandedLegs = showAllLegs ? legs : legs.filter((l) => l.userId !== currentUserId)
  const slackers = parlayState === 'open' || parlayState === 'locked' ? notSubmittedUsers : []
  const hasLay = expandedLegs.length > 0 || slackers.length > 0

  // `<LayoutGroup>` lets the mini chart's dots morph into the full chart's
  // dots when expanded — same `layoutId="leg-{id}"` on both, Framer animates
  // between the two positions.
  return (
    <LayoutGroup>
      <SectionDock
        kicker="Slate"
        title={`Week ${week.week_number}`}
        icon={Calendar}
        accent="blue"
        trailing={
          <TrailingSlot
            parlayState={parlayState}
            submitted={submittedUsers.length}
            membersCount={membersCount}
            wins={weekStats.wins}
            losses={weekStats.losses}
            pending={weekStats.pending}
            deadline={week.deadline}
            totalOdds={totalOdds}
            firstKickoff={week.deadline || null}
            isLive={postLock && parlayState !== 'won' && parlayState !== 'lost'}
            now={now}
            legs={legs}
            showMiniLive={isLive}
          />
        }
        expandedContent={
          hasLay ? (
            <ExpandedPanel
              legs={expandedLegs}
              slackers={slackers}
              isLive={isLive}
              allLegs={legs}
            />
          ) : undefined
        }
      >
        <WeekSlate
          weekNumber={week.week_number}
          firstKickoff={week.deadline || null}
          legs={legs}
          currentUserId={currentUserId}
          parlayState={parlayState}
          hideHeader
        />
      </SectionDock>
    </LayoutGroup>
  )
}

// ─── Trailing slot ──────────────────────────────────────────────────────────

function TrailingSlot({
  parlayState,
  submitted,
  membersCount,
  wins,
  losses,
  pending,
  deadline,
  totalOdds,
  firstKickoff,
  isLive,
  now,
  legs,
  showMiniLive,
}: {
  parlayState: WeekDetailData['parlayState']
  submitted: number
  membersCount: number
  wins: number
  losses: number
  pending: number
  deadline: string
  totalOdds: string | null
  firstKickoff: string | null
  isLive: boolean
  now: Date
  legs: WeekDetailData['legs']
  showMiniLive: boolean
}) {
  if (parlayState === 'open') {
    const timeLeft = formatTimeUntil(deadline, now)
    return (
      <div className="hidden sm:flex items-center gap-2">
        <span className="rounded-full bg-white/[0.04] ring-1 ring-white/10 px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase text-foreground/80 tabular-nums">
          {submitted}/{membersCount} in
        </span>
        <SlateCountdown firstKickoff={firstKickoff} />
        {timeLeft === null && (
          // SlateCountdown handles the "live" rendering once kickoff passes,
          // so we don't double-render. Hidden block kept for symmetry.
          <></>
        )}
      </div>
    )
  }

  if (parlayState === 'locked') {
    return (
      <div className="hidden sm:flex items-center gap-2">
        <span className="rounded-full bg-neon-blue/10 ring-1 ring-neon-blue/30 px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase text-neon-blue">
          Locked
        </span>
        <SlateCountdown firstKickoff={firstKickoff} />
      </div>
    )
  }

  if (parlayState === 'graded' && pending > 0) {
    return <LiveTrailing wins={wins} losses={losses} pending={pending} legs={legs} showMiniLive={showMiniLive} />
  }

  if (parlayState === 'graded') {
    return (
      <span className="rounded-full bg-white/[0.04] ring-1 ring-white/10 px-2.5 py-1 text-[10px] font-bold tracking-[0.25em] uppercase text-muted-foreground">
        Grading…
      </span>
    )
  }

  if (parlayState === 'won') {
    return (
      <div className="inline-flex items-center gap-2 rounded-full bg-neon-blue/10 ring-1 ring-neon-blue/40 px-2.5 py-1">
        <Trophy className="h-3 w-3 text-neon-blue" />
        <span className="text-[10px] font-bold tracking-[0.25em] uppercase text-neon-blue">
          Won
        </span>
        {totalOdds && (
          <span className="text-[11px] font-bold tabular-nums text-neon-blue">{totalOdds}</span>
        )}
      </div>
    )
  }

  if (parlayState === 'lost') {
    return (
      <div className="inline-flex items-center gap-2 rounded-full bg-destructive/10 ring-1 ring-destructive/40 px-2.5 py-1">
        <Skull className="h-3 w-3 text-destructive" />
        <span className="text-[10px] font-bold tracking-[0.25em] uppercase text-destructive">
          Lost
        </span>
        <span className="text-[10px] text-foreground/70 tabular-nums">
          {wins} hit · {losses} missed
        </span>
      </div>
    )
  }

  return null
}

// Mini-chart trailing for the live state. Hides the mini chart while the
// dock is expanded so the only mounted dots with `layoutId="leg-{id}"` are
// the ones in the full chart — keeps Framer's morph clean (no two-source
// conflict, no jitter from re-measuring).
function LiveTrailing({
  wins,
  losses,
  pending,
  legs,
  showMiniLive,
}: {
  wins: number
  losses: number
  pending: number
  legs: WeekDetailData['legs']
  showMiniLive: boolean
}) {
  const { expanded } = useSectionDock()
  // Chart on the LEFT, LIVE pill on the RIGHT (anchored next to the
  // chevron). When the dock expands and the mini chart unmounts, the
  // LIVE pill doesn't shift — less visual disruption during the morph.
  return (
    <div className="flex items-center gap-2">
      {showMiniLive && !expanded && (
        <div className="hidden sm:block">
          <MiniLiveLegsRow legs={legs} width={Math.min(160, legs.length * 14)} />
        </div>
      )}
      <div className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.04] ring-1 ring-red-500/30 px-2 py-1">
        <span className="relative inline-flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75 animate-ping" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
        </span>
        <span className="text-[10px] font-bold tracking-[0.25em] uppercase text-red-400">
          Live
        </span>
      </div>
    </div>
  )
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
  isLive,
  allLegs,
}: {
  legs: WeekDetailData['legs']
  slackers: SlackerUser[]
  isLive: boolean
  allLegs: WeekDetailData['legs']
}) {
  // No outer overflow container here — `<SectionDock>` provides its own
  // scrollable wrapper around expandedContent and drives the
  // "Scroll for more" indicator off that container's scroll metrics.
  return (
    <div>
      {/* Full LiveLegsRow at the top of the panel. Dots share `layoutId`
          with the mini chart in the trailing slot, so they animate into
          place when the dock opens. Constrained max-width so the chart
          stays scannable on wide screens instead of stretching edge to
          edge with sparse dots. */}
      {isLive && allLegs.length > 0 && (
        <div className="border-b border-white/10 px-4 py-5">
          <div className="mx-auto max-w-xl">
            <MorphingLiveLegsRow legs={allLegs} />
          </div>
        </div>
      )}

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
