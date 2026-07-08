'use client'

import { useMemo, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { ConnectedDots, type ConnectedDotsResult } from '@/components/connected-dots'
import { LeaderboardSheet, type LeaderboardEntry } from '@/components/leaderboard-sheet'
import { WeekDetailSheet, type WeekDetailData } from '@/components/week-detail-sheet'

interface FinalStandingsProps {
  leagueId: string
  currentUserId: string
  leaderboard: LeaderboardEntry[]
  allWeeksData: WeekDetailData[]
  membersCount: number
  availableSeasons: string[]
  defaultSeason: string
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
 * Final-standings rows for the offseason / preseason path. Each row is
 * tappable to drill into that member's bet history (via LeaderboardSheet's
 * user-detail page), and shows their per-week W/L dot trace inline on
 * wider screens — same primitive as the mid-season Performance section.
 */
export function FinalStandings({
  leagueId,
  currentUserId,
  leaderboard,
  allWeeksData,
  membersCount,
  availableSeasons,
  defaultSeason,
}: FinalStandingsProps) {
  const [leaderboardOpen, setLeaderboardOpen] = useState(false)
  const [focusUserId, setFocusUserId] = useState<string | null>(null)
  const [activeWeek, setActiveWeek] = useState<WeekDetailData | null>(null)

  // Per-member chronological result sequence — feeds the row's dot trace.
  const dotsByUser = useMemo(() => {
    const map = new Map<string, ConnectedDotsResult[]>()
    for (const member of leaderboard) {
      const dots: ConnectedDotsResult[] = []
      for (const week of allWeeksData) {
        const leg = week.legs.find((l) => l.userId === member.userId)
        if (!leg) continue
        dots.push({
          weekNumber: week.week.week_number,
          weekId: week.week.id,
          result: leg.result,
          description: leg.description,
        })
      }
      map.set(member.userId, dots)
    }
    return map
  }, [leaderboard, allWeeksData])

  const openUser = (userId: string) => {
    setFocusUserId(userId)
    setLeaderboardOpen(true)
  }

  const openWeek = (weekId: string) => {
    const data = allWeeksData.find((w) => w.week.id === weekId)
    if (data) setActiveWeek(data)
  }

  return (
    <>
      <div className="space-y-2.5">
        {leaderboard.map((m, i) => {
          const dots = dotsByUser.get(m.userId) ?? []
          const isMe = m.userId === currentUserId
          const rankColor =
            i === 0
              ? 'text-neon-blue'
              : i === 1
                ? 'text-gray-300'
                : i === 2
                  ? 'text-gray-400'
                  : 'text-muted-foreground'

          return (
            <button
              key={m.userId}
              type="button"
              onClick={() => openUser(m.userId)}
              className={cn(
                'group flex w-full items-center gap-3 rounded-lg border bg-white/[0.02] px-3 py-3 text-left transition-all hover:bg-white/[0.04]',
                isMe
                  ? 'border-neon-blue/40 hover:border-neon-blue/60'
                  : 'border-white/10 hover:border-white/20'
              )}
            >
              <span
                className={cn(
                  'shrink-0 w-7 text-center text-base font-bold tabular-nums leading-none',
                  rankColor
                )}
              >
                #{i + 1}
              </span>

              <Avatar className="h-9 w-9 shrink-0 ring-1 ring-white/10">
                <AvatarImage src={m.avatarUrl ?? undefined} alt={m.fullName ?? m.email} />
                <AvatarFallback className="bg-primary text-primary-foreground font-bold text-xs">
                  {getInitials(m.fullName, m.email)}
                </AvatarFallback>
              </Avatar>

              {/* Name block — flexes on mobile (no dots column) so the
                  percent + chevron get pushed all the way right; fixed
                  width on desktop so the dots trace owns the slack. */}
              <div className="flex-1 min-w-0 sm:flex-none sm:w-32">
                <p className="text-sm font-semibold truncate flex items-center gap-1.5">
                  {m.fullName ?? m.email}
                  {isMe && (
                    <Badge variant="outline" className="text-[10px] border-neon-blue/40 px-1.5 py-0 text-neon-blue">
                      You
                    </Badge>
                  )}
                </p>
                <p className="text-[11px] text-muted-foreground tabular-nums">
                  {m.wins}W &ndash; {m.losses}L
                </p>
              </div>

              {/* Dots trace — desktop only. Non-interactive here since the
                  row itself is a <button>; HTML doesn't allow nested buttons.
                  Drilling into a specific week happens via the user-detail
                  sheet that opens when you tap the row. */}
              <div className="hidden sm:block flex-1 min-w-0 px-2">
                <ConnectedDots results={dots} />
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span
                  className={cn(
                    'text-base font-bold tabular-nums leading-none',
                    winRateColor(m.winRate)
                  )}
                >
                  {m.winRate.toFixed(1)}%
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
              </div>
            </button>
          )
        })}
      </div>

      <LeaderboardSheet
        open={leaderboardOpen}
        onClose={() => setLeaderboardOpen(false)}
        leagueId={leagueId}
        leaderboard={leaderboard}
        currentUserId={currentUserId}
        focusUserId={focusUserId}
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
