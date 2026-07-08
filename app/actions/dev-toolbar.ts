'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { asc, eq } from 'drizzle-orm'
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

  // Focus season = latest by starting year, mirroring getSeasonState.
  const { db } = await import('@/db/client')
  const { nflWeeks } = await import('@/db/schema')
  const seasons = await db.selectDistinct({ season: nflWeeks.season }).from(nflWeeks)
  const focus = seasons
    .map((s) => s.season)
    .sort((a, b) => parseInt(b.split('-')[0]!, 10) - parseInt(a.split('-')[0]!, 10))[0]
  if (!focus) return
  const weeks = await db
    .select()
    .from(nflWeeks)
    .where(eq(nflWeeks.season, focus))
    .orderBy(asc(nflWeeks.weekNumber))

  const first = weeks.find((w) => w.startDate)?.startDate
  if (!first) return
  const regular = weeks.filter((w) => w.kind === 'regular' && w.startDate)
  const wildcard = weeks.find((w) => w.kind === 'wildcard' && w.startDate)
  const superBowl = weeks.find((w) => w.kind === 'super-bowl' && w.startDate)
  const lastRegular = regular[regular.length - 1]

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
            ? wildcard?.startDate
              ? inside(wildcard.startDate)
              : lastRegular?.endDate
                ? new Date(lastRegular.endDate.getTime() + 2 * DAY_MS)
                : null
            : superBowl?.startDate
              ? inside(superBowl.startDate)
              : null
  if (!fakeNow) return

  c.set(DEV_NOW_COOKIE, fakeNow.toISOString(), { path: '/', maxAge: 60 * 60 * 24 })
  c.set(DEV_PHASE_COOKIE, phase, { path: '/', maxAge: 60 * 60 * 24 })
  revalidatePath('/', 'layout')
}
