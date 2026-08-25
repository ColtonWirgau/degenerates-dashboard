// The season pin, as the BROWSER sees it.
//
// Switching seasons used to go through a server action, which bought us
// nothing and cost two things: a round trip before anything moved, and a
// hard crash for any tab that outlived a build. Action ids are minted per
// build — in dev, per recompile — so the first season you picked after an
// HMR pass came back "Server Action was not found".
//
// The cookie was never httpOnly, so there is nothing the server was doing
// here that the browser can't do itself. Write it, then refresh. No
// action id to go stale, and the new year is on screen before the request
// leaves.
//
// The server's reader lives in lib/data/view-season.ts and shares this
// file's name and shape checks, so the two sides can't drift.

export const VIEW_SEASON_COOKIE = 'degens_view_season'

const SEASON_RE = /^\d{4}-\d{4}$/

export function isSeasonString(value: string): boolean {
  return SEASON_RE.test(value)
}

const THIRTY_DAYS = 60 * 60 * 24 * 30

/**
 * Pin the viewer to a season, or pass null to clear back to whatever the
 * calendar says. Browser only — call it from an event handler, then
 * `router.refresh()` to re-read the tree under it.
 */
export function writeViewSeason(season: string | null): void {
  if (season === null) {
    document.cookie = `${VIEW_SEASON_COOKIE}=; path=/; max-age=0; samesite=lax`
    return
  }
  // Same guard the server used to apply. A junk value would just make
  // getViewSeason ignore the cookie, but leaving one behind means the
  // next good write has to beat it.
  if (!isSeasonString(season)) return
  document.cookie = `${VIEW_SEASON_COOKIE}=${season}; path=/; max-age=${THIRTY_DAYS}; samesite=lax`
}
