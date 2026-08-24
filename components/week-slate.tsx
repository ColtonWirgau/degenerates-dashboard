'use client'

import { useEffect, useMemo, useState } from 'react'
import { Clock, ExternalLink, Flame, Minus, Skull, Trophy } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  ResponsiveSheet,
  SheetPage,
} from '@/components/ui/responsive-sheet'
import { cn } from '@/lib/utils'
import { useSlateScope } from '@/components/week-scope'
import type { LegRoster } from '@/components/week-detail-sheet'
import type { SlateGame, SlateTeam } from '@/lib/data/week-slate'
import { useLiveScores } from '@/lib/hooks/use-live-scores'

interface WeekSlateProps {
  firstKickoff?: string | null
  /** Real schedule for the week (lib/data/week-slate). Null/empty renders
   *  an honest "schedule not loaded" state (e.g. mock mode). */
  games?: SlateGame[] | null
  /** nfl_weeks id — enables live score polling while the slate runs. */
  nflWeekId?: string | null
  legs?: LegRoster[]
  currentUserId?: string
}

// ─── Team display helpers (real nfl_teams rows via the slate payload) ──────

const teamColor = (team: SlateTeam): string => team.primaryColor ?? '#1a1a1a'

/** 1–4 → Q1–Q4, 5+ → OT/2OT. Null before kickoff. */
const periodLabel = (period: number | null): string => {
  if (period == null) return ''
  if (period <= 4) return `Q${period}`
  return period === 5 ? 'OT' : `${period - 4}OT`
}

// Kickoff time in ET (the group header carries the day).
const fmtKickoffTime = (iso: string): string =>
  new Date(iso)
    .toLocaleTimeString('en-US', {
      timeZone: 'America/New_York',
      hour: 'numeric',
      minute: '2-digit',
    })
    .toLowerCase()
    .replace(' ', '') + ' ET'

function TeamLogo({
  team,
  size = 'md',
}: {
  team: SlateTeam
  size?: 'sm' | 'md' | 'lg'
}) {
  const dim = size === 'sm' ? 'h-5 w-5' : size === 'lg' ? 'h-12 w-12' : 'h-7 w-7'
  if (!team.logoUrl) {
    return (
      <span className="text-[10px] font-bold tracking-widest uppercase text-foreground/90">
        {team.abbr}
      </span>
    )
  }
  // Use plain <img> intentionally — Next.js image optimization for hot-
  // linked ESPN logos isn't worth the next.config domain plumbing here.
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={team.logoUrl}
      alt={team.name}
      title={team.name}
      className={cn(dim, 'shrink-0')}
    />
  )
}

// ─── Day grouping ───────────────────────────────────────────────────────────

// NFL weeks run Thu → Wed; late-season flexing puts games on Tue/Wed/Sat
// too, so every day gets a slot.
const DAY_LABEL: Record<string, string> = {
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
}
const DAY_ORDER = ['thu', 'fri', 'sat', 'sun', 'mon', 'tue', 'wed'] as const


// ─── Slate countdown — ticking pre-kickoff timer / live indicator ──────────

export function SlateCountdown({
  firstKickoff,
  isLive,
}: {
  firstKickoff: string | null
  /** Forces the LIVE state regardless of firstKickoff math — e.g. when
   *  the parlay is mid-flight even though the first kickoff is in the
   *  past. Mock-friendly. */
  isLive?: boolean
}) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  if (!firstKickoff && !isLive) return null

  const target = firstKickoff ? new Date(firstKickoff) : null
  const diffMs = target ? target.getTime() - now.getTime() : -1
  const live = isLive || diffMs <= 0

  if (live) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full bg-white/[0.04] ring-1 ring-neon-pink/30 px-2.5 py-1">
        <span className="relative inline-flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full rounded-full bg-neon-pink opacity-75 animate-ping" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-neon-pink" />
        </span>
        <span className="text-[10px] font-bold tracking-[0.25em] uppercase text-neon-pink">
          Slate Live
        </span>
      </div>
    )
  }

  const totalSec = Math.max(0, Math.floor(diffMs / 1000))
  const days = Math.floor(totalSec / 86400)
  const hours = Math.floor((totalSec % 86400) / 3600)
  const minutes = Math.floor((totalSec % 3600) / 60)
  const seconds = totalSec % 60

  // Compact display — shrink the unit count as we approach kickoff.
  let label: string
  if (days > 0) label = `${days}d ${hours}h ${minutes}m`
  else if (hours > 0) label = `${hours}h ${minutes}m ${seconds}s`
  else label = `${minutes}m ${seconds}s`

  return (
    <div className="text-right">
      <p className="text-[9px] font-bold tracking-[0.3em] uppercase text-muted-foreground/70 leading-none">
        Slate starts in
      </p>
      <p className="mt-1 font-display text-base sm:text-lg font-bold tracking-wide tabular-nums leading-none text-neon-blue">
        {label}
      </p>
    </div>
  )
}

const getInitials = (name: string | null, email: string) => {
  if (name) {
    const parts = name.split(' ').filter(Boolean)
    if (parts.length >= 2) return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase()
    return name.slice(0, 2).toUpperCase()
  }
  return email.slice(0, 2).toUpperCase()
}

const fmtOdds = (n: number) => (n > 0 ? `+${n}` : `${n}`)

// ─── Status tones (shared by collapsed cards + sheet bet rows) ─────────────

type LegStatus = 'pending' | 'win' | 'loss' | 'push'

const statusOf = (l: LegRoster): LegStatus =>
  l.result === 'win'
    ? 'win'
    : l.result === 'loss'
      ? 'loss'
      : l.result === 'push'
        ? 'push'
        : 'pending'

const STATUS_RING: Record<LegStatus, string> = {
  pending: 'ring-white/30',
  win: 'ring-neon-blue',
  loss: 'ring-destructive',
  push: 'ring-gray-400',
}

const STATUS_LABEL: Record<LegStatus, string> = {
  pending: 'Pending',
  win: 'Hit',
  loss: 'Missed',
  push: 'Push',
}

const STATUS_TEXT: Record<LegStatus, string> = {
  pending: 'text-muted-foreground',
  win: 'text-neon-blue',
  loss: 'text-destructive',
  push: 'text-foreground/70',
}

const STATUS_ICON: Record<LegStatus, typeof Clock> = {
  pending: Clock,
  win: Trophy,
  loss: Skull,
  push: Minus,
}

// ─── Leg → game association (illustrative) ─────────────────────────────────
// Legs are free text with no game FK, so which game a bet "belongs to" is a
// deterministic hash scatter for now. Real association needs a
// parlay_legs.nfl_game_id column (or AI matching) — deferred.

const hashStr = (s: string) => {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h)
}

function distributeLegsAcrossGames(
  legs: LegRoster[],
  gameCount: number
): Map<number, LegRoster[]> {
  const out = new Map<number, LegRoster[]>()
  if (gameCount === 0) return out
  for (const leg of legs) {
    const idx = hashStr(leg.id) % gameCount
    const arr = out.get(idx) ?? []
    arr.push(leg)
    out.set(idx, arr)
  }
  return out
}

// ─── Public component ──────────────────────────────────────────────────────

/**
 * In-season schedule strip — compact grid of matchup cards grouped by
 * day. Tap any card to open a `GameDetailSheet` with the full game
 * info: bets list, lines/odds placeholder, and room to grow into live
 * score / drives / player stats once the NFL feed is wired up.
 *
 * Why a sheet (not inline accordion): each game has unbounded future
 * detail (live score, scoring plays, player props, betting odds tables,
 * member bet history). A sheet has full screen on mobile + a large
 * modal on desktop, which keeps the page surface tight.
 */
export function WeekSlate({
  firstKickoff,
  games: gamesProp,
  nflWeekId = null,
  legs = [],
  currentUserId,
}: WeekSlateProps) {
  // Live scores are merged over the server-rendered schedule. The hook is
  // idle outside the slate window, so this costs nothing most of the week.
  const { byId: liveById, anyLive } = useLiveScores(nflWeekId)
  const games = useMemo(() => {
    const base = gamesProp ?? []
    if (liveById.size === 0) return base
    return base.map((g) => {
      const live = liveById.get(g.id)
      return live
        ? {
            ...g,
            status: live.status,
            homeScore: live.homeScore,
            awayScore: live.awayScore,
            period: live.period,
            displayClock: live.displayClock,
          }
        : g
    })
  }, [gamesProp, liveById])
  const legsByGameIdx = useMemo(
    () => distributeLegsAcrossGames(legs, games.length),
    [legs, games.length]
  )

  // How wide a net to cast. The switch itself lives up in the week
  // header (see week-scope.tsx) — the slate just does what it's told.
  const scope = useSlateScope()

  const visibleMatchups = useMemo(
    () =>
      games
        .map((g, idx) => ({ g, idx }))
        .filter(({ g, idx }) => {
          if (scope === 'all') return true
          if (scope === 'slate') return g.inSlate
          return (legsByGameIdx.get(idx)?.length ?? 0) > 0
        }),
    [games, scope, legsByGameIdx]
  )

  // Open game in the sheet — tracks by matchup index.
  const [openGameIdx, setOpenGameIdx] = useState<number | null>(null)
  const openGame = openGameIdx != null ? games[openGameIdx] : null
  const openGameLegs =
    openGameIdx != null ? legsByGameIdx.get(openGameIdx) ?? [] : []

  // No heading: the week header above already names the week and carries
  // the scope switch. All that's left is the games and, while they're
  // running, a live countdown pinned to the first day group.
  return (
    <div>
      {anyLive && (
        <div className="mb-3 flex justify-end">
          <SlateCountdown firstKickoff={firstKickoff ?? null} isLive />
        </div>
      )}

      <div className="space-y-5">
        {DAY_ORDER.map((day) => {
          const games = visibleMatchups.filter(({ g }) => g.scheduledDay === day)
          if (games.length === 0) return null
          return (
            <div key={day}>
              <p className="text-[10px] font-bold tracking-[0.3em] uppercase text-muted-foreground/80 mb-2">
                {DAY_LABEL[day]}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {games.map(({ g, idx }) => (
                  <GameCard
                    key={idx}
                    game={g}
                    legs={legsByGameIdx.get(idx) ?? []}
                    currentUserId={currentUserId}
                    onClick={() => setOpenGameIdx(idx)}
                  />
                ))}
              </div>
            </div>
          )
        })}
        {visibleMatchups.length === 0 && (
          <div className="rounded-md border border-dashed border-white/10 bg-white/[0.02] px-3 py-4 text-center">
            <p className="text-xs text-muted-foreground italic">
              {games.length === 0
                ? 'Schedule not loaded for this week yet.'
                : scope === 'action'
                  ? "Nothing riding yet — nobody's picked a game."
                  : 'No games in this scope. Widen it to see more.'}
            </p>
          </div>
        )}
      </div>

      {openGame && (
        <GameDetailSheet
          open={openGameIdx != null}
          onClose={() => setOpenGameIdx(null)}
          game={openGame}
          legs={openGameLegs}
          currentUserId={currentUserId}
        />
      )}
    </div>
  )
}

// ─── Compact card ───────────────────────────────────────────────────────────

function GameCard({
  game,
  legs,
  currentUserId,
  onClick,
}: {
  game: SlateGame
  legs: LegRoster[]
  currentUserId?: string
  onClick: () => void
}) {
  const time = fmtKickoffTime(game.kickoff)
  // Pin viewer first so their avatar is always visible.
  const sortedLegs = currentUserId
    ? [...legs].sort((a, b) => {
        if (a.userId === currentUserId && b.userId !== currentUserId) return -1
        if (b.userId === currentUserId && a.userId !== currentUserId) return 1
        return 0
      })
    : legs

  // Edge-to-edge colored header — diagonal seam between the away
  // team's color (left) and home team's color (right). Logos sit
  // vertically centered inside the header: at the band's vertical
  // midpoint the seam passes through exactly 50%, so each color half
  // is true 50% wide at the logo's y-position and `flex-1 + center`
  // lands each logo at its color region's visual midpoint.
  const awayColor = teamColor(game.away)
  const homeColor = teamColor(game.home)
  const headerBg = `linear-gradient(110deg, ${awayColor} 0%, ${awayColor} 49.5%, ${homeColor} 50.5%, ${homeColor} 100%)`

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group relative flex flex-col rounded-xl border overflow-hidden text-center transition-colors',
        'border-white/10 bg-white/[0.02] hover:bg-white/[0.05]'
      )}
      aria-label={`${game.away.name} at ${game.home.name}, ${time}`}
    >
      {/* Edge-to-edge team-colored header with diagonal split. Logos
          float at the bottom edge so they overlap into the body below
          for a cohesive look. */}
      <div
        className="relative h-20 w-full"
        style={{ background: headerBg }}
      >
        {/* Subtle dark scrim so light logos + names stay readable on
            bright team colors (Steelers yellow, Saints gold, etc). */}
        <div aria-hidden className="absolute inset-0 bg-black/20" />
        {game.status === 'in-progress' ? (
          <span className="absolute right-1.5 top-1.5 z-10 inline-flex h-2 w-2" title="Live">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-neon-pink opacity-75" />
            <span className="bg-neon-pink relative inline-flex h-2 w-2 rounded-full" />
          </span>
        ) : (
          game.isPrimetime && (
            <Flame
              className="absolute right-1.5 top-1.5 h-3 w-3 text-white drop-shadow z-10"
            />
          )
        )}
        {/* Logos centered in each color half. */}
        <div className="absolute inset-0 flex items-center">
          <div className="flex-1 flex justify-center min-w-0">
            <TeamLogo team={game.away} size="md" />
          </div>
          <div className="flex-1 flex justify-center min-w-0">
            <TeamLogo team={game.home} size="md" />
          </div>
        </div>

        {/* Team names — tucked into the bottom outside corners,
            washed-out so they read as a watermark, not a label. */}
        <span className="absolute bottom-1 left-2 text-[8px] font-bold tracking-widest uppercase text-white/30 truncate max-w-[40%] leading-none">
          {game.away.name}
        </span>
        <span className="absolute bottom-1 right-2 text-[8px] font-bold tracking-widest uppercase text-white/30 truncate max-w-[40%] leading-none">
          {game.home.name}
        </span>

        {/* `@` glass pill — sits on the diagonal seam at the exact
            center of the header. Liquid-glass treatment matches the
            dock primitives. */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span
            aria-hidden
            className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/15 backdrop-blur-md ring-1 ring-white/25 text-[11px] font-bold uppercase text-white"
          >
            @
          </span>
        </div>
      </div>

      {/* Body — time + avatar row. Team names live in the header now. */}
      <div className="flex flex-col items-center gap-1.5 px-3 pt-2.5 pb-3 flex-1">
        <span
          className={cn(
            'text-[10px] font-bold tracking-widest uppercase tabular-nums',
            game.status === 'in-progress'
              ? 'text-neon-pink'
              : game.isPrimetime
                ? 'text-foreground/90'
                : 'text-muted-foreground/80'
          )}
        >
          {game.status === 'final'
            ? `Final · ${game.awayScore ?? 0}–${game.homeScore ?? 0}`
            : game.status === 'in-progress'
              ? `${game.awayScore ?? 0}–${game.homeScore ?? 0} · ${periodLabel(game.period)}`
              : time}
        </span>

        {/* Avatar row — always reserves space so cards stay uniform. */}
        <div className="h-5 mt-auto flex items-center justify-center">
          {sortedLegs.length > 0 ? (
            <div className="flex -space-x-1.5">
              {sortedLegs.slice(0, 4).map((l) => {
                const status = statusOf(l)
                const isMine = l.userId === currentUserId
                return (
                  <Avatar
                    key={l.id}
                    className={cn('h-5 w-5', 'ring-2', STATUS_RING[status])}
                    title={
                      (isMine ? 'You' : l.fullName ?? l.email) +
                      ` — ${STATUS_LABEL[status]}`
                    }
                  >
                    <AvatarImage src={l.avatarUrl ?? undefined} alt={l.fullName ?? l.email} />
                    <AvatarFallback className="bg-primary text-primary-foreground text-[8px] font-bold">
                      {getInitials(l.fullName, l.email)}
                    </AvatarFallback>
                  </Avatar>
                )
              })}
              {sortedLegs.length > 4 && (
                <div className="h-5 w-5 rounded-full bg-white/10 ring-2 ring-black/60 inline-flex items-center justify-center text-[7px] font-bold text-muted-foreground tabular-nums">
                  +{sortedLegs.length - 4}
                </div>
              )}
            </div>
          ) : (
            <span className="text-[9px] tracking-widest uppercase text-muted-foreground/40">
              No bets
            </span>
          )}
        </div>
      </div>
    </button>
  )
}

// ─── Game detail sheet ─────────────────────────────────────────────────────

function GameDetailSheet({
  open,
  onClose,
  game,
  legs,
  currentUserId,
}: {
  open: boolean
  onClose: () => void
  game: SlateGame
  legs: LegRoster[]
  currentUserId?: string
}) {
  const time = fmtKickoffTime(game.kickoff)
  const sortedLegs = currentUserId
    ? [...legs].sort((a, b) => {
        if (a.userId === currentUserId && b.userId !== currentUserId) return -1
        if (b.userId === currentUserId && a.userId !== currentUserId) return 1
        return 0
      })
    : legs

  return (
    <ResponsiveSheet
      open={open}
      onClose={onClose}
      panelClassName="glass-intense border-t border-primary/30 md:border md:rounded-2xl"
      sheetMaxHeight="92dvh"
    >
      <SheetPage name="main" title={`${game.away.name} @ ${game.home.name}`}>
        <div className="space-y-5">
          {/* Hero — large logos + kickoff slot */}
          <div className="flex items-center justify-center gap-5 py-2">
            <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
              <TeamLogo team={game.away} size="lg" />
              <span className="text-sm font-bold tracking-wide uppercase text-foreground/90 truncate w-full text-center">
                {game.away.name}
              </span>
            </div>
            <span className="text-xs font-bold tracking-widest uppercase text-muted-foreground/70">
              @
            </span>
            <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
              <TeamLogo team={game.home} size="lg" />
              <span className="text-sm font-bold tracking-wide uppercase text-foreground/90 truncate w-full text-center">
                {game.home.name}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] font-bold tracking-widest uppercase text-muted-foreground tabular-nums">
            <span>{DAY_LABEL[game.scheduledDay] ?? game.scheduledDay}</span>
            <span className="text-muted-foreground/40">·</span>
            <span
              className={cn(
                game.isPrimetime && 'text-foreground/90 inline-flex items-center gap-1'
              )}
            >
              {game.isPrimetime && <Flame className="h-3 w-3" />}
              {time}
            </span>
            {game.network && (
              <>
                <span className="text-muted-foreground/40">·</span>
                <span>{game.network}</span>
              </>
            )}
          </div>
          {game.venue && (
            <p className="-mt-3 text-center text-[10px] tracking-widest uppercase text-muted-foreground/60">
              {game.venue}
            </p>
          )}

          {/* Bets on this game */}
          {sortedLegs.length > 0 ? (
            <div className="space-y-2">
              <p className="text-[10px] font-bold tracking-[0.25em] uppercase text-muted-foreground">
                Bets on this game
              </p>
              <ul className="space-y-1.5">
                {sortedLegs.map((l) => (
                  <BetRow key={l.id} leg={l} currentUserId={currentUserId} />
                ))}
              </ul>
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-white/10 bg-white/[0.02] px-3 py-2.5 text-center">
              <p className="text-xs text-muted-foreground italic">
                No league bets on this game yet.
              </p>
            </div>
          )}

          {/* Lines & odds — mocked card grid. */}
          <div className="space-y-2">
            <p className="text-[10px] font-bold tracking-[0.25em] uppercase text-muted-foreground">
              Lines &amp; odds
            </p>
            <LinesOddsMock game={game} />
            <p className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground/70">
              <ExternalLink className="h-3 w-3" />
              Illustrative lines — real odds light up when the odds feed
              is wired.
            </p>
          </div>

          {/* Game state — real status + final scores from the nightly
              schedule sync; in-progress detail (quarter/clock) stays
              illustrative until a live feed is wired. */}
          <div className="space-y-2">
            <p className="text-[10px] font-bold tracking-[0.25em] uppercase text-muted-foreground">
              Game state
            </p>
            <GameStateBlock game={game} />
          </div>
        </div>
      </SheetPage>
    </ResponsiveSheet>
  )
}

// ─── Bet row (sheet) ───────────────────────────────────────────────────────

function BetRow({
  leg,
  currentUserId,
}: {
  leg: LegRoster
  currentUserId?: string
}) {
  const status = statusOf(leg)
  const isMine = leg.userId === currentUserId
  const StatusIcon = STATUS_ICON[status]
  const displayName = isMine ? 'You' : leg.fullName ?? leg.email.split('@')[0]
  return (
    <li className="flex items-start gap-2.5 rounded-md border border-white/5 bg-white/[0.02] px-2.5 py-2">
      <Avatar
        className={cn('h-7 w-7 shrink-0 mt-0.5', 'ring-2', STATUS_RING[status])}
      >
        <AvatarImage src={leg.avatarUrl ?? undefined} alt={displayName} />
        <AvatarFallback className="bg-primary text-primary-foreground text-[10px] font-bold">
          {getInitials(leg.fullName, leg.email)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p
            className={cn(
              'text-[10px] font-bold tracking-widest uppercase truncate min-w-0 flex-1',
              isMine ? 'text-neon-blue' : 'text-muted-foreground'
            )}
          >
            {displayName}
          </p>
          <span
            className={cn(
              'inline-flex items-center gap-1 text-[9px] font-bold tracking-wider uppercase shrink-0',
              STATUS_TEXT[status]
            )}
          >
            <StatusIcon className="h-2.5 w-2.5" strokeWidth={3} />
            {STATUS_LABEL[status]}
          </span>
        </div>
        <p className="text-sm font-medium text-foreground/90 break-words line-clamp-2 mt-0.5">
          {leg.description || 'No description'}
        </p>
      </div>
      <span
        className={cn(
          'shrink-0 text-sm font-bold tabular-nums leading-none mt-1',
          leg.odds > 0 ? 'text-foreground/90' : 'text-muted-foreground'
        )}
      >
        {fmtOdds(leg.odds)}
      </span>
    </li>
  )
}

// ─── Lines & odds mock ─────────────────────────────────────────────────────

function LinesOddsMock({ game }: { game: SlateGame }) {
  // Deterministic illustrative values per matchup so cards stay visually
  // consistent across re-renders. Swapped for a real odds feed later.
  const h = hashStrSlate(game.away.abbr + game.home.abbr)
  const spread = (1.5 + ((h % 14) * 0.5)).toFixed(1)
  const total = (38.5 + ((h % 12) * 0.5)).toFixed(1)
  const favML = -(120 + (h % 200))
  const dogML = 100 + ((h >> 4) % 250)
  return (
    <div className="grid grid-cols-3 gap-1.5">
      <LineCell label="Spread" line={`${game.away.abbr} -${spread}`} odds="-110" />
      <LineCell label="Total" line={`Over ${total}`} odds="-110" />
      <LineCell label="Moneyline" line={game.away.abbr} odds={fmtOdds(favML)} />
      <LineCell label="Spread" line={`${game.home.abbr} +${spread}`} odds="-110" />
      <LineCell label="Total" line={`Under ${total}`} odds="-110" />
      <LineCell label="Moneyline" line={game.home.abbr} odds={fmtOdds(dogML)} />
    </div>
  )
}

function LineCell({
  label,
  line,
  odds,
}: {
  label: string
  line: string
  odds: string
}) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.02] px-2 py-1.5 text-center">
      <p className="text-[8px] font-bold tracking-widest uppercase text-muted-foreground/70 mb-1">
        {label}
      </p>
      <p className="text-[11px] font-semibold text-foreground/90 truncate leading-tight">
        {line}
      </p>
      <p className="text-[10px] tabular-nums text-muted-foreground mt-0.5">
        {odds}
      </p>
    </div>
  )
}

// ─── Game state mock (pre / live / final) ──────────────────────────────────

function hashStrSlate(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h)
}

// Real status + scores where the schedule sync has them; the in-progress
// quarter/clock detail is illustrative until a live feed is wired.
function GameStateBlock({ game }: { game: SlateGame }) {
  if (game.status === 'final') {
    return (
      <ScoreboardCard
        awayLabel={game.away.name}
        homeLabel={game.home.name}
        awayScore={game.awayScore ?? 0}
        homeScore={game.homeScore ?? 0}
        statusLabel={game.period && game.period > 4 ? 'Final · OT' : 'Final'}
        statusTone="text-muted-foreground"
      />
    )
  }

  if (game.status === 'postponed' || game.status === 'canceled') {
    return (
      <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.02] px-3 py-3 text-center">
        <p className="text-[10px] font-bold tracking-[0.3em] uppercase text-muted-foreground/80">
          {game.status === 'postponed' ? 'Postponed' : 'Canceled'}
        </p>
      </div>
    )
  }

  if (game.status === 'in-progress') {
    // All real now: score, quarter and clock come off the live feed.
    const quarter = periodLabel(game.period)
    const clock = game.displayClock
    // Rough progress through regulation for the bar — quarters are 15
    // minutes and the clock counts down.
    const [clockMin, clockSec] = (clock ?? '').split(':').map((n) => parseInt(n, 10))
    const elapsedInQuarter = Number.isFinite(clockMin)
      ? 15 - (clockMin + (Number.isFinite(clockSec) ? clockSec / 60 : 0))
      : 0
    const gameProgressPct = Math.min(
      100,
      Math.max(
        0,
        Math.round((((game.period ?? 1) - 1) * 15 + elapsedInQuarter) / 60 * 100)
      )
    )
    return (
      <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3 space-y-3">
        <Scoreboard
          awayLabel={game.away.name}
          homeLabel={game.home.name}
          awayScore={game.awayScore ?? 0}
          homeScore={game.homeScore ?? 0}
        />
        <div className="flex items-center gap-2.5">
          <span className="text-neon-pink inline-flex shrink-0 items-center gap-1.5 text-[10px] font-bold tracking-wider uppercase">
            <span className="relative inline-flex h-1.5 w-1.5">
              <span className="bg-neon-pink absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" />
              <span className="bg-neon-pink relative inline-flex h-1.5 w-1.5 rounded-full" />
            </span>
            {quarter}
            {clock ? ` · ${clock}` : ''}
          </span>
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/5">
            <div
              className="bg-neon-pink/70 h-full rounded-full transition-[width] duration-500"
              style={{ width: `${gameProgressPct}%` }}
            />
          </div>
        </div>
      </div>
    )
  }

  return <PreKickoffStub />
}

function PreKickoffStub() {
  return (
    <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.02] px-3 py-3 text-center">
      <p className="text-[10px] font-bold tracking-[0.3em] uppercase text-muted-foreground/80">
        Pre-kickoff
      </p>
      <p className="text-[11px] text-muted-foreground/70 mt-0.5">
        Drive chart + live score wire up when the game starts.
      </p>
    </div>
  )
}

function Scoreboard({
  awayLabel,
  homeLabel,
  awayScore,
  homeScore,
}: {
  awayLabel: string
  homeLabel: string
  awayScore: number
  homeScore: number
}) {
  return (
    <div className="flex items-center justify-around">
      <div className="flex flex-col items-center gap-0.5">
        <span className="text-[8px] font-bold tracking-[0.25em] uppercase text-muted-foreground truncate max-w-[10ch]">
          {awayLabel}
        </span>
        <span className="font-display text-2xl font-bold leading-none tabular-nums text-foreground/90">
          {awayScore}
        </span>
      </div>
      <span className="text-[10px] tracking-widest uppercase text-muted-foreground/40">
        @
      </span>
      <div className="flex flex-col items-center gap-0.5">
        <span className="text-[8px] font-bold tracking-[0.25em] uppercase text-muted-foreground truncate max-w-[10ch]">
          {homeLabel}
        </span>
        <span className="font-display text-2xl font-bold leading-none tabular-nums text-foreground/90">
          {homeScore}
        </span>
      </div>
    </div>
  )
}

function ScoreboardCard({
  awayLabel,
  homeLabel,
  awayScore,
  homeScore,
  statusLabel,
  statusTone,
}: {
  awayLabel: string
  homeLabel: string
  awayScore: number
  homeScore: number
  statusLabel: string
  statusTone: string
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3 space-y-2">
      <Scoreboard
        awayLabel={awayLabel}
        homeLabel={homeLabel}
        awayScore={awayScore}
        homeScore={homeScore}
      />
      <p
        className={cn(
          'text-center text-[10px] font-bold tracking-[0.25em] uppercase',
          statusTone
        )}
      >
        {statusLabel}
      </p>
    </div>
  )
}
