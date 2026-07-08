// Lock-time derivation. Given a league's slate config + the NFL schedule
// for a given week, returns the moment the parlay should lock.
//
// Rules:
//   1. Collect every game whose scheduled day is in `slateDaysIncluded`.
//   2. If `slateIncludeHolidays` is true, also include any game flagged
//      `is_holiday_game = true` (Thanksgiving / Black Friday / Christmas)
//      regardless of weekday. This is the "we'll still bet the Thursday
//      Thanksgiving game even though we don't bet TNFs in general" rule.
//   3. The lock moment is `earliest in-slate kickoff − lock_offset_minutes`.
//   4. If no in-slate games exist (flex week, postseason mismatch, etc.),
//      return null — the cache row is left null and the UI shows TBD.

import { db } from '@/db/client'
import { nflGames, leagues, leagueWeeks } from '@/db/schema'
import { and, eq } from 'drizzle-orm'

export interface SlateConfig {
  slateDaysIncluded: string[]
  slateIncludeHolidays: boolean
  lockOffsetMinutes: number
}

export interface LockComputation {
  lockAt: Date | null
  /** Kickoff that drove the calculation — useful for "Locks at 12:50p (PHI@DAL)" copy. */
  anchorGameId: string | null
  anchorKickoff: Date | null
}

export async function computeLockAt(
  leagueId: string,
  nflWeekId: string
): Promise<LockComputation> {
  const [league] = await db
    .select({
      slateDaysIncluded: leagues.slateDaysIncluded,
      slateIncludeHolidays: leagues.slateIncludeHolidays,
      lockOffsetMinutes: leagues.lockOffsetMinutes,
    })
    .from(leagues)
    .where(eq(leagues.id, leagueId))
    .limit(1)

  if (!league) {
    throw new Error(`computeLockAt: league ${leagueId} not found`)
  }

  const games = await db
    .select({
      id: nflGames.id,
      kickoff: nflGames.kickoff,
      scheduledDay: nflGames.scheduledDay,
      isHolidayGame: nflGames.isHolidayGame,
    })
    .from(nflGames)
    .where(eq(nflGames.nflWeekId, nflWeekId))

  const eligible = games.filter((g) => {
    const inSlate = league.slateDaysIncluded.includes(g.scheduledDay)
    const holiday = league.slateIncludeHolidays && g.isHolidayGame
    return inSlate || holiday
  })

  if (eligible.length === 0) {
    return { lockAt: null, anchorGameId: null, anchorKickoff: null }
  }

  // Earliest kickoff drives the lock. The "earliest" needs to be a real
  // kickoff — synthetic 0/null kickoffs would skew this, but nfl_games
  // requires kickoff NOT NULL so we can trust the field.
  const sorted = eligible.slice().sort((a, b) => a.kickoff.getTime() - b.kickoff.getTime())
  const anchor = sorted[0]
  const lockAt = new Date(anchor.kickoff.getTime() - league.lockOffsetMinutes * 60_000)
  return { lockAt, anchorGameId: anchor.id, anchorKickoff: anchor.kickoff }
}

export async function persistLockAt(
  leagueId: string,
  nflWeekId: string,
  lockAt: Date | null
) {
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
      .set({ lockAtCached: lockAt, computedAt: new Date() })
      .where(
        and(eq(leagueWeeks.leagueId, leagueId), eq(leagueWeeks.nflWeekId, nflWeekId))
      )
  } else {
    await db.insert(leagueWeeks).values({
      leagueId,
      nflWeekId,
      lockAtCached: lockAt,
      computedAt: new Date(),
    })
  }
}
