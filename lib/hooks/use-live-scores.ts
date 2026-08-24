'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { LiveGame, LiveWeekPayload } from '@/lib/live-scores'

// Poll cadence. Fast only while something is actually in progress; a slow
// heartbeat while the slate window is open but nothing has kicked off; and
// completely idle outside the window (the common case — most of the week).
const LIVE_MS = 30_000
const IDLE_MS = 120_000

/**
 * Live game state for a week, merged over whatever the server rendered.
 * Polls only while the slate window is open, and pauses entirely when the
 * tab is hidden — a backgrounded phone costs nothing.
 *
 * Pass `nflWeekId = null` to disable (off-season, no week).
 */
export function useLiveScores(nflWeekId: string | null): {
  byId: Map<string, LiveGame>
  anyLive: boolean
} {
  const [payload, setPayload] = useState<LiveWeekPayload | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!nflWeekId) {
      setPayload(null)
      return
    }
    let cancelled = false

    const clear = () => {
      if (timer.current) clearTimeout(timer.current)
      timer.current = null
    }

    const tick = async () => {
      if (cancelled) return
      if (typeof document !== 'undefined' && document.hidden) {
        // Hidden tab: check back later without touching the network.
        timer.current = setTimeout(tick, IDLE_MS)
        return
      }
      try {
        const res = await fetch(`/api/live/${nflWeekId}`, { cache: 'no-store' })
        if (res.ok) {
          const json = (await res.json()) as LiveWeekPayload
          if (!cancelled) setPayload(json)
          if (!cancelled && !json.windowOpen) {
            // Nothing to watch — stop until the tab is re-shown.
            clear()
            return
          }
          if (!cancelled) {
            timer.current = setTimeout(tick, json.anyLive ? LIVE_MS : IDLE_MS)
            return
          }
        }
      } catch {
        // Network hiccup — keep the last good state and back off.
      }
      if (!cancelled) timer.current = setTimeout(tick, IDLE_MS)
    }

    void tick()

    // Coming back to the tab should feel instant, not "wait 30s".
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        clear()
        void tick()
      }
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      cancelled = true
      clear()
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [nflWeekId])

  const byId = useMemo(() => {
    const m = new Map<string, LiveGame>()
    for (const g of payload?.games ?? []) m.set(g.id, g)
    return m
  }, [payload])

  return { byId, anyLive: payload?.anyLive ?? false }
}
