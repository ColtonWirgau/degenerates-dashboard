// Nightly Vercel Cron job. Schedule defined in `vercel.json`:
//   /api/cron/refresh-schedule runs every night at 09:00 UTC.
//
// What it does:
//   1. Re-pulls the NFL schedule from ESPN for the current season
//   2. Upserts nfl_weeks + nfl_games (postponements, flex moves, scores)
//
// It used to also recompute a derived lock time per league × week. It
// doesn't any more: a week closes when the person placing the bet closes
// it, and no nightly job can know when that happens.
//
// Auth: Vercel Cron sends a header `Authorization: Bearer $CRON_SECRET`.
// In dev / local you can hit this with `curl -H "Authorization: Bearer $CRON_SECRET"`.

import { NextResponse } from 'next/server'
import { syncSeason } from '@/lib/nfl-schedule'

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

  return NextResponse.json({
    ok: true,
    season: schedule.season,
    games: schedule.totalGames,
    weeksTouched: schedule.weeksTouched.length,
    elapsedMs: Date.now() - startedAt,
  })
}
