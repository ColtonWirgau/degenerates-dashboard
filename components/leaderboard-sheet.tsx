'use client'

import { useEffect, useState, useTransition } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  ResponsiveSheet,
  SheetPage,
  useResponsiveSheet,
} from '@/components/ui/responsive-sheet'
import {
  ChevronDown,
  ChevronRight,
  Clock,
  Loader2,
  Minus,
  Skull,
  Trophy,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getUserDetail, type UserDetailPayload } from '@/app/actions/user-detail'

export interface LeaderboardEntry {
  userId: string
  fullName: string | null
  email: string
  avatarUrl: string | null
  wins: number
  losses: number
  pushes: number
  total: number
  winRate: number
}

interface LeaderboardSheetProps {
  open: boolean
  onClose: () => void
  leagueId: string
  leaderboard: LeaderboardEntry[]
  currentUserId: string | null
  /** When set, sheet opens directly to this user's detail page. */
  focusUserId?: string | null
  /** Tap a leg row → close this sheet + open that week's parlay sheet. */
  onOpenWeek?: (parlayId: string) => void
  /** Seasons the user can switch between in the detail page picker. Newer
   *  seasons first (e.g. ['2026-2027', '2025-2026']). */
  availableSeasons?: string[]
  /** Which season the detail page should fetch on first render. Defaults
   *  to availableSeasons[0]. */
  defaultSeason?: string
}

const getInitials = (name: string | null, email: string) => {
  if (name) {
    const parts = name.split(' ')
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    return name.slice(0, 2).toUpperCase()
  }
  return email.slice(0, 2).toUpperCase()
}

const winRateColor = (rate: number) =>
  rate >= 70
    ? 'text-neon-blue'
    : rate >= 55
      ? 'text-neon-blue'
      : rate >= 40
        ? 'text-foreground'
        : 'text-neon-pink'

/**
 * Single multi-page sheet for the league's standings. Page 1 lists every
 * member sorted by win rate; tapping a row drills into Page 2 (user detail
 * with prev/next chevrons in the sheet header for fast comparison).
 *
 * Both triggers (Performance section CTA + tap-on-donut) render their own
 * instance — one is open at a time, so duplication is cheap and avoids
 * shared client state climbing the tree.
 */
export function LeaderboardSheet({
  open,
  onClose,
  leagueId,
  leaderboard,
  currentUserId,
  focusUserId,
  onOpenWeek,
  availableSeasons,
  defaultSeason,
}: LeaderboardSheetProps) {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(focusUserId ?? null)
  const [selectedSeason, setSelectedSeason] = useState<string | undefined>(defaultSeason)
  const [detail, setDetail] = useState<UserDetailPayload | null>(null)
  const [pending, startTransition] = useTransition()

  // Reset selected user/season when the sheet opens with a new focus or closes.
  useEffect(() => {
    if (open) {
      setSelectedUserId(focusUserId ?? null)
      setSelectedSeason(defaultSeason)
    } else {
      setSelectedUserId(null)
      setDetail(null)
    }
  }, [open, focusUserId, defaultSeason])

  // Fetch detail when selected user or season changes.
  useEffect(() => {
    if (!selectedUserId) {
      setDetail(null)
      return
    }
    let cancelled = false
    startTransition(async () => {
      const res = await getUserDetail(leagueId, selectedUserId, selectedSeason)
      if (!cancelled) setDetail(res.payload)
    })
    return () => {
      cancelled = true
    }
  }, [selectedUserId, selectedSeason, leagueId])

  // Default page: 'user' if we're focusing on someone, otherwise 'main'.
  const defaultPage = focusUserId ? 'user' : 'main'

  return (
    <ResponsiveSheet
      open={open}
      onClose={onClose}
      panelClassName="glass-intense border-t border-primary/30 md:border md:rounded-2xl"
      sheetMaxHeight="92dvh"
      defaultPage={defaultPage}
    >
      <SheetPage name="main" title="Leaderboard">
        <LeaderboardListPage
          leaderboard={leaderboard}
          currentUserId={currentUserId}
          onSelect={setSelectedUserId}
        />
      </SheetPage>

      <SheetPage name="user">
        {pending && !detail ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-neon-blue" />
          </div>
        ) : detail ? (
          <UserDetailContent
            detail={detail}
            pending={pending}
            availableSeasons={availableSeasons}
            onSeasonChange={setSelectedSeason}
            onOpenLeg={
              onOpenWeek
                ? (parlayId) => {
                    onClose()
                    onOpenWeek(parlayId)
                  }
                : undefined
            }
          />
        ) : null}
      </SheetPage>
    </ResponsiveSheet>
  )
}

// ─── Bet history row (matches Recent Legs row pattern) ────────────────────

const BET_TONE: Record<
  'win' | 'loss' | 'push' | 'pending',
  { border: string; text: string; Icon: LucideIcon }
> = {
  win: { border: 'border-neon-blue/30 hover:border-neon-blue/60', text: 'text-neon-blue', Icon: Trophy },
  loss: { border: 'border-destructive/30 hover:border-destructive/60', text: 'text-destructive', Icon: Skull },
  push: { border: 'border-white/20 hover:border-white/40', text: 'text-foreground/70', Icon: Minus },
  pending: { border: 'border-white/10 hover:border-primary/30', text: 'text-muted-foreground', Icon: Clock },
}

function BetHistoryRow({
  leg,
  onClick,
}: {
  leg: UserDetailPayload['legs'][number]
  onClick?: () => void
}) {
  const tone = BET_TONE[leg.result ?? 'pending']
  const Icon = tone.Icon
  const interactive = !!onClick
  const Tag = interactive ? 'button' : 'div'
  const oddsLabel = leg.odds > 0 ? `+${leg.odds}` : `${leg.odds}`

  return (
    <Tag
      type={interactive ? 'button' : undefined}
      onClick={interactive ? onClick : undefined}
      className={cn(
        'group flex items-center gap-3 w-full rounded-lg border bg-white/[0.02] px-3 py-3 text-left transition-all hover:bg-white/[0.04]',
        tone.border,
        !interactive && 'cursor-default'
      )}
    >
      <Icon aria-hidden className={cn('h-7 w-7 shrink-0', tone.text)} />

      <div className="min-w-0 flex-1">
        <span className="block text-[10px] font-bold tracking-widest uppercase text-muted-foreground mb-1">
          Wk {leg.weekNumber}
        </span>
        <p className="text-sm font-medium text-foreground/90 break-words line-clamp-2">
          {leg.description || 'No description'}
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <span
          className={cn(
            'text-base font-bold tabular-nums leading-none',
            leg.odds > 0 ? 'text-foreground/90' : 'text-muted-foreground'
          )}
        >
          {oddsLabel}
        </span>
        {interactive && (
          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
        )}
      </div>
    </Tag>
  )
}

// ─── Pages ──────────────────────────────────────────────────────────────────

function LeaderboardListPage({
  leaderboard,
  currentUserId,
  onSelect,
}: {
  leaderboard: LeaderboardEntry[]
  currentUserId: string | null
  onSelect: (userId: string) => void
}) {
  const { navigate } = useResponsiveSheet()

  return (
    <div className="px-4 sm:px-5 pt-4 pb-5">
      <div className="mb-4 flex items-center gap-2 text-[10px] font-bold tracking-[0.2em] uppercase text-muted-foreground">
        <Trophy className="h-3 w-3 text-neon-blue" />
        Standings
      </div>
      <div className="space-y-2.5">
        {leaderboard.map((member, index) => {
          let rank = 1
          for (let i = 0; i < index; i++) {
            if (
              leaderboard[i].winRate !== member.winRate ||
              leaderboard[i].wins !== member.wins
            ) {
              rank = i + 2
            }
          }
          const isMe = member.userId === currentUserId
          const rankColor =
            rank === 1
              ? 'text-neon-blue'
              : rank === 2
                ? 'text-gray-300'
                : rank === 3
                  ? 'text-gray-400'
                  : 'text-muted-foreground'

          return (
            <button
              key={member.userId}
              type="button"
              onClick={() => {
                onSelect(member.userId)
                navigate('user')
              }}
              className={cn(
                'group flex w-full items-center gap-3 rounded-lg border bg-white/[0.02] px-3 py-3 text-left transition-all hover:bg-white/[0.04]',
                isMe ? 'border-neon-blue/40 hover:border-neon-blue/60' : 'border-white/10 hover:border-white/20'
              )}
            >
              {/* Rank — clean number, no emojis. Top 3 get medal-color. */}
              <span
                className={cn(
                  'shrink-0 w-7 text-center text-base font-bold tabular-nums leading-none',
                  rankColor
                )}
              >
                #{rank}
              </span>

              <Avatar className="h-9 w-9 shrink-0 ring-1 ring-white/10">
                <AvatarImage src={member.avatarUrl ?? undefined} alt={member.fullName ?? member.email} />
                <AvatarFallback className="bg-primary text-primary-foreground font-bold text-xs">
                  {getInitials(member.fullName, member.email)}
                </AvatarFallback>
              </Avatar>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate flex items-center gap-1.5">
                  {member.fullName ?? member.email}
                  {isMe && (
                    <Badge variant="outline" className="text-[10px] border-neon-blue/40 px-1.5 py-0 text-neon-blue">
                      You
                    </Badge>
                  )}
                </p>
                <p className="text-[11px] text-muted-foreground tabular-nums">
                  {member.wins}W &ndash; {member.losses}L
                  {member.pushes > 0 && ` – ${member.pushes}P`}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span
                  className={cn(
                    'text-base font-bold tabular-nums leading-none',
                    winRateColor(member.winRate)
                  )}
                >
                  {member.winRate.toFixed(1)}%
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function UserDetailContent({
  detail,
  pending,
  availableSeasons,
  onSeasonChange,
  onOpenLeg,
}: {
  detail: UserDetailPayload
  pending: boolean
  availableSeasons?: string[]
  onSeasonChange?: (season: string) => void
  onOpenLeg?: (parlayId: string) => void
}) {
  const { navigate } = useResponsiveSheet()
  const { user, stats, legs, season } = detail
  const fullName = user.fullName ?? user.email

  return (
    <div className={cn('px-4 sm:px-6 pb-6', pending && 'opacity-60 transition-opacity')}>
      {/* Identity hero — name is the member switcher (chevron-down hint). */}
      <div className="flex flex-col items-center gap-3 pt-6 pb-6 text-center">
        <Avatar className="h-20 w-20 ring-4 ring-primary/30">
          <AvatarImage src={user.avatarUrl ?? undefined} alt={fullName} />
          <AvatarFallback className="bg-primary text-primary-foreground font-bold text-2xl">
            {getInitials(user.fullName, user.email)}
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-col items-center">
          <button
            type="button"
            onClick={() => navigate('main')}
            className="group inline-flex max-w-full items-center gap-1.5 text-2xl sm:text-3xl font-bold text-neon-blue break-words transition-colors hover:text-foreground"
            aria-label="Pick a different member"
          >
            <span>{fullName}</span>
            <ChevronDown className="h-5 w-5 sm:h-6 sm:w-6 shrink-0 opacity-70 group-hover:opacity-100 transition-opacity" />
          </button>
          {/* Season picker — native select styled to match the chevron-down
              switcher pattern; sits on its own row beneath the name. */}
          {availableSeasons && availableSeasons.length > 1 && onSeasonChange ? (
            <div className="relative inline-flex items-center mt-1">
              <select
                value={season}
                onChange={(e) => onSeasonChange(e.target.value)}
                className="appearance-none bg-transparent pr-4 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer focus:outline-none"
                aria-label="Select season"
              >
                {availableSeasons.map((s) => (
                  <option key={s} value={s} className="bg-background text-foreground">
                    {s} season
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-0 h-3 w-3 text-muted-foreground/70" />
            </div>
          ) : (
            <p className="text-xs text-muted-foreground mt-0.5">{season} season</p>
          )}
        </div>
        <div className="flex items-baseline gap-1">
          <span className={cn('text-5xl font-bold tabular-nums', winRateColor(stats.winRate))}>
            {stats.winRate.toFixed(1)}
          </span>
          <span className={cn('text-2xl font-bold', winRateColor(stats.winRate))}>%</span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-neon-blue" />
            <span className="font-bold text-foreground">{stats.wins}</span>
            <span className="text-muted-foreground">W</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-neon-pink" />
            <span className="font-bold text-foreground">{stats.losses}</span>
            <span className="text-muted-foreground">L</span>
          </span>
          {stats.pushes > 0 && (
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-gray-400" />
              <span className="font-bold text-foreground">{stats.pushes}</span>
              <span className="text-muted-foreground">P</span>
            </span>
          )}
          {stats.pending > 0 && (
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-muted-foreground" />
              <span className="font-bold text-foreground">{stats.pending}</span>
              <span className="text-muted-foreground">pending</span>
            </span>
          )}
        </div>
      </div>

      {/* Bet history */}
      <div className="border-t border-white/10 pt-4">
        <h3 className="text-[10px] font-bold tracking-[0.2em] uppercase text-muted-foreground mb-3 px-1">
          Bet History
        </h3>
        {legs.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-12">
            No bets submitted this season.
          </p>
        ) : (
          <div className="space-y-2.5">
            {legs.map((leg) => (
              <BetHistoryRow
                key={leg.id}
                leg={leg}
                onClick={onOpenLeg ? () => onOpenLeg(leg.parlayId) : undefined}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
