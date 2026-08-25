'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { SCENARIO_COOKIE } from '@/lib/data/active-scenario'
import { MOCK_USER_COOKIE } from '@/lib/data/auth-bridge'
import { DEV_NOW_COOKIE, DEV_PHASE_COOKIE } from '@/lib/data/dev-now'
import type { DevSeasonPhase } from '@/lib/data/dev-toolbar-data'

export async function setScenario(id: string) {
  const c = await cookies()
  c.set(SCENARIO_COOKIE, id, { path: '/', maxAge: 60 * 60 * 24 * 30 })
  revalidatePath('/', 'layout')
}

export async function setMockUser(userId: string) {
  const c = await cookies()
  c.set(MOCK_USER_COOKIE, userId, { path: '/', maxAge: 60 * 60 * 24 * 30 })
  revalidatePath('/', 'layout')
}


const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Dev-only (neon mode): time-travel the season-state reads to a chosen
 * phase by pinning a fake *now* derived from the real nfl_weeks schedule.
 * 'auto' clears the override.
 */
export async function setSeasonPhase(phase: DevSeasonPhase) {
  if (process.env.NODE_ENV !== 'development') return
  const c = await cookies()
  if (phase === 'auto') {
    c.delete(DEV_NOW_COOKIE)
    c.delete(DEV_PHASE_COOKIE)
    revalidatePath('/', 'layout')
    return
  }

  const { db } = await import('@/db/client')
  const { nflWeeks, parlays } = await import('@/db/schema')
  const byYearDesc = (a: string, b: string) =>
    parseInt(b.split('-')[0]!, 10) - parseInt(a.split('-')[0]!, 10)

  const allWeeks = await db.select().from(nflWeeks)
  const withData = await db
    .selectDistinct({ season: nflWeeks.season })
    .from(nflWeeks)
    .innerJoin(parlays, eq(parlays.nflWeekId, nflWeeks.id))
  const dataSeasons = withData.map((r) => r.season).sort(byYearDesc)
  const allSeasons = [...new Set(allWeeks.map((w) => w.season))].sort(byYearDesc)

  // Which week kinds the phase needs to exist in the target season.
  const requiredKinds: Record<string, string[]> = {
    'regular-season': ['regular'],
    playoffs: ['wildcard', 'divisional', 'conference'],
    'super-bowl': ['super-bowl'],
  }
  const required = requiredKinds[phase] ?? []
  const seasonWorks = (season: string) =>
    required.length === 0
      ? allWeeks.some((w) => w.season === season && w.startDate)
      : allWeeks.some(
          (w) => w.season === season && required.includes(w.kind) && w.startDate
        )

  // In-season phases preview the latest season that actually has league
  // data (parlays) — falling back to any season with the needed weeks —
  // so the page isn't a wall of empty states. Off/preseason use the
  // latest (upcoming) season, matching real life.
  const inSeasonPhase = required.length > 0
  const ordered = inSeasonPhase
    ? [...dataSeasons, ...allSeasons.filter((x) => !dataSeasons.includes(x))]
    : allSeasons
  const focus = ordered.find(seasonWorks)
  if (!focus) return
  const weeks = allWeeks
    .filter((w) => w.season === focus)
    .sort((a, b) => a.weekNumber - b.weekNumber)

  const first = weeks.find((w) => w.startDate)?.startDate
  if (!first) return
  const regular = weeks.filter((w) => w.kind === 'regular' && w.startDate)
  const playoffWeek = weeks.find(
    (w) =>
      (w.kind === 'wildcard' || w.kind === 'divisional' || w.kind === 'conference') &&
      w.startDate
  )
  const superBowl = weeks.find((w) => w.kind === 'super-bowl' && w.startDate)

  // Land 12h after the phase's first kickoff so we're solidly inside it.
  const inside = (d: Date) => new Date(d.getTime() + 12 * 60 * 60 * 1000)
  const fakeNow: Date | null =
    phase === 'offseason'
      ? new Date(first.getTime() - 90 * DAY_MS)
      : phase === 'preseason'
        ? new Date(first.getTime() - 14 * DAY_MS)
        : phase === 'regular-season'
          ? inside((regular[4] ?? regular[0])?.startDate ?? first)
          : phase === 'playoffs'
            ? playoffWeek?.startDate
              ? inside(playoffWeek.startDate)
              : null
            : superBowl?.startDate
              ? inside(superBowl.startDate)
              : null
  if (!fakeNow) return

  c.set(DEV_NOW_COOKIE, fakeNow.toISOString(), { path: '/', maxAge: 60 * 60 * 24 })
  c.set(DEV_PHASE_COOKIE, phase, { path: '/', maxAge: 60 * 60 * 24 })
  revalidatePath('/', 'layout')
}
