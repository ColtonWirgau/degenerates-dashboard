'use client'

import { useEffect, useState } from 'react'
import {
  closeLeagueSheet,
  subscribeLeagueSheet,
} from '@/components/chrome/canvas-store'
import {
  LeagueSheet,
  type LeagueSheetMember,
  type LeagueSwitcherRow,
} from '@/components/league-sheet'
import type { CurrentUser } from '@/components/user-menu'
import type { WeekDetailData } from '@/components/week-detail-sheet'
import type { LeaderboardEntry } from '@/components/leaderboard-sheet'
import type { DevPhaseData, DevToolbarData } from '@/lib/data/dev-toolbar-data'

export interface LeagueSheetHostProps {
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

/**
 * The ONE mounted LeagueSheet for the whole shell. Every trigger — the
 * avatar notch, the masthead avatar, the dock's LEAGUE cell — opens it
 * through the canvas-store channel instead of owning a copy.
 */
export function LeagueSheetHost(props: LeagueSheetHostProps) {
  const [open, setOpen] = useState(false)
  useEffect(() => subscribeLeagueSheet(setOpen), [])

  return <LeagueSheet open={open} onClose={closeLeagueSheet} {...props} />
}
