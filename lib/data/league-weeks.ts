/**
 * THE WEEK LIST — the app's spine.
 *
 * Everything you can look at in this app is a week, so there needs to be
 * one place that says what the weeks ARE. This is it: week 0 (preseason,
 * no games, where the league settles its own business) followed by the
 * regular season, each carrying the facts the chrome needs to describe it
 * — whether a parlay exists, how many people are in, how many polls are
 * waiting.
 *
 * Playoff weeks are deliberately absent: this league only ever parlays
 * regular-season slates.
 *
 * Direct-db (like lib/lock-time.ts and lib/data/week-slate.ts) rather than
 * a DataAdapter method — it's a join across four tables that only means
 * anything in neon mode.
 */

import { and, eq, inArray, sql } from 'drizzle-orm'
import { db } from '@/db/client'
import { nflWeeks, parlayLegs, parlays, polls } from '@/db/schema'
import { getDevNow } from '@/lib/data/dev-now'

export interface LeagueWeekRow {
  /** The canonical id — this is what week URLs carry. */
  nflWeekId: string
  /** 0 = preseason. */
  weekNumber: number
  kind: 'preseason' | 'regular'
  season: string
  startDate: string | null
  endDate: string | null
  /** Null until someone opens the week (parlays are created lazily) and
   *  always null for the preseason week, which has no slate to bet. */
  parlayId: string | null
  /** How many members have a leg in. */
  submissionCount: number
  /** Polls that live in this week and are still open. */
  openPollCount: number
  /** Every poll in the week, open or closed. */
  pollCount: number
}

/** A week with no games is a week with no slate, no lock and no parlay. */
export function isPreseasonWeek(week: { kind: string }): boolean {
  return week.kind === 'preseason'
}

/**
 * Every week of a season, preseason first. Ordered the way the season
 * runs; the panels reverse it when they want newest-first.
 */
export async function getLeagueWeeks(
  leagueId: string,
  season: string
): Promise<LeagueWeekRow[]> {
  const weekRows = await db
    .select({
      id: nflWeeks.id,
      weekNumber: nflWeeks.weekNumber,
      kind: nflWeeks.kind,
      season: nflWeeks.season,
      startDate: nflWeeks.startDate,
      endDate: nflWeeks.endDate,
    })
    .from(nflWeeks)
    .where(
      and(
        eq(nflWeeks.season, season),
        inArray(nflWeeks.kind, ['preseason', 'regular'])
      )
    )
    .orderBy(nflWeeks.weekNumber)

  if (weekRows.length === 0) return []
  const weekIds = weekRows.map((w) => w.id)

  const [parlayRows, legCounts, pollCounts] = await Promise.all([
    db
      .select({ id: parlays.id, nflWeekId: parlays.nflWeekId })
      .from(parlays)
      .where(and(eq(parlays.leagueId, leagueId), inArray(parlays.nflWeekId, weekIds))),
    db
      .select({
        nflWeekId: parlays.nflWeekId,
        n: sql<number>`count(*)::int`,
      })
      .from(parlayLegs)
      .innerJoin(parlays, eq(parlays.id, parlayLegs.parlayId))
      .where(and(eq(parlays.leagueId, leagueId), inArray(parlays.nflWeekId, weekIds)))
      .groupBy(parlays.nflWeekId),
    db
      .select({
        nflWeekId: polls.nflWeekId,
        total: sql<number>`count(*)::int`,
        open: sql<number>`count(*) filter (where ${polls.status} = 'open')::int`,
      })
      .from(polls)
      .where(and(eq(polls.leagueId, leagueId), inArray(polls.nflWeekId, weekIds)))
      .groupBy(polls.nflWeekId),
  ])

  const parlayByWeek = new Map(parlayRows.map((p) => [p.nflWeekId, p.id]))
  const legsByWeek = new Map(legCounts.map((r) => [r.nflWeekId, r.n]))
  const pollsByWeek = new Map(
    pollCounts.map((r) => [r.nflWeekId!, { total: r.total, open: r.open }])
  )

  return weekRows.map((w) => ({
    nflWeekId: w.id,
    weekNumber: w.weekNumber,
    kind: w.kind as 'preseason' | 'regular',
    season: w.season,
    startDate: w.startDate?.toISOString() ?? null,
    endDate: w.endDate?.toISOString() ?? null,
    parlayId: parlayByWeek.get(w.id) ?? null,
    submissionCount: legsByWeek.get(w.id) ?? 0,
    openPollCount: pollsByWeek.get(w.id)?.open ?? 0,
    pollCount: pollsByWeek.get(w.id)?.total ?? 0,
  }))
}

/**
 * Which week is it right now, for this season?
 *
 * The windows tile the whole year — preseason runs from the last season's
 * final whistle to week 1's kickoff — so within the current season this
 * always lands on a real week. Looking at a past season, "now" is off the
 * end of it, so the answer is the last week that happened.
 */
export async function pickCurrentWeek(
  weeks: LeagueWeekRow[]
): Promise<LeagueWeekRow | null> {
  if (weeks.length === 0) return null
  const now = await getDevNow()

  const containing = weeks.find(
    (w) =>
      w.startDate &&
      w.endDate &&
      new Date(w.startDate) <= now &&
      now <= new Date(w.endDate)
  )
  if (containing) return containing

  // Between windows (the Tuesday-to-Thursday gap) → the next one up.
  const upcoming = weeks.find((w) => w.startDate && now < new Date(w.startDate))
  if (upcoming) return upcoming

  return weeks[weeks.length - 1]!
}

/** The season's preseason week — the home for league business. */
export function preseasonWeekOf(weeks: LeagueWeekRow[]): LeagueWeekRow | null {
  return weeks.find((w) => w.kind === 'preseason') ?? null
}
