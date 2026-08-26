'use client'

import { useEffect, useMemo, useState } from 'react'
import { Flame } from 'lucide-react'
import {
  ResponsiveSheet,
  SheetPage,
} from '@/components/ui/responsive-sheet'
import { cn } from '@/lib/utils'
import { useSlateScope } from '@/components/week-scope'
import type { SlateGame, SlateTeam } from '@/lib/data/week-slate'
import { useLiveScores } from '@/lib/hooks/use-live-scores'

interface WeekSlateProps {
  firstKickoff?: string | null
  /** Real schedule for the week (lib/data/week-slate). Null/empty renders
   *  an honest "schedule not loaded" state (e.g. mock mode). */
  games?: SlateGame[] | null
  /** nfl_weeks id — enables live score polling while the slate runs. */
  nflWeekId?: string | null
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
  //
  // object-contain because the box is square and the artwork isn't
  // guaranteed to be. Note this can't make two marks look the same size:
  // ESPN draws every logo on a 500×500 canvas, and how much of that
  // canvas the mark fills is the artwork's business, not ours — which is
  // why a leaping Lion reads bigger than a Commanders W at identical
  // dimensions.
  // A HALO, because every logo sits on its own team's colour by
  // construction — the slab's two halves ARE the two teams' primaries.
  // Most marks carry enough white to survive that; the ones drawn in
  // nothing but the team colour don't, and the Giants' NY and the Jets'
  // wordmark disappeared into their own bands completely. A thin white
  // drop-shadow traces whatever silhouette the artwork has, so a mark
  // separates from the colour behind it without a plate under it.
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={team.logoUrl}
      alt={team.name}
      title={team.name}
      className={cn(
        dim,
        'shrink-0 object-contain',
        // Two white passes, not one: a single 1px rim is too thin to
        // read around a wordmark's strokes. The black pass sits just
        // outside the white one so the mark holds up over a pale band
        // too — Steelers yellow, Saints gold.
        '[filter:drop-shadow(0_0_1px_rgba(255,255,255,0.95))_drop-shadow(0_0_1px_rgba(255,255,255,0.85))_drop-shadow(0_0_4px_rgba(0,0,0,0.6))]'
      )}
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

// ─── Public component ──────────────────────────────────────────────────────

/**
 * In-season schedule strip — matchup rows grouped by day. Tap one to
 * open its sheet: kickoff, network, venue, and the live score or the
 * final, all of it off the schedule sync.
 *
 * WHAT IT DOESN'T SAY IS WHOSE BET IS ON WHICH GAME, because the app
 * doesn't know. A leg is free text ("Lions Alt Spread -3.5") with no
 * foreign key to a game, and this file used to paper over that by
 * HASHING THE LEG ID and scattering real people's real bets across the
 * schedule — so a row would show your face, ringed in win-or-loss
 * colour, on a game you never touched. It also printed a full
 * sportsbook grid (spread, total, moneyline, juice) generated from a
 * hash of the two team abbreviations.
 *
 * Both are gone. Whose bet is whose lives in THE LAY, where it's true.
 */
export function WeekSlate({
  firstKickoff,
  games: gamesProp,
  nflWeekId = null,
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
  // How wide a net to cast. The switch itself lives up in the week
  // header (see week-scope.tsx) — the slate just does what it's told.
  const scope = useSlateScope()

  const visibleMatchups = useMemo(
    () =>
      games
        .map((g, idx) => ({ g, idx }))
        .filter(({ g }) => scope === 'all' || g.inSlate),
    [games, scope]
  )

  // Open game in the sheet — tracks by matchup index.
  const [openGameIdx, setOpenGameIdx] = useState<number | null>(null)
  const openGame = openGameIdx != null ? games[openGameIdx] : null

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
              {/* Games are ROWS now, in the week list's grammar, so they
                  want width rather than columns. Two abreast on a wide
                  card, one on a narrow one. */}
              <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
                {games.map(({ g, idx }) => (
                  <GameCard
                    key={idx}
                    game={g}
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
        />
      )}
    </div>
  )
}

// ─── Compact card ───────────────────────────────────────────────────────────

function GameCard({
  game,
  onClick,
}: {
  game: SlateGame
  onClick: () => void
}) {
  const time = fmtKickoffTime(game.kickoff)

  // Edge-to-edge colored header — diagonal seam between the away
  // team's color (left) and home team's color (right). Logos sit
  // vertically centered inside the header: at the band's vertical
  // midpoint the seam passes through exactly 50%, so each color half
  // is true 50% wide at the logo's y-position and `flex-1 + center`
  // lands each logo at its color region's visual midpoint.
  const awayColor = teamColor(game.away)
  const homeColor = teamColor(game.home)
  const headerBg = `linear-gradient(110deg, ${awayColor} 0%, ${awayColor} 49.5%, ${homeColor} 50.5%, ${homeColor} 100%)`

  const live = game.status === 'in-progress'
  const final = game.status === 'final'

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group relative flex overflow-hidden rounded-xl border text-left transition-colors',
        'border-white/10 bg-white/[0.02] hover:bg-white/[0.05]'
      )}
      aria-label={`${game.away.name} at ${game.home.name}, ${time}`}
    >
      {/* THE MATCHUP, full height on the left — the same slab the week
          list gives a week's number, and for the same reason: the thing
          that identifies the row gets its own field of colour, and the
          facts about it live to the right. The colours are the two
          teams', split on the diagonal; the slab's inner edge carries
          that diagonal out into the silhouette. */}
      <div
        className="relative flex w-[7.5rem] shrink-0 items-center justify-center gap-1 self-stretch py-3"
        style={{
          background: headerBg,
          clipPath: 'polygon(0 0, 100% 0, calc(100% - 13px) 100%, 0 100%)',
        }}
      >
        {/* Scrim so logos stay readable on the bright ones — Steelers
            yellow, Saints gold. */}
        <div aria-hidden className="absolute inset-0 bg-black/25" />
        <TeamLogo team={game.away} size="md" />
        <span
          aria-hidden
          className="relative inline-flex size-5 items-center justify-center rounded-full bg-white/15 text-[10px] font-bold text-white ring-1 ring-white/25"
        >
          @
        </span>
        <TeamLogo team={game.home} size="md" />
      </div>

      <div className="flex min-w-0 flex-1 items-center gap-3 py-2.5 pr-3 pl-2.5">
        <div className="min-w-0 flex-1">
          {/* Who's playing, said once. The tracking relaxes on a phone:
              at 0.18em a twenty-character matchup needs 36px of pure
              letter-spacing, which truncated five of the fourteen rows
              mid-word — BUCCANEERS @ BENG…, COWBOYS @ GIAN…. Every one
              of them was over by less than the tracking itself. */}
          <p className="text-muted-foreground/80 truncate text-[10px] font-bold tracking-[0.07em] uppercase sm:tracking-[0.18em]">
            {game.away.name}
            <span className="text-muted-foreground/40"> @ </span>
            {game.home.name}
          </p>
          {/* And the one fact that matters right now, set like it
              matters: the score once there is one, the kickoff until
              then. */}
          <p
            className={cn(
              'font-display mt-0.5 text-xl leading-none tabular-nums',
              live
                ? 'text-neon-pink'
                : final
                  ? 'text-foreground/85'
                  : 'text-foreground/60'
            )}
          >
            {final || live
              ? `${game.awayScore ?? 0}–${game.homeScore ?? 0}`
              : time.replace(' ET', '')}
            <span className="text-muted-foreground/60 ml-1.5 text-[10px] font-bold tracking-[0.18em] uppercase">
              {live ? periodLabel(game.period) : final ? 'Final' : 'ET'}
            </span>
          </p>
        </div>

        {live ? (
          <span className="relative inline-flex size-2 shrink-0" title="Live">
            <span className="bg-neon-pink absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" />
            <span className="bg-neon-pink relative inline-flex size-2 rounded-full" />
          </span>
        ) : (
          game.isPrimetime && (
            <Flame className="text-foreground/50 size-3 shrink-0" />
          )
        )}

      </div>
    </button>
  )
}

// ─── Game detail sheet ─────────────────────────────────────────────────────

function GameDetailSheet({
  open,
  onClose,
  game,
}: {
  open: boolean
  onClose: () => void
  game: SlateGame
}) {
  const time = fmtKickoffTime(game.kickoff)

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

          {/* Game state — all of it real: status and final scores from
              the nightly schedule sync, quarter and clock from the live
              feed while it's running. */}
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

// ─── Game state (pre / live / final) ───────────────────────────────────────

// All real: status and scores from the schedule sync, quarter and clock
// from the live feed.
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
