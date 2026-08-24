'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { VIEW_SEASON_COOKIE, isSeasonString } from '@/lib/data/view-season'

/**
 * Pin the viewer to a season (or clear back to whatever the calendar
 * says). Both the shell layout and the page read the cookie, so the
 * chrome and the content always agree.
 */
export async function setViewSeason(season: string | null) {
  const jar = await cookies()
  if (season === null) {
    jar.delete(VIEW_SEASON_COOKIE)
  } else {
    if (!isSeasonString(season)) {
      return { error: 'Not a season' }
    }
    jar.set(VIEW_SEASON_COOKIE, season, {
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
      sameSite: 'lax',
    })
  }
  revalidatePath('/', 'layout')
  return { error: null }
}
