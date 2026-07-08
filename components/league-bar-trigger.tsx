'use client'

import { useState } from 'react'
import { LeagueAvatar } from '@/components/league-avatar'
import { LeagueSheet, type LeagueSheetMember } from '@/components/league-sheet'
import type { WeekDetailData } from '@/components/week-detail-sheet'
import type { LeaderboardEntry } from '@/components/leaderboard-sheet'
import { ChevronDown } from 'lucide-react'

interface LeagueBarTriggerProps {
  leagueId: string
  leagueName: string
  memberCount: number
  season: string
  inviteCode: string
  canManage: boolean
  weeks: WeekDetailData[]
  currentWeekIndex: number
  members: LeagueSheetMember[]
  currentUserId: string
  leaderboard: LeaderboardEntry[]
  availableSeasons: string[]
}

/**
 * Compact league chip that sits in the page top bar, just left of the user
 * avatar. Mobile: league avatar + chevron. Desktop: + truncated league name.
 * Tap → opens `<LeagueSheet>`.
 */
export function LeagueBarTrigger(props: LeagueBarTriggerProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`${props.leagueName} — open league details`}
        className="group flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] py-1 pl-1 pr-2 transition-all hover:border-primary/40 hover:bg-white/[0.06]"
      >
        <LeagueAvatar leagueId={props.leagueId} size="sm" />
        <span className="hidden sm:inline max-w-[14ch] truncate text-xs font-bold text-foreground group-hover:text-neon-blue transition-colors">
          {props.leagueName}
        </span>
        <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground transition-colors group-hover:text-neon-blue" />
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
        weeks={props.weeks}
        currentWeekIndex={props.currentWeekIndex}
        members={props.members}
        currentUserId={props.currentUserId}
        leaderboard={props.leaderboard}
        availableSeasons={props.availableSeasons}
      />
    </>
  )
}
