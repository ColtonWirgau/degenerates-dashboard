// Which season the viewer is looking at.
//
// A cookie rather than a `?season=` param on purpose: the shell layout
// renders the chrome (masthead lockup, panels) and Next does NOT pass
// searchParams to layouts — a param would leave the layout on one season
// while the page showed another. A cookie both sides read keeps them in
// step.

import { cookies } from 'next/headers'

export const VIEW_SEASON_COOKIE = 'degens_view_season'

const SEASON_RE = /^\d{4}-\d{4}$/

export async function getViewSeason(): Promise<string | null> {
  try {
    const raw = (await cookies()).get(VIEW_SEASON_COOKIE)?.value
    return raw && SEASON_RE.test(raw) ? raw : null
  } catch {
    // Outside a request scope (build, script).
    return null
  }
}

export function isSeasonString(value: string): boolean {
  return SEASON_RE.test(value)
}
