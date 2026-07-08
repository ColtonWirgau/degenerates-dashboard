// Dev-only "time travel" — a cookie holding a fake *now* that the neon
// adapter uses for season-state / current-week reads. Lets you preview
// any season phase (preseason, in-season, playoffs…) against real Neon
// data without touching the DB. Set via the user-menu's "Season phase"
// dev control (app/actions/dev-toolbar.ts → setSeasonPhase).
//
// Read paths only — writes (lockedAt, submittedAt, …) always stamp real
// wall-clock time. No-op outside `next dev`, so it can never leak into
// a production build's behavior.

import { cookies } from 'next/headers'

export const DEV_NOW_COOKIE = 'degens_dev_now'
/** Companion cookie recording which phase preset set the fake now —
 *  purely for showing the active chip in the dev UI. */
export const DEV_PHASE_COOKIE = 'degens_dev_phase'

export async function getDevNow(): Promise<Date> {
  if (process.env.NODE_ENV !== 'development') return new Date()
  try {
    const c = await cookies()
    const raw = c.get(DEV_NOW_COOKIE)?.value
    if (raw) {
      const d = new Date(raw)
      if (!Number.isNaN(d.getTime())) return d
    }
  } catch {
    // Outside a request scope (build, script) — fall through to real now.
  }
  return new Date()
}
