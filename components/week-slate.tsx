'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Calendar,
  Check,
  Circle,
  Clock,
  ExternalLink,
  Filter,
  Flame,
  Minus,
  Skull,
  Trophy,
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { SectionHeader } from '@/components/ui/section-header'
import {
  ResponsiveSheet,
  SheetPage,
} from '@/components/ui/responsive-sheet'
import { cn } from '@/lib/utils'
import type { LegRoster } from '@/components/week-detail-sheet'

interface Matchup {
  away: string
  home: string
  /** Kickoff time only (e.g. "8:20pm ET"). Day already implied by the
   *  group section header. */
  time: string
  /** Day-of-week the game is scheduled on. Drives both UI grouping and
   *  (eventually) the per-league slate filter. */
  scheduledDay: 'thu' | 'fri' | 'sat' | 'sun' | 'mon'
  isPrimetime?: boolean
}

interface WeekSlateProps {
  weekNumber: number
  firstKickoff?: string | null
  legs?: LegRoster[]
  currentUserId?: string
  /** Drives default filter state — pre-lock ("open") shows all
   *  in-slate games (members are composing); post-lock collapses to
   *  only games with bets so the slate doesn't dwarf the live tracker. */
  parlayState?: 'open' | 'locked' | 'graded' | 'won' | 'lost'
  /**
   * When true, skip the internal `<SectionHeader>` + outer `<section>`
   * wrapper. Used by `<WeekSlateDock>`, which provides its own dock-style
   * heading and wraps the slate in its own section.
   */
  hideHeader?: boolean
}

// ─── Mock matchups (Phase A — swap for `nfl_games` reads in Phase C) ────────

const MOCK_MATCHUPS: Matchup[] = [
  { away: 'Ravens', home: 'Chiefs', time: '8:20pm ET', scheduledDay: 'thu', isPrimetime: true },
  { away: 'Steelers', home: 'Falcons', time: '1:00pm ET', scheduledDay: 'sun' },
  { away: 'Cardinals', home: 'Bills', time: '1:00pm ET', scheduledDay: 'sun' },
  { away: 'Jaguars', home: 'Dolphins', time: '1:00pm ET', scheduledDay: 'sun' },
  { away: 'Bengals', home: 'Patriots', time: '1:00pm ET', scheduledDay: 'sun' },
  { away: 'Texans', home: 'Colts', time: '1:00pm ET', scheduledDay: 'sun' },
  { away: 'Vikings', home: 'Giants', time: '1:00pm ET', scheduledDay: 'sun' },
  { away: 'Panthers', home: 'Saints', time: '1:00pm ET', scheduledDay: 'sun' },
  { away: 'Titans', home: 'Bears', time: '4:25pm ET', scheduledDay: 'sun' },
  { away: 'Raiders', home: 'Chargers', time: '4:25pm ET', scheduledDay: 'sun' },
  { away: 'Broncos', home: 'Seahawks', time: '4:25pm ET', scheduledDay: 'sun' },
  { away: 'Cowboys', home: 'Browns', time: '4:25pm ET', scheduledDay: 'sun' },
  { away: 'Commanders', home: '49ers', time: '4:25pm ET', scheduledDay: 'sun' },
  { away: 'Packers', home: 'Eagles', time: '8:20pm ET', scheduledDay: 'sun', isPrimetime: true },
  { away: 'Buccaneers', home: 'Lions', time: '8:15pm ET', scheduledDay: 'mon', isPrimetime: true },
  { away: 'Jets', home: 'Rams', time: '8:15pm ET', scheduledDay: 'mon', isPrimetime: true },
]

// ─── Team logos (ESPN CDN — public, no auth) ────────────────────────────────

// Maps the display name in `MOCK_MATCHUPS` to ESPN's lowercase team
// abbreviation. PLAN.md notes the long-term path: cache logos in our
// own CDN/db once the API picks are locked, but ESPN hot-links work
// fine for the demo. NFL teams don't change abbreviations, so this map
// is effectively static.
const TEAM_ABBREV: Record<string, string> = {
  Ravens: 'bal',
  Chiefs: 'kc',
  Steelers: 'pit',
  Falcons: 'atl',
  Cardinals: 'ari',
  Bills: 'buf',
  Jaguars: 'jax',
  Dolphins: 'mia',
  Bengals: 'cin',
  Patriots: 'ne',
  Texans: 'hou',
  Colts: 'ind',
  Vikings: 'min',
  Giants: 'nyg',
  Panthers: 'car',
  Saints: 'no',
  Titans: 'ten',
  Bears: 'chi',
  Raiders: 'lv',
  Chargers: 'lac',
  Broncos: 'den',
  Seahawks: 'sea',
  Cowboys: 'dal',
  Browns: 'cle',
  Commanders: 'wsh',
  '49ers': 'sf',
  Packers: 'gb',
  Eagles: 'phi',
  Buccaneers: 'tb',
  Lions: 'det',
  Jets: 'nyj',
  Rams: 'lar',
}

const teamLogoUrl = (team: string): string | null => {
  const abbrev = TEAM_ABBREV[team]
  return abbrev
    ? `https://a.espncdn.com/i/teamlogos/nfl/500/${abbrev}.png`
    : null
}

// Hardcoded primary team colors — pulled from public NFL/ESPN brand
// references. Future-proofing path is in PLAN.md (Phase B schema):
// `nfl_teams.primary_color text` + `secondary_color text`, populated
// from the schedule API on sync. Until then this map is the source.
const TEAM_COLOR: Record<string, string> = {
  Ravens: '#241773',
  Chiefs: '#E31837',
  Steelers: '#FFB612',
  Falcons: '#A71930',
  Cardinals: '#97233F',
  Bills: '#00338D',
  Jaguars: '#006778',
  Dolphins: '#008E97',
  Bengals: '#FB4F14',
  Patriots: '#002244',
  Texans: '#03202F',
  Colts: '#002C5F',
  Vikings: '#4F2683',
  Giants: '#0B2265',
  Panthers: '#0085CA',
  Saints: '#D3BC8D',
  Titans: '#0C2340',
  Bears: '#0B162A',
  Raiders: '#000000',
  Chargers: '#0080C6',
  Broncos: '#FB4F14',
  Seahawks: '#002244',
  Cowboys: '#003594',
  Browns: '#311D00',
  Commanders: '#5A1414',
  '49ers': '#AA0000',
  Packers: '#203731',
  Eagles: '#004C54',
  Buccaneers: '#D50A0A',
  Lions: '#0076B6',
  Jets: '#125740',
  Rams: '#003594',
}

const teamColor = (team: string): string => TEAM_COLOR[team] ?? '#1a1a1a'

function TeamLogo({
  team,
  size = 'md',
}: {
  team: string
  size?: 'sm' | 'md' | 'lg'
}) {
  const dim = size === 'sm' ? 'h-5 w-5' : size === 'lg' ? 'h-12 w-12' : 'h-7 w-7'
  const url = teamLogoUrl(team)
  if (!url) {
    return (
      <span className="text-[10px] font-bold tracking-widest uppercase text-foreground/90">
        {team.slice(0, 3)}
      </span>
    )
  }
  // Use plain <img> intentionally — Next.js image optimization for hot-
  // linked ESPN logos isn't worth the next.config domain plumbing here.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={team} title={team} className={cn(dim, 'shrink-0')} />
}

// ─── Day grouping ───────────────────────────────────────────────────────────

const DAY_LABEL: Record<Matchup['scheduledDay'], string> = {
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
  mon: 'Monday',
}
const DAY_ORDER: Array<Matchup['scheduledDay']> = ['thu', 'fri', 'sat', 'sun', 'mon']

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

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
      <div className="inline-flex items-center gap-2 rounded-full bg-white/[0.04] ring-1 ring-red-500/30 px-2.5 py-1">
        <span className="relative inline-flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75 animate-ping" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
        </span>
        <span className="text-[10px] font-bold tracking-[0.25em] uppercase text-red-400">
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

// ─── Mock leg → game distribution ───────────────────────────────────────────

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
// MVP slate filter — defaults to the league-creation onboarding's
// sun+mon (per PLAN.md). Real filter pulls from `leagues.slate_days_included`
// once Phase B lands.
const DEFAULT_SLATE_DAYS: ReadonlyArray<Matchup['scheduledDay']> = ['sun', 'mon']

export function WeekSlate({
  weekNumber,
  firstKickoff,
  legs = [],
  currentUserId,
  parlayState,
  hideHeader = false,
}: WeekSlateProps) {
  const legsByGameIdx = useMemo(
    () => distributeLegsAcrossGames(legs, MOCK_MATCHUPS.length),
    [legs]
  )

  // Filter state.
  //   - `inSlateOnly` defaults ON: members care about games they can
  //     actually bet on (the league's slate). Toggle to peek at games
  //     outside the slate (Thursday opener, etc).
  //   - `withBetsOnly` defaults to ON post-lock (locked / graded / live)
  //     so the slate shrinks to the relevant games during the live
  //     tracker. Pre-lock (open / undefined) shows every available
  //     option since members are still composing.
  const [inSlateOnly, setInSlateOnly] = useState(true)
  const postLock =
    parlayState === 'locked' ||
    parlayState === 'graded' ||
    parlayState === 'won' ||
    parlayState === 'lost'
  const [withBetsOnly, setWithBetsOnly] = useState(postLock)

  const visibleMatchups = useMemo(
    () =>
      MOCK_MATCHUPS.map((g, idx) => ({ g, idx })).filter(({ g, idx }) => {
        if (inSlateOnly && !DEFAULT_SLATE_DAYS.includes(g.scheduledDay)) {
          return false
        }
        if (withBetsOnly && (legsByGameIdx.get(idx)?.length ?? 0) === 0) {
          return false
        }
        return true
      }),
    [inSlateOnly, withBetsOnly, legsByGameIdx]
  )

  // Open game in the sheet — tracks by matchup index.
  const [openGameIdx, setOpenGameIdx] = useState<number | null>(null)
  const openGame = openGameIdx != null ? MOCK_MATCHUPS[openGameIdx] : null
  const openGameLegs =
    openGameIdx != null ? legsByGameIdx.get(openGameIdx) ?? [] : []

  const totalWithBets = legs.length
  const totalInSlate = MOCK_MATCHUPS.filter((g) =>
    DEFAULT_SLATE_DAYS.includes(g.scheduledDay)
  ).length

  const Wrapper = hideHeader ? 'div' : 'section'
  const wrapperClass = hideHeader ? '' : 'mt-10 sm:mt-12'

  return (
    <Wrapper className={wrapperClass}>
      {!hideHeader && (
        <>
          <SectionHeader
            kicker={`Week ${weekNumber}`}
            title="Slate"
            icon={Calendar}
            accent="blue"
            trailing={
              <SlateCountdown
                firstKickoff={firstKickoff ?? null}
                isLive={postLock && parlayState !== 'won' && parlayState !== 'lost'}
              />
            }
          />
          <p className="text-xs text-muted-foreground mb-3 -mt-3">
            {firstKickoff
              ? `First kickoff ${fmtDate(firstKickoff)}`
              : 'This week\'s NFL matchups'}{' '}
            · Mock schedule — live NFL data + betting odds light up post-cutover.
          </p>
        </>
      )}

      {/* Filter chips */}
      <div className="flex flex-wrap items-center gap-1.5 mb-5">
        <Filter className="h-3 w-3 text-muted-foreground/70 mr-0.5" aria-hidden />
        <FilterChip
          active={inSlateOnly}
          onClick={() => setInSlateOnly((v) => !v)}
          label={`In betting slate · ${totalInSlate}`}
        />
        <FilterChip
          active={withBetsOnly}
          disabled={totalWithBets === 0}
          onClick={() => setWithBetsOnly((v) => !v)}
          label={`With bets · ${totalWithBets}`}
        />
      </div>

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
              No games match your filters. Toggle one off to see more.
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
    </Wrapper>
  )
}

function FilterChip({
  active,
  disabled,
  onClick,
  label,
}: {
  active: boolean
  disabled?: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase ring-1 transition-colors',
        active
          ? 'bg-neon-blue/15 text-neon-blue ring-neon-blue/40'
          : 'text-muted-foreground ring-white/10 hover:bg-white/5',
        disabled && 'opacity-40 cursor-not-allowed hover:bg-transparent'
      )}
      aria-pressed={active}
    >
      {active ? (
        <Check className="h-3 w-3" strokeWidth={3} />
      ) : (
        <Circle className="h-2 w-2" />
      )}
      {label}
    </button>
  )
}

// ─── Compact card ───────────────────────────────────────────────────────────

function GameCard({
  game,
  legs,
  currentUserId,
  onClick,
}: {
  game: Matchup
  legs: LegRoster[]
  currentUserId?: string
  onClick: () => void
}) {
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
      aria-label={`${game.away} at ${game.home}, ${game.time}`}
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
        {game.isPrimetime && (
          <Flame
            className="absolute right-1.5 top-1.5 h-3 w-3 text-white drop-shadow z-10"
          />
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
          {game.away}
        </span>
        <span className="absolute bottom-1 right-2 text-[8px] font-bold tracking-widest uppercase text-white/30 truncate max-w-[40%] leading-none">
          {game.home}
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
            game.isPrimetime ? 'text-foreground/90' : 'text-muted-foreground/80'
          )}
        >
          {game.time}
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
  game: Matchup
  legs: LegRoster[]
  currentUserId?: string
}) {
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
      <SheetPage name="main" title={`${game.away} @ ${game.home}`}>
        <div className="space-y-5">
          {/* Hero — large logos + kickoff slot */}
          <div className="flex items-center justify-center gap-5 py-2">
            <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
              <TeamLogo team={game.away} size="lg" />
              <span className="text-sm font-bold tracking-wide uppercase text-foreground/90 truncate w-full text-center">
                {game.away}
              </span>
            </div>
            <span className="text-xs font-bold tracking-widest uppercase text-muted-foreground/70">
              @
            </span>
            <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
              <TeamLogo team={game.home} size="lg" />
              <span className="text-sm font-bold tracking-wide uppercase text-foreground/90 truncate w-full text-center">
                {game.home}
              </span>
            </div>
          </div>
          <div className="flex items-center justify-center gap-2 text-[11px] font-bold tracking-widest uppercase text-muted-foreground tabular-nums">
            <span>{DAY_LABEL[game.scheduledDay]}</span>
            <span className="text-muted-foreground/40">·</span>
            <span
              className={cn(
                game.isPrimetime && 'text-foreground/90 inline-flex items-center gap-1'
              )}
            >
              {game.isPrimetime && <Flame className="h-3 w-3" />}
              {game.time}
            </span>
          </div>

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
              Mock lines — tap a line to seed your leg composer once
              feeds are wired.
            </p>
          </div>

          {/* Live game — countdown / live scoreboard / final, based on
              a per-game mock state. Live data lights up post-cutover. */}
          <div className="space-y-2">
            <p className="text-[10px] font-bold tracking-[0.25em] uppercase text-muted-foreground">
              Live game
            </p>
            <GameStateMock game={game} />
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

function LinesOddsMock({ game }: { game: Matchup }) {
  // Deterministic mock values per matchup so cards stay visually
  // consistent across re-renders.
  const h = hashStrSlate(game.away + game.home)
  const spread = (1.5 + ((h % 14) * 0.5)).toFixed(1)
  const total = (38.5 + ((h % 12) * 0.5)).toFixed(1)
  const favML = -(120 + (h % 200))
  const dogML = 100 + ((h >> 4) % 250)
  return (
    <div className="grid grid-cols-3 gap-1.5">
      <LineCell label="Spread" line={`${game.away} -${spread}`} odds="-110" />
      <LineCell label="Total" line={`Over ${total}`} odds="-110" />
      <LineCell label="Moneyline" line={game.away} odds={fmtOdds(favML)} />
      <LineCell label="Spread" line={`${game.home} +${spread}`} odds="-110" />
      <LineCell label="Total" line={`Under ${total}`} odds="-110" />
      <LineCell label="Moneyline" line={game.home} odds={fmtOdds(dogML)} />
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

function GameStateMock({ game }: { game: Matchup }) {
  // Derive a believable demo state from scheduledDay so the slate shows
  // a mix of finished / live / pre-kickoff games at a glance.
  let state: 'pre' | 'live' | 'final'
  if (game.scheduledDay === 'thu') state = 'final'
  else if (game.scheduledDay === 'mon' || game.isPrimetime) state = 'pre'
  else state = 'live'

  const h = hashStrSlate(game.away + game.home)
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

  if (state === 'pre') {
    return <PreKickoffStub />
  }

  if (state === 'final') {
    return (
      <ScoreboardCard
        awayLabel={game.away}
        homeLabel={game.home}
        awayScore={awayScore}
        homeScore={homeScore}
        statusLabel="Final"
        statusTone="text-muted-foreground"
      />
    )
  }

  // Live
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3 space-y-3">
      <Scoreboard
        awayLabel={game.away}
        homeLabel={game.home}
        awayScore={awayScore}
        homeScore={homeScore}
      />
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
    </div>
  )
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
