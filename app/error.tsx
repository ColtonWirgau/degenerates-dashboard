'use client'

/**
 * THE CATCH.
 *
 * Mostly here for one specific, entirely predictable failure: server
 * action IDs are minted per build, so a tab that was open across a
 * deploy is holding IDs the running server has never heard of. The next
 * thing you press — changing seasons, locking a week, casting a vote —
 * comes back "Server Action was not found", and until now that was an
 * unhandled crash for whoever happened to have the app open.
 *
 * It's recoverable by definition: the page just needs the current build.
 * So we fetch it. What we must not do is fetch it in a loop — if the
 * reload lands on a server that still can't serve the action, looping
 * turns a bad minute into an infinite one.
 *
 * So the guard is a COOLDOWN, not a one-shot. A one-shot flag was the
 * obvious version and it was wrong twice over: it could only ever be
 * cleared by this boundary rendering successfully, which is a thing a
 * boundary never does, so the flag was set for the life of the tab. The
 * first stale action got its reload and every one after it — a different
 * deploy, an hour later, a wholly unrelated action — went straight to
 * "reloading didn't settle it" without trying. A timestamp distinguishes
 * the two cases the flag conflated: failing AGAIN right now (don't loop)
 * versus failing again LATER (that's a new problem, reload for it).
 */

import { useEffect, useState } from 'react'

const RELOADED_AT = 'degens:stale-action-reload-at'

/** Long enough that a reload-and-fail cycle can't hide inside it; short
 *  enough that the next genuine staleness gets its own free recovery. */
const COOLDOWN_MS = 30_000

/** Next words this differently in dev and prod; both name the action. */
function isStaleAction(error: Error): boolean {
  return (
    /server action/i.test(error.message) &&
    /(not found|failed to find)/i.test(error.message)
  )
}

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const stale = isStaleAction(error)
  const [recovering, setRecovering] = useState(stale)

  useEffect(() => {
    if (!stale) return
    const now = Date.now()
    let looping = false
    try {
      looping = now - Number(sessionStorage.getItem(RELOADED_AT) ?? 0) < COOLDOWN_MS
      sessionStorage.setItem(RELOADED_AT, String(now))
    } catch {
      // Private mode, blocked storage — treat it as "first time" and
      // accept that a truly broken server could reload twice.
    }
    if (looping) {
      setRecovering(false)
      return
    }
    window.location.reload()
  }, [stale])

  if (recovering) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-6">
        <p className="text-muted-foreground text-sm">Catching up with the server…</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6">
      <div className="border-destructive/25 bg-destructive/[0.04] w-full max-w-md rounded-2xl border p-6">
        <h1 className="text-destructive font-display text-2xl leading-none tracking-tight uppercase">
          That didn&apos;t work
        </h1>
        <p className="text-foreground/80 mt-3 text-sm">
          {stale
            ? 'The app updated while you had this open, and reloading didn’t settle it. Try again in a moment.'
            : 'Something broke on the way to the server.'}
        </p>
        {error.digest && (
          <p className="text-muted-foreground mt-2 font-mono text-[11px]">
            {error.digest}
          </p>
        )}
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={reset}
            className="bg-neon-blue/15 text-neon-blue border-neon-blue/40 hover:bg-neon-blue/25 rounded-full border px-4 py-2 text-[11px] font-bold tracking-wider uppercase transition-colors"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="text-muted-foreground hover:text-foreground rounded-full border border-white/10 px-4 py-2 text-[11px] font-bold tracking-wider uppercase transition-colors"
          >
            Reload
          </button>
        </div>
      </div>
    </div>
  )
}
