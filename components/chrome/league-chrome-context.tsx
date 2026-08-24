'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { setViewedWeek, subscribeViewedWeek } from '@/components/chrome/canvas-store'

/**
 * Fuel for the card-edge chrome and the dock.
 *
 * The app is week-shaped, so the chrome is too: it holds the season's
 * WEEKS, and every bubble reads the one you're looking at. A week decides
 * what the chrome even offers — the preseason week has no slate, so no
 * submit; a week with no polls shows no POLLS bubble.
 *
 * Provided by the league layout, consumed by PanelBubbles / ActionBubble /
 * MobileDock / Masthead — same pattern as RoarTracker's BubbleProvider.
 */
export type ChromeWeek = {
  /** The canonical week id — what week URLs carry. */
  id: string
  /** 0 = preseason. */
  weekNumber: number
  kind: 'preseason' | 'regular'
  /** A week with games. False for the preseason week — it has no slate,
   *  no lock and nothing to submit. */
  hasSlate: boolean
  /** Null until the week is opened; always null for preseason. */
  parlayId: string | null
  parlayState: 'open' | 'locked' | 'graded' | 'won' | 'lost'
  submissionCount: number
  /** The viewer's own result, null while pending or absent. */
  myResult: 'win' | 'loss' | 'push' | null
  /** Whether the viewer already has a leg in for this week. */
  submitted: boolean
  /** True lock moment (ISO), null = TBD or no slate. */
  lockAt: string | null
  /** The week's window has passed. Preseason has no lock to be past, so
   *  without this a finished season's week 0 reads "Open" forever. */
  closed: boolean
  openPollCount: number
  pollCount: number
}

export type LeagueChrome = {
  leagueId: string
  leagueName: string
  season: string
  seasonKind: 'offseason' | 'preseason' | 'regular-season' | 'playoffs' | 'super-bowl'
  /** Every week of the displayed season, preseason first. */
  weeks: ChromeWeek[]
  /** The week the season is actually on right now. */
  currentWeekId: string | null
  /** The viewer's leaderboard rank, 1-based; null when unranked. */
  myRank: number | null
  memberCount: number
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

/**
 * The week the card is showing.
 *
 * The app is a single page, so this is state, not a route: the season's
 * current week until you pick another, and everything — the rail, the
 * dock, the panels, the stage — reads it from the one place.
 */
export function useViewedWeek(): ChromeWeek | null {
  const chrome = useLeagueChrome()
  const [id, setId] = useState<string | null>(null)
  useEffect(() => subscribeViewedWeek(setId), [])

  // Switching seasons replaces the whole week list, so a week you were
  // looking at in 2026 doesn't exist in 2025. Drop the stale pick rather
  // than showing nothing: the chrome and the stage both fall back to the
  // new season's current week, and they fall back together.
  const stale = id != null && chrome != null && !chrome.weeks.some((w) => w.id === id)
  useEffect(() => {
    if (stale) setViewedWeek(null)
  }, [stale])

  if (!chrome) return null
  const target = stale || id == null ? chrome.currentWeekId : id
  return chrome.weeks.find((w) => w.id === target) ?? null
}
