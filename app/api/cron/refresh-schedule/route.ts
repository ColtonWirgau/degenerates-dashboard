// Nightly Vercel Cron job. Schedule defined in `vercel.json`:
//   /api/cron/refresh-schedule runs every night at 09:00 UTC.
//
// What it does:
//   1. Re-pulls the NFL schedule from ESPN for the current season
//   2. Upserts nfl_weeks + nfl_games (postponements, flex moves, scores)
//   3. Recomputes lock_at_cached for every league × week pair
//
// Auth: Vercel Cron sends a header `Authorization: Bearer $CRON_SECRET`.
// In dev / local you can hit this with `curl -H "Authorization: Bearer $CRON_SECRET"`.

import { NextResponse } from 'next/server'
import { db } from '@/db/client'
import { leagues, nflWeeks } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { syncSeason } from '@/lib/nfl-schedule'
import { computeLockAt, persistLockAt } from '@/lib/lock-time'

// Cron jobs are async-heavy — disable Vercel's default 15s edge timeout.
export const maxDuration = 300

function currentSeasonYear(): number {
  // NFL "season X" = the year the season starts (Sept). Switch over to
  // the new season's data as soon as we're past March of that year, so
  // preseason / schedule release content is correct.
  const now = new Date()
  const yr = now.getUTCFullYear()
  const month = now.getUTCMonth() + 1 // 1..12
  return month >= 4 ? yr : yr - 1
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  const provided = request.headers.get('authorization')
  if (!secret || provided !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startedAt = Date.now()
  const year = currentSeasonYear()
  let schedule: Awaited<ReturnType<typeof syncSeason>>
  try {
    schedule = await syncSeason(year)
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    )
  }

  // Only recompute league_weeks for current-season weeks (past seasons
  // don't change). Cheap: 22 weeks * 3 leagues right now.
  const allLeagues = await db.select({ id: leagues.id }).from(leagues)
  const seasonWeeks = await db
    .select({ id: nflWeeks.id })
    .from(nflWeeks)
    .where(eq(nflWeeks.season, schedule.season))

  let recomputed = 0
  for (const lg of allLeagues) {
    for (const wk of seasonWeeks) {
      const computed = await computeLockAt(lg.id, wk.id)
      await persistLockAt(lg.id, wk.id, computed.lockAt)
      recomputed++
    }
  }

  return NextResponse.json({
    ok: true,
    season: schedule.season,
    games: schedule.totalGames,
    weeksTouched: schedule.weeksTouched.length,
    lockTimesRecomputed: recomputed,
    elapsedMs: Date.now() - startedAt,
  })
}
