// THE WEEK'S LOCK.
//
// A week closes when the person placing the league's bet closes it —
// "no more entries, I'm putting the ticket in". That's a decision
// somebody makes, so it's stamped (league_weeks.locked_at), not derived.
// An earlier version of this file derived a deadline from the schedule
// and closed the week when it passed; that modelled a clock, not the
// league, and it's gone.
//
// What survives here is the slate predicate — which games this league
// bets — because the slate is genuinely a rule about the schedule, and
// the first in-slate kickoff is still worth showing as the nudge to go
// lock the thing.

import { db } from '@/db/client'
import { nflGames, leagues, leagueWeeks } from '@/db/schema'
import { and, asc, eq } from 'drizzle-orm'

export interface SlateConfig {
  slateDaysIncluded: string[]
  slateIncludeHolidays: boolean
}

/** The one slate-membership predicate. The week slate UI and the
 *  first-kickoff lookup both filter through here so they can't drift. */
export function isInSlate(
  game: { scheduledDay: string; isHolidayGame: boolean },
  config: Pick<SlateConfig, 'slateDaysIncluded' | 'slateIncludeHolidays'>
): boolean {
  return (
    config.slateDaysIncluded.includes(game.scheduledDay) ||
    (config.slateIncludeHolidays && game.isHolidayGame)
  )
}

/**
 * When the first game this league bets on kicks off.
 *
 * Not a deadline — nothing closes when it passes. It's the "you probably
 * want to lock this soon" fact, and the line past which reopening a
 * closed week stops making sense because the games are underway.
 */
export async function firstSlateKickoff(
  leagueId: string,
  nflWeekId: string
): Promise<Date | null> {
  const [league] = await db
    .select({
      slateDaysIncluded: leagues.slateDaysIncluded,
      slateIncludeHolidays: leagues.slateIncludeHolidays,
    })
    .from(leagues)
    .where(eq(leagues.id, leagueId))
    .limit(1)
  if (!league) throw new Error(`firstSlateKickoff: league ${leagueId} not found`)

  const games = await db
    .select({
      kickoff: nflGames.kickoff,
      scheduledDay: nflGames.scheduledDay,
      isHolidayGame: nflGames.isHolidayGame,
    })
    .from(nflGames)
    .where(eq(nflGames.nflWeekId, nflWeekId))
    .orderBy(asc(nflGames.kickoff))

  return games.find((g) => isInSlate(g, league))?.kickoff ?? null
}

/**
 * When this week was closed to new entries, or null while it's open.
 *
 * The one read path, so everything downstream — parlay state, the
 * header, submitLeg's enforcement — agrees on whether a week is taking
 * legs.
 */
export async function getWeekLock(
  leagueId: string,
  nflWeekId: string
): Promise<Date | null> {
  const row = await db
    .select({ lockedAt: leagueWeeks.lockedAt })
    .from(leagueWeeks)
    .where(
      and(eq(leagueWeeks.leagueId, leagueId), eq(leagueWeeks.nflWeekId, nflWeekId))
    )
    .limit(1)
  return row[0]?.lockedAt ?? null
}

/**
 * Close a week, or reopen it.
 *
 * Reopening is refused once the first in-slate game has kicked off: at
 * that point the ticket is down and the results are arriving, so taking
 * new entries would be letting people bet on games they've watched.
 */
export async function setWeekLocked(
  leagueId: string,
  nflWeekId: string,
  locked: boolean,
  now: Date
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!locked) {
    const kickoff = await firstSlateKickoff(leagueId, nflWeekId)
    if (kickoff !== null && kickoff <= now) {
      return { ok: false, error: 'These games have already kicked off.' }
    }
  }

  const at = locked ? now : null
  const existing = await db
    .select({ leagueId: leagueWeeks.leagueId })
    .from(leagueWeeks)
    .where(
      and(eq(leagueWeeks.leagueId, leagueId), eq(leagueWeeks.nflWeekId, nflWeekId))
    )
    .limit(1)

  if (existing[0]) {
    await db
      .update(leagueWeeks)
      .set({ lockedAt: at })
      .where(
        and(eq(leagueWeeks.leagueId, leagueId), eq(leagueWeeks.nflWeekId, nflWeekId))
      )
  } else {
    await db.insert(leagueWeeks).values({ leagueId, nflWeekId, lockedAt: at })
  }
  return { ok: true }
}
