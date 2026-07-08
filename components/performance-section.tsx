'use client'

import { useMemo, useState } from 'react'
import { LayoutGroup, motion } from 'framer-motion'
import { BarChart3, Flame, Snowflake, Sparkles, Trophy } from 'lucide-react'
import { cn } from '@/lib/utils'
import { RecentLegs } from '@/components/recent-legs'
import {
  MiniConnectedDots,
  MorphingConnectedDots,
} from '@/components/connected-dots'
import { LeaderboardSheet, type LeaderboardEntry } from '@/components/leaderboard-sheet'
import { SectionDock, useSectionDock } from '@/components/ui/section-dock'
import { WeekDetailSheet, type WeekDetailData } from '@/components/week-detail-sheet'

interface RecentLeg {
  id: string
  description: string
  odds: string
  result: 'win' | 'loss' | 'push' | null
  week_number: number
  week_id: string
}

interface PerformanceSectionProps {
  leagueId: string
  currentUserId: string
  recentLegs: RecentLeg[]
  userResultSequence: Array<{
    weekNumber: number
    weekId: string
    result: 'win' | 'loss' | 'push' | null
    description?: string
  }>
  stats: { wins: number; losses: number; pushes: number; winRate: number }
  leaderboard: LeaderboardEntry[]
  allWeeksData: WeekDetailData[]
  membersCount: number
  availableSeasons: string[]
  defaultSeason: string
}

/**
 * Performance section as a SectionDock. Collapsed heading carries the
 * Rank + Win Rate stats and a mini sparkline. The section body underneath
 * is featured cards (current streak, last week, highlight bet) — *not* a
 * truncated bet list, since the full bet history lives in the expanded
 * panel one tap away. Expanded panel: animated chart + W/L count legend
 * + scrollable bet history.
 */
export function PerformanceSection({
  leagueId,
  currentUserId,
  recentLegs,
  userResultSequence,
  stats,
  leaderboard,
  allWeeksData,
  membersCount,
  availableSeasons,
  defaultSeason,
}: PerformanceSectionProps) {
  const [leaderboardOpen, setLeaderboardOpen] = useState(false)
  const [focusOnSelf, setFocusOnSelf] = useState(false)
  const [activeWeek, setActiveWeek] = useState<WeekDetailData | null>(null)

  const openListing = () => {
    setFocusOnSelf(false)
    setLeaderboardOpen(true)
  }
  const openOnSelf = () => {
    setFocusOnSelf(true)
    setLeaderboardOpen(true)
  }
  const openWeek = (weekId: string) => {
    const data = allWeeksData.find((w) => w.week.id === weekId)
    if (data) setActiveWeek(data)
  }

  // ─── Derive rank + headline ────────────────────────────────────────────
  let rank = -1
  for (let i = 0; i < leaderboard.length; i++) {
    if (leaderboard[i].userId === currentUserId) {
      rank = i + 1
      for (let j = i - 1; j >= 0; j--) {
        if (
          leaderboard[j].winRate === leaderboard[i].winRate &&
          leaderboard[j].wins === leaderboard[i].wins
        ) {
          rank = j + 1
        } else break
      }
      break
    }
  }
  const total = leaderboard.length
  const rankColor =
    rank === 1
      ? 'text-neon-blue'
      : rank === 2
        ? 'text-gray-300'
        : rank === 3
          ? 'text-gray-400'
          : rank > 0 && rank > total - 2
            ? 'text-destructive'
            : 'text-foreground'

  // Chronological order for the dots chart (oldest → newest).
  const dotsResults = [...userResultSequence].reverse()
  const hasHistory = dotsResults.length > 0

  // ─── Derive feature cards ──────────────────────────────────────────────
  // userResultSequence is newest-first, finished legs only (excludes the
  // in-flight current week leg).
  const streak = useMemo(() => deriveStreak(userResultSequence), [userResultSequence])
  const lastLeg = recentLegs[0] ?? null
  const allUserBets = useMemo(
    () => deriveAllUserBets(allWeeksData, currentUserId),
    [allWeeksData, currentUserId]
  )
  const bestBet = useMemo(() => deriveBestBet(allUserBets), [allUserBets])

  // Keep <LayoutGroup> scoped tightly to the dock. If sheets are wrapped,
  // mounting `<WeekDetailSheet>` triggers Framer's layout reconciliation
  // across the whole group and the mini-chart dots animate back to their
  // "new" position even though their actual layout hasn't changed.
  return (
    <>
      <LayoutGroup>
        <SectionDock
          kicker="Your Season"
          title="Performance"
          icon={BarChart3}
          accent="blue"
          trailing={
            <TrailingSlot
              rank={rank}
              total={total}
              rankColor={rankColor}
              winRate={stats.winRate}
              results={dotsResults}
              onOpenRank={openListing}
              onOpenSelf={openOnSelf}
            />
          }
          expandedContent={
            hasHistory ? (
              <ExpandedPanel
                results={dotsResults}
                wins={stats.wins}
                losses={stats.losses}
                pushes={stats.pushes}
                allUserBets={allUserBets}
                onOpenWeek={openWeek}
              />
            ) : undefined
          }
        >
          <FeatureCards
            streak={streak}
            lastLeg={lastLeg}
            bestBet={bestBet}
            onOpenWeek={openWeek}
          />
        </SectionDock>
      </LayoutGroup>

      <LeaderboardSheet
        open={leaderboardOpen}
        onClose={() => setLeaderboardOpen(false)}
        leagueId={leagueId}
        leaderboard={leaderboard}
        currentUserId={currentUserId}
        focusUserId={focusOnSelf ? currentUserId : null}
        onOpenWeek={openWeek}
        availableSeasons={availableSeasons}
        defaultSeason={defaultSeason}
      />

      {activeWeek && (
        <WeekDetailSheet
          open={activeWeek !== null}
          onClose={() => setActiveWeek(null)}
          data={activeWeek}
          leagueId={leagueId}
          membersCount={membersCount}
        />
      )}
    </>
  )
}

// ─── Trailing slot ──────────────────────────────────────────────────────────

function TrailingSlot({
  rank,
  total,
  rankColor,
  winRate,
  results,
  onOpenRank,
  onOpenSelf,
}: {
  rank: number
  total: number
  rankColor: string
  winRate: number
  results: Array<{
    weekNumber: number
    weekId: string
    result: 'win' | 'loss' | 'push' | null
    description?: string
  }>
  onOpenRank: () => void
  onOpenSelf: () => void
}) {
  // Hide the mini chart while expanded so only one set of `layoutId`
  // dots is mounted at a time — keeps the morph clean (no two-source
  // conflict, no jitter from Framer re-measuring).
  const { expanded } = useSectionDock()
  return (
    <div className="flex items-center gap-3 sm:gap-4">
      {results.length > 0 && !expanded && (
        <div className="hidden md:block">
          <MiniConnectedDots
            results={results}
            width={Math.min(140, results.length * 14)}
          />
        </div>
      )}

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onOpenRank()
        }}
        className="group flex flex-col items-end"
        aria-label="Open standings"
      >
        <span className="text-right text-[9px] font-bold tracking-[0.3em] uppercase leading-none text-muted-foreground/80 group-hover:text-neon-blue transition-colors">
          Rank
        </span>
        <div className="mt-1 flex items-baseline gap-1">
          <span
            className={cn(
              'font-display text-base sm:text-lg font-bold tracking-wide leading-none tabular-nums',
              rankColor
            )}
          >
            {rank > 0 ? rank : '—'}
          </span>
          <span className="text-[10px] text-muted-foreground">/ {total}</span>
        </div>
      </button>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onOpenSelf()
        }}
        className="group flex flex-col items-end"
        aria-label="Open your bet history"
      >
        <span className="text-right text-[9px] font-bold tracking-[0.3em] uppercase leading-none text-muted-foreground/80 group-hover:text-neon-blue transition-colors">
          Win Rate
        </span>
        <span className="mt-1 font-display text-base sm:text-lg font-bold tracking-wide leading-none tabular-nums text-foreground">
          {winRate.toFixed(1)}
          <span className="text-xs text-muted-foreground">%</span>
        </span>
      </button>
    </div>
  )
}

// ─── Feature cards (section body) ───────────────────────────────────────────

interface StreakSpec {
  count: number
  kind: 'W' | 'L' | null
}

/**
 * Three character-driven cards sit below the dock heading. Each one is
 * deliberately built to its own personality — the section was reading
 * "template" when all three shared identical chrome. Now:
 *   - Streak: mood card. Tone-tinted background + animated flame/snow.
 *   - Last Week: receipt/ticket. Dashed divider, monospace odds, stamp.
 *   - Best Hit: trophy. Gold gradient + watermark + glowing display.
 * They still share size and rhythm so they read as a coherent row.
 */
function FeatureCards({
  streak,
  lastLeg,
  bestBet,
  onOpenWeek,
}: {
  streak: StreakSpec
  lastLeg: RecentLeg | null
  bestBet: RecentLeg | null
  onOpenWeek: (weekId: string) => void
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
      <StreakCard streak={streak} />
      <LastLegCard leg={lastLeg} onOpenWeek={onOpenWeek} />
      <BestBetCard leg={bestBet} onOpenWeek={onOpenWeek} />
    </div>
  )
}

// ─── Streak card — mood / heat ─────────────────────────────────────────────

function streakHeader(spec: StreakSpec): string {
  if (spec.kind === 'W') {
    if (spec.count >= 5) return 'Untouchable'
    if (spec.count >= 3) return 'On a Heater'
    if (spec.count >= 2) return 'Heating Up'
    return 'Riding a Win'
  }
  if (spec.kind === 'L') {
    if (spec.count >= 5) return 'Frozen Solid'
    if (spec.count >= 3) return 'Ice Cold'
    if (spec.count >= 2) return 'Slumping'
    return 'One Tough Week'
  }
  return 'Cooking'
}

function streakFooter(spec: StreakSpec): string {
  const word = spec.kind === 'W' ? 'wins' : 'losses'
  if (spec.count === 1) return `1 ${word.slice(0, -1)} this week`
  return `${spec.count} ${word} in a row`
}

function StreakCard({ streak }: { streak: StreakSpec }) {
  if (streak.kind === null || streak.count === 0) {
    return (
      <EmptyShell label="Streak" icon={Sparkles} hint="No graded legs yet" />
    )
  }
  const isHot = streak.kind === 'W'
  const Icon = isHot ? Flame : Snowflake
  const header = streakHeader(streak)
  const footer = streakFooter(streak)

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-xl border px-4 py-3.5',
        isHot
          ? 'border-neon-blue/25 bg-gradient-to-br from-neon-blue/[0.07] via-transparent to-transparent'
          : 'border-destructive/25 bg-gradient-to-br from-destructive/[0.07] via-transparent to-transparent'
      )}
    >
      {/* Watermark icon at the bottom-right, large + faded */}
      <Icon
        aria-hidden
        className={cn(
          'pointer-events-none absolute -bottom-4 -right-4 h-24 w-24 opacity-[0.08]',
          isHot ? 'text-neon-blue' : 'text-destructive'
        )}
      />

      {/* Header — kicker with animated icon */}
      <div className="relative flex items-center gap-1.5">
        <motion.span
          animate={isHot ? { scale: [1, 1.18, 1] } : { rotate: [-3, 3, -3] }}
          transition={{ duration: isHot ? 1.4 : 2.4, repeat: Infinity, ease: 'easeInOut' }}
          className="inline-flex"
        >
          <Icon
            className={cn(
              'h-3.5 w-3.5',
              isHot ? 'text-neon-blue' : 'text-destructive'
            )}
          />
        </motion.span>
        <p
          className={cn(
            'text-[10px] font-bold tracking-[0.28em] uppercase',
            isHot ? 'text-neon-blue' : 'text-destructive'
          )}
        >
          {header}
        </p>
      </div>

      {/* Hero — big streak count with W/L modifier */}
      <p className="relative mt-2 font-display leading-none">
        <span
          className={cn(
            'text-4xl font-bold tabular-nums',
            isHot ? 'text-neon-blue' : 'text-destructive'
          )}
        >
          {streak.count}
        </span>
        <span
          className={cn(
            'ml-1 text-2xl font-bold',
            isHot ? 'text-neon-blue/60' : 'text-destructive/60'
          )}
        >
          {streak.kind}
        </span>
      </p>

      <p className="relative mt-1 text-[11px] text-muted-foreground">{footer}</p>
    </div>
  )
}

// ─── Last Week card — ticket / receipt ─────────────────────────────────────

function LastLegCard({
  leg,
  onOpenWeek,
}: {
  leg: RecentLeg | null
  onOpenWeek: (weekId: string) => void
}) {
  if (!leg) {
    return (
      <EmptyShell label="Last Week" icon={Sparkles} hint="Nothing graded yet" />
    )
  }
  const resultLabel = leg.result
    ? leg.result === 'win'
      ? 'Cash'
      : leg.result === 'loss'
        ? 'Miss'
        : 'Push'
    : 'Pending'
  const stampTone =
    leg.result === 'win'
      ? 'ring-neon-blue/40 text-neon-blue bg-neon-blue/[0.06]'
      : leg.result === 'loss'
        ? 'ring-destructive/40 text-destructive bg-destructive/[0.06]'
        : leg.result === 'push'
          ? 'ring-white/25 text-foreground/70 bg-white/[0.04]'
          : 'ring-white/15 text-muted-foreground bg-white/[0.03]'

  return (
    <button
      type="button"
      onClick={() => onOpenWeek(leg.week_id)}
      className="group relative flex flex-col overflow-hidden rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3.5 text-left transition-all hover:border-white/25 hover:bg-white/[0.04]"
    >
      {/* Ticket header — week tag on the left, odds in mono on the right */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold tracking-[0.28em] uppercase text-muted-foreground">
          Last · Wk {leg.week_number}
        </span>
        <span className="font-mono text-[11px] tabular-nums text-foreground/70">
          {formatOdds(leg.odds)}
        </span>
      </div>

      {/* Dashed divider — receipt-style perforation */}
      <div className="my-2.5 border-t border-dashed border-white/12" />

      {/* The bet */}
      <p className="text-sm font-medium text-foreground/90 line-clamp-2 leading-snug">
        {leg.description || 'No description'}
      </p>

      {/* Stamp-like result chip, right-aligned */}
      <div className="mt-2.5 flex items-center justify-end">
        <span
          className={cn(
            'inline-block rounded-md ring-1 ring-inset px-2 py-0.5 text-[10px] font-bold tracking-[0.3em] uppercase',
            stampTone
          )}
        >
          {resultLabel}
        </span>
      </div>
    </button>
  )
}

// ─── Best Hit card — trophy / achievement ──────────────────────────────────

function BestBetCard({
  leg,
  onOpenWeek,
}: {
  leg: RecentLeg | null
  onOpenWeek: (weekId: string) => void
}) {
  if (!leg) {
    return (
      <EmptyShell label="Best Hit" icon={Trophy} hint="No graded wins yet" />
    )
  }
  return (
    <button
      type="button"
      onClick={() => onOpenWeek(leg.week_id)}
      className="group relative flex flex-col overflow-hidden rounded-xl border border-neon-blue/25 bg-gradient-to-br from-neon-blue/[0.08] via-neon-blue/[0.02] to-transparent px-4 py-3.5 text-left transition-all hover:border-neon-blue/45"
    >
      {/* Trophy watermark in the top-right */}
      <Trophy
        aria-hidden
        className="pointer-events-none absolute -top-2 -right-2 h-20 w-20 text-neon-blue opacity-[0.08]"
      />

      {/* Header */}
      <div className="relative flex items-center gap-1.5">
        <Trophy className="h-3.5 w-3.5 text-neon-blue" />
        <p className="text-[10px] font-bold tracking-[0.28em] uppercase text-neon-blue">
          Biggest Hit
        </p>
      </div>

      {/* Hero odds — blue with subtle glow */}
      <p
        className="relative mt-2 font-display text-4xl font-bold tabular-nums leading-none text-neon-blue"
        style={{ textShadow: '0 0 16px rgba(255,215,0,0.35)' }}
      >
        {formatOdds(leg.odds)}
      </p>

      {/* Footer — bet text + week tag */}
      <div className="relative mt-1.5 flex items-center gap-2 text-[11px] text-muted-foreground">
        <span className="truncate flex-1 min-w-0">
          {leg.description || 'No description'}
        </span>
        <span className="shrink-0 font-mono text-foreground/50">Wk {leg.week_number}</span>
      </div>
    </button>
  )
}

// ─── Empty-state shell ─────────────────────────────────────────────────────

function EmptyShell({
  label,
  icon: Icon,
  hint,
}: {
  label: string
  icon: React.ComponentType<{ className?: string }>
  hint: string
}) {
  return (
    <div className="relative flex flex-col overflow-hidden rounded-xl border border-dashed border-white/10 bg-white/[0.015] px-4 py-3.5">
      <p className="text-[10px] font-bold tracking-[0.28em] uppercase text-muted-foreground/70">
        {label}
      </p>
      <div className="mt-2 flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground/50" />
        <span className="text-xs text-muted-foreground italic">{hint}</span>
      </div>
    </div>
  )
}

// ─── Expanded panel ─────────────────────────────────────────────────────────

function ExpandedPanel({
  results,
  wins,
  losses,
  pushes,
  allUserBets,
  onOpenWeek,
}: {
  results: Array<{
    weekNumber: number
    weekId: string
    result: 'win' | 'loss' | 'push' | null
    description?: string
  }>
  wins: number
  losses: number
  pushes: number
  allUserBets: RecentLeg[]
  onOpenWeek: (weekId: string) => void
}) {
  // No outer overflow container here — `<SectionDock>` provides its own
  // scrollable wrapper around expandedContent and drives the
  // "Scroll for more" indicator off that container's scroll metrics.
  return (
    <div className="px-4 py-5 space-y-5">
      {/* Full ConnectedDots — dots morph from the mini sparkline, lines
          + labels draw in afterward. */}
      <div className="mx-auto max-w-xl">
        <MorphingConnectedDots results={results} onOpenWeek={onOpenWeek} />
      </div>

      {/* Inline legend / W-L-(P) count. Doubles as chart legend + stat
          strip — Rank and Win % stay in the heading's trailing slot, so
          we don't repeat them here. Pushes hidden unless the user has
          at least one. */}
      <LegendStrip wins={wins} losses={losses} pushes={pushes} />

      {/* Full bet history — scrolls inside the dock's scroll container. */}
      {allUserBets.length > 0 && (
        <div className="border-t border-white/10 pt-5">
          <RecentLegs
            legs={allUserBets}
            maxDisplay={allUserBets.length}
            onOpenWeek={onOpenWeek}
            title="Bet History"
          />
        </div>
      )}
    </div>
  )
}

function LegendStrip({
  wins,
  losses,
  pushes,
}: {
  wins: number
  losses: number
  pushes: number
}) {
  return (
    <motion.div
      // Legend appears after the chart's dots + lines have settled.
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: 0.55 }}
      className="flex items-center justify-center gap-5 text-xs"
    >
      <LegendDot tone="neon-blue" count={wins} label="W" />
      <LegendDot tone="destructive" count={losses} label="L" />
      {pushes > 0 && <LegendDot tone="muted" count={pushes} label="P" />}
    </motion.div>
  )
}

function LegendDot({
  tone,
  count,
  label,
}: {
  tone: 'neon-blue' | 'destructive' | 'muted'
  count: number
  label: string
}) {
  const bg =
    tone === 'neon-blue'
      ? 'bg-neon-blue'
      : tone === 'destructive'
        ? 'bg-destructive'
        : 'bg-gray-400'
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn('inline-block h-2 w-2 rounded-full', bg)} />
      <span className="font-bold tabular-nums text-foreground">{count}</span>
      <span className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground">
        {label}
      </span>
    </span>
  )
}

// ─── Derivation helpers ────────────────────────────────────────────────────

function deriveStreak(
  sequence: Array<{ result: 'win' | 'loss' | 'push' | null }>
): StreakSpec {
  // Sequence is newest first. Walk forward counting consecutive same-kind
  // results, ignoring pushes (don't break a streak, don't extend it
  // either — same convention as most sportsbook apps).
  let count = 0
  let kind: 'W' | 'L' | null = null
  for (const r of sequence) {
    if (r.result === null || r.result === 'push') {
      if (kind === null) continue
      else continue
    }
    const k: 'W' | 'L' = r.result === 'win' ? 'W' : 'L'
    if (kind === null) {
      kind = k
      count = 1
    } else if (k === kind) {
      count++
    } else {
      break
    }
  }
  return { count, kind }
}

function deriveAllUserBets(
  allWeeksData: WeekDetailData[],
  currentUserId: string
): RecentLeg[] {
  const out: RecentLeg[] = []
  for (const w of allWeeksData) {
    const leg = w.legs.find((l) => l.userId === currentUserId)
    if (!leg) continue
    out.push({
      id: leg.id,
      description: leg.description,
      odds: String(leg.odds),
      result: leg.result,
      week_number: w.week.week_number,
      week_id: w.week.id,
    })
  }
  // Newest first.
  return out.sort((a, b) => b.week_number - a.week_number)
}

function deriveBestBet(legs: RecentLeg[]): RecentLeg | null {
  // Best = biggest positive payout among wins (highest odds value).
  let best: RecentLeg | null = null
  let bestOdds = -Infinity
  for (const leg of legs) {
    if (leg.result !== 'win') continue
    const n = parseInt(String(leg.odds).replace(/[^-\d]/g, ''), 10)
    if (isNaN(n)) continue
    if (n > bestOdds) {
      bestOdds = n
      best = leg
    }
  }
  return best
}

function formatOdds(raw: string) {
  const s = String(raw).trim()
  const n = parseInt(s.replace(/[^-\d]/g, ''), 10)
  if (isNaN(n)) return s
  return n > 0 ? `+${n}` : `${n}`
}
