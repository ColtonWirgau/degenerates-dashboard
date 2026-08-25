'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import {
  setSwitchingSeason,
  setViewedWeek,
  subscribeStageView,
  subscribeSwitchingSeason,
  subscribeViewedWeek,
  type StageView,
} from '@/components/chrome/canvas-store'

/**
 * Fuel for the card-edge chrome and the dock.
 *
 * The app is week-shaped, so the chrome is too: it holds the season's
 * WEEKS, and every bubble reads the one you're looking at. A week decides
 * what the chrome even offers — the preseason week has no slate, so no
 * submit and no lay, and the rail closes up to a single rung.
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
  /** Open votes in this week. The preseason dock's disc wears it;
   *  nothing else does, now that the POLLS rung is gone. */
  openPollCount: number
}

export interface PodiumMember {
  userId: string
  fullName: string | null
  email: string
  avatarUrl: string | null
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
  /** Top three of the season, in order. Empty until somebody has a
   *  result — a podium of three 0–0 records is not a podium. */
  podium: PodiumMember[]
  me: {
    id: string
    fullName: string | null
    email: string
    avatarUrl: string | null
  }
  /** A season change is in flight: `season` is already the new year, but
   *  every other field on here still describes the old one. Anything
   *  showing a NUMBER should show a skeleton instead until this clears. */
  switching: boolean
}

const LeagueChromeContext = createContext<LeagueChrome | null>(null)

/**
 * Holds the chrome, and holds the seam between the year and the data
 * behind it.
 *
 * `value` comes from the server, so it only changes when a refresh lands.
 * The store changes the instant you press a year. Between the two, this
 * hands down the new year with the old numbers and a `switching` flag
 * saying so — which is exactly the split the shell needs to repaint its
 * labels immediately and skeleton the rest.
 */
export function LeagueChromeProvider({
  value,
  children,
}: {
  value: Omit<LeagueChrome, 'switching'>
  children: React.ReactNode
}) {
  const [target, setTarget] = useState<string | null>(null)
  useEffect(() => subscribeSwitchingSeason(setTarget), [])

  // The refresh landed. Clearing on the DATA arriving rather than on the
  // transition ending means the skeletons lift exactly when there's
  // something real to put in their place, not a frame early.
  const arrived = target !== null && value.season === target
  useEffect(() => {
    if (arrived) setSwitchingSeason(null)
  }, [arrived])

  const switching = target !== null && !arrived
  const chrome = useMemo<LeagueChrome>(
    () => ({ ...value, season: switching ? target! : value.season, switching }),
    [value, switching, target]
  )

  return <LeagueChromeContext.Provider value={chrome}>{children}</LeagueChromeContext.Provider>
}

export function useLeagueChrome(): LeagueChrome | null {
  return useContext(LeagueChromeContext)
}

/**
 * Is the stage showing the season rather than a week?
 *
 * The rule has two halves and both matter: an explicit pick wins, and
 * with no pick the SEASON decides — one that's over opens on its recap.
 * It lives here because four surfaces need the same answer (the stage,
 * the week list, the rail, the dock) and four copies of a two-clause
 * rule is three chances for them to disagree about what's on screen.
 */
export function useOnRecap(): boolean {
  const chrome = useLeagueChrome()
  const [view, setView] = useState<StageView | null>(null)
  useEffect(() => subscribeStageView(setView), [])

  if (view !== null) return view === 'recap'
  const weeks = chrome?.weeks ?? []
  return weeks.length > 0 && weeks.every((w) => w.closed)
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
