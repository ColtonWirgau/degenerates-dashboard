// Live score refresh for the week currently being watched.
//
// Deliberately NOT a cron: Vercel's free tier only runs crons daily, and a
// minute-level ticker would burn invocations all week for the ~6 hours a
// slate is actually live. Instead the clients watching a slate pull this,
// and a module-level throttle collapses all of them into at most one ESPN
// call per week per REFRESH_INTERVAL_MS. Twelve people watching the same
// slate cost the same as one.
//
// ESPN's public scoreboard endpoint is free and unauthenticated — the same
// one lib/nfl-schedule.ts uses for the nightly sync.

import { db } from '@/db/client'
import { nflGames, nflWeeks } from '@/db/schema'
import { and, eq } from 'drizzle-orm'
import { WEEK_CATALOG, fetchWeek } from '@/lib/nfl-schedule'

/** Don't hit ESPN more often than this per week, however many viewers. */
const REFRESH_INTERVAL_MS = 25_000

/** A game is "watchable" from kickoff until this long after. */
const GAME_WINDOW_MS = 5 * 60 * 60 * 1000

type Throttle = { at: number; inFlight: Promise<void> | null }
const throttles = new Map<string, Throttle>()

export interface LiveGame {
  id: string
  status: 'scheduled' | 'in-progress' | 'final' | 'postponed' | 'canceled'
  homeScore: number | null
  awayScore: number | null
  period: number | null
  displayClock: string | null
}

export interface LiveWeekPayload {
  weekId: string
  games: LiveGame[]
  /** True while any game is in progress — clients poll faster. */
  anyLive: boolean
  /** True when kickoffs are near/underway; clients stop polling otherwise. */
  windowOpen: boolean
  refreshedAt: string
}

function mapStatus(
  name?: string
): LiveGame['status'] {
  switch (name) {
    case 'STATUS_SCHEDULED':
      return 'scheduled'
    case 'STATUS_IN_PROGRESS':
    case 'STATUS_HALFTIME':
    case 'STATUS_END_PERIOD':
    case 'STATUS_DELAYED':
      return 'in-progress'
    case 'STATUS_FINAL':
    case 'STATUS_FULL_TIME':
      return 'final'
    case 'STATUS_POSTPONED':
      return 'postponed'
    case 'STATUS_CANCELED':
    case 'STATUS_FORFEIT':
      return 'canceled'
    default:
      return 'scheduled'
  }
}

/**
 * Whether this week is worth refreshing at all: some game has kicked off
 * within the window, or is about to. Outside it we serve straight from the
 * DB and tell the client to stop polling.
 */
async function windowIsOpen(nflWeekId: string, now: number): Promise<boolean> {
  const rows = await db
    .select({ kickoff: nflGames.kickoff, status: nflGames.status })
    .from(nflGames)
    .where(eq(nflGames.nflWeekId, nflWeekId))
  return rows.some((g) => {
    if (g.status === 'in-progress') return true
    const k = g.kickoff.getTime()
    return now >= k - 60_000 && now <= k + GAME_WINDOW_MS
  })
}

/** Pull ESPN for this week and write through only what actually changed. */
async function refreshFromEspn(nflWeekId: string): Promise<void> {
  const [week] = await db
    .select({ season: nflWeeks.season, weekNumber: nflWeeks.weekNumber })
    .from(nflWeeks)
    .where(eq(nflWeeks.id, nflWeekId))
    .limit(1)
  if (!week) return

  const spec = WEEK_CATALOG.find((w) => w.weekNumber === week.weekNumber)
  if (!spec) return
  const year = parseInt(week.season.split('-')[0]!, 10)

  const events = await fetchWeek(year, spec)
  if (events.length === 0) return

  const existing = await db
    .select({
      id: nflGames.id,
      status: nflGames.status,
      homeScore: nflGames.homeScore,
      awayScore: nflGames.awayScore,
      period: nflGames.period,
      displayClock: nflGames.displayClock,
    })
    .from(nflGames)
    .where(eq(nflGames.nflWeekId, nflWeekId))
  const byId = new Map(existing.map((g) => [g.id, g]))

  for (const ev of events) {
    const prev = byId.get(ev.id)
    if (!prev) continue // a brand-new event id is the nightly sync's job

    const comp = ev.competitions?.[0]
    const espnStatus = ev.status ?? comp?.status
    const status = mapStatus(espnStatus?.type?.name)
    const played = status === 'in-progress' || status === 'final'
    const home = comp?.competitors.find((c) => c.homeAway === 'home')
    const away = comp?.competitors.find((c) => c.homeAway === 'away')
    const score = (raw: string | number | undefined) => {
      if (!played || raw == null) return null
      const n = parseInt(String(raw), 10)
      return Number.isFinite(n) ? n : null
    }
    const next = {
      status,
      homeScore: score(home?.score),
      awayScore: score(away?.score),
      period: played && espnStatus?.period != null ? espnStatus.period : null,
      displayClock:
        status === 'in-progress' ? (espnStatus?.displayClock ?? null) : null,
    }

    const unchanged =
      prev.status === next.status &&
      prev.homeScore === next.homeScore &&
      prev.awayScore === next.awayScore &&
      prev.period === next.period &&
      prev.displayClock === next.displayClock
    if (unchanged) continue

    await db
      .update(nflGames)
      .set({
        ...next,
        // Stamp the moment we first saw it final, for "just ended" copy.
        ...(next.status === 'final' && prev.status !== 'final'
          ? { finalAt: new Date() }
          : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(nflGames.id, ev.id), eq(nflGames.nflWeekId, nflWeekId)))
  }
}

/**
 * Current live state for a week. Refreshes from ESPN at most once per
 * REFRESH_INTERVAL_MS across all callers, and only while the slate window
 * is open; otherwise returns what the nightly sync already stored.
 */
export async function getLiveWeek(nflWeekId: string): Promise<LiveWeekPayload> {
  const now = Date.now()
  const open = await windowIsOpen(nflWeekId, now)

  if (open) {
    const t = throttles.get(nflWeekId)
    if (t?.inFlight) {
      // Someone else is already asking ESPN — ride along on their answer.
      await t.inFlight.catch(() => {})
    } else if (!t || now - t.at > REFRESH_INTERVAL_MS) {
      const inFlight = refreshFromEspn(nflWeekId)
        .catch((err) => {
          // A flaky upstream shouldn't 500 the page — serve stale.
          console.warn('[live-scores] ESPN refresh failed:', err)
        })
        .finally(() => {
          const cur = throttles.get(nflWeekId)
          if (cur) cur.inFlight = null
        })
      throttles.set(nflWeekId, { at: now, inFlight })
      await inFlight
    }
  }

  const rows = await db
    .select({
      id: nflGames.id,
      status: nflGames.status,
      homeScore: nflGames.homeScore,
      awayScore: nflGames.awayScore,
      period: nflGames.period,
      displayClock: nflGames.displayClock,
    })
    .from(nflGames)
    .where(eq(nflGames.nflWeekId, nflWeekId))

  return {
    weekId: nflWeekId,
    games: rows,
    anyLive: rows.some((g) => g.status === 'in-progress'),
    windowOpen: open,
    refreshedAt: new Date().toISOString(),
  }
}
