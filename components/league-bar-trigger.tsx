'use client'

import { useState } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { leagueInitials } from '@/components/league-avatar'
import {
  LeagueSheet,
  type LeagueSheetMember,
  type LeagueSwitcherRow,
} from '@/components/league-sheet'
import type { CurrentUser } from '@/components/user-menu'
import type { WeekDetailData } from '@/components/week-detail-sheet'
import type { LeaderboardEntry } from '@/components/leaderboard-sheet'
import type { DevPhaseData, DevToolbarData } from '@/lib/data/dev-toolbar-data'

interface LeagueBarTriggerProps {
  leagueId: string
  leagueName: string
  memberCount: number
  season: string
  inviteCode: string
  canManage: boolean
  currentUserRole: 'owner' | 'admin' | 'member'
  weeks: WeekDetailData[]
  currentWeekIndex: number
  members: LeagueSheetMember[]
  currentUserId: string
  leaderboard: LeaderboardEntry[]
  availableSeasons: string[]
  leagues: LeagueSwitcherRow[]
  user: CurrentUser
  mock?: DevToolbarData | null
  devPhase?: DevPhaseData | null
}

const userInitials = (name: string | null, email: string) => {
  if (name) {
    const parts = name.split(' ').filter(Boolean)
    if (parts.length >= 2) return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase()
    return name.slice(0, 2).toUpperCase()
  }
  return email.slice(0, 2).toUpperCase()
}

/**
 * The single top-bar trigger: your avatar as the main circle with a
 * small league badge (initials until Sleeper art lands) overlapping its
 * bottom-right corner. Tap → the combined account + league sheet.
 */
export function LeagueBarTrigger(props: LeagueBarTriggerProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`${props.user.fullName ?? props.user.email} — ${props.leagueName}`}
        className="group relative shrink-0"
      >
        <Avatar className="h-10 w-10 ring-2 ring-primary/50 group-hover:ring-primary transition-all cursor-pointer">
          <AvatarImage
            src={props.user.avatarUrl ?? undefined}
            alt={props.user.fullName ?? props.user.email}
          />
          <AvatarFallback className="bg-primary text-primary-foreground font-bold">
            {userInitials(props.user.fullName, props.user.email)}
          </AvatarFallback>
        </Avatar>
        {/* League mini-badge — initials until Sleeper art lands. */}
        <span
          aria-hidden
          className="absolute -bottom-0.5 -right-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#1a1a1e] ring-2 ring-background text-[8px] font-bold text-foreground/90"
        >
          {leagueInitials(props.leagueName)}
        </span>
      </button>

      <LeagueSheet
        open={open}
        onClose={() => setOpen(false)}
        leagueId={props.leagueId}
        leagueName={props.leagueName}
        memberCount={props.memberCount}
        season={props.season}
        inviteCode={props.inviteCode}
        canManage={props.canManage}
        currentUserRole={props.currentUserRole}
        weeks={props.weeks}
        currentWeekIndex={props.currentWeekIndex}
        members={props.members}
        currentUserId={props.currentUserId}
        leaderboard={props.leaderboard}
        availableSeasons={props.availableSeasons}
        leagues={props.leagues}
        user={props.user}
        mock={props.mock}
        devPhase={props.devPhase}
      />
    </>
  )
}
