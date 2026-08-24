'use client'

import { createContext, useContext } from 'react'

/**
 * Fuel for the card-edge chrome and the dock: the small live facts each
 * bubble/cell wears (week number, your rank, open-poll count) plus the ids
 * the chrome needs to navigate. Provided by the league layout, consumed by
 * PanelBubbles / ActionBubble / MobileDock / Masthead — same pattern as
 * RoarTracker's BubbleProvider.
 */
export type LeagueChrome = {
  leagueId: string
  leagueName: string
  season: string
  seasonKind: 'offseason' | 'preseason' | 'regular-season' | 'playoffs' | 'super-bowl'
  /** Current week number, in-season only. */
  weekNumber: number | null
  /** URL id of the current week (the parlay id), in-season only. */
  currentWeekId: string | null
  /** Whether the viewer already has a locked leg this week. */
  submitted: boolean
  /** True lock moment for the current week (ISO), null = TBD. */
  lockAt: string | null
  /** The viewer's leaderboard rank, 1-based; null when unranked. */
  myRank: number | null
  memberCount: number
  submittedCount: number
  openPollCount: number
  me: {
    id: string
    fullName: string | null
    email: string
    avatarUrl: string | null
  }
}

const LeagueChromeContext = createContext<LeagueChrome | null>(null)

export function LeagueChromeProvider({
  value,
  children,
}: {
  value: LeagueChrome
  children: React.ReactNode
}) {
  return <LeagueChromeContext.Provider value={value}>{children}</LeagueChromeContext.Provider>
}

export function useLeagueChrome(): LeagueChrome | null {
  return useContext(LeagueChromeContext)
}
