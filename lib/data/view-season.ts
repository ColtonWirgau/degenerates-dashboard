// Which season the viewer is looking at — the server's half.
//
// A cookie rather than a `?season=` param on purpose: the shell layout
// renders the chrome (masthead lockup, panels) and Next does NOT pass
// searchParams to layouts — a param would leave the layout on one season
// while the page showed another. A cookie both sides read keeps them in
// step.
//
// Writing it is the browser's job (lib/view-season-cookie.ts) — this file
// only reads, and imports the name and the shape check from there so the
// two halves can't drift apart.

import { cookies } from 'next/headers'
import { VIEW_SEASON_COOKIE, isSeasonString } from '@/lib/view-season-cookie'

export { VIEW_SEASON_COOKIE, isSeasonString }

export async function getViewSeason(): Promise<string | null> {
  try {
    const raw = (await cookies()).get(VIEW_SEASON_COOKIE)?.value
    return raw && isSeasonString(raw) ? raw : null
  } catch {
    // Outside a request scope (build, script).
    return null
  }
}
