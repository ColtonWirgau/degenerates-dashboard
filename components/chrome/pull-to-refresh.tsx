'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

/**
 * PULL TO REFRESH — and the pull IS the line.
 *
 * Above the page's top edge is a sportsbook board with one number on
 * it. Dragging down walks that number along a ladder of real American
 * prices, from a long shot toward the house's own −110: the line
 * steams as you pull it, and at the arm point it LOCKS — the app's own
 * verb for a week that stops taking legs. Let go and it's BOOKED while
 * the data comes back.
 *
 * It's one number in Anton tabular because that IS the app's voice:
 * every leg, every lay, every board row is set in these numerals. A
 * spinner here would have been the only thing on a phone screen that
 * didn't belong to this app.
 *
 * The ladder is deterministic, not random — the same pull always shows
 * the same price, so the gesture reads as moving a line rather than as
 * digits scrambling. It only ever shortens, because a line coming to
 * you is the fantasy and a line running away is a bad afternoon.
 */
const MAX = 190 // travel cap (px)
const THRESHOLD = 88 // arm point
const DAMP = 0.5
const BOOK_MS = 620 // the stamp before the page comes home

type Phase = 'idle' | 'pull' | 'book' | 'loading' | 'settle'

/**
 * Real prices, longest first. American odds have a hole in the middle —
 * there is no +99 or −99, and +100 and −100 are the same bet — so this
 * walks a hand-picked ladder rather than interpolating a number, which
 * would have paused on prices no book has ever posted.
 */
const LADDER = [
  '+450',
  '+380',
  '+320',
  '+270',
  '+230',
  '+195',
  '+165',
  '+140',
  '+120',
  '+105',
  '−105',
]
/** Where it stops. The vig, the house's number, the one you always get. */
const LOCKED = '−110'

export function PullToRefresh({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>('idle')
  const [pull, setPull] = useState(0)
  const phaseRef = useRef<Phase>('idle')
  phaseRef.current = phase
  const pullRef = useRef(0)
  pullRef.current = pull

  const startY = useRef(0)
  const startX = useRef(0)
  const axis = useRef<null | 'x' | 'y'>(null)
  const bookedAt = useRef(0)
  const [pending, startRefresh] = useTransition()
  const pendingRef = useRef(false)
  pendingRef.current = pending

  // Phones only. On a desktop there is no touch to answer, and the
  // shell's own column scrolls rather than the window.
  const [on, setOn] = useState(false)
  useEffect(() => {
    const wide = window.matchMedia('(min-width: 1024px)')
    const update = () => setOn(!wide.matches)
    update()
    wide.addEventListener('change', update)
    return () => wide.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    if (!on) return

    const onStart = (e: TouchEvent) => {
      if (phaseRef.current !== 'idle' || window.scrollY > 0) return
      // A pull that starts on an overlay belongs to that surface: the
      // bottom sheets have their own pull-to-close, and the dock is a
      // fixed bar that must not drag the page.
      if (
        (e.target as Element | null)?.closest?.(
          '[role="dialog"], nav[aria-label="Main"]'
        )
      ) {
        axis.current = 'x'
        return
      }
      startY.current = e.touches[0].clientY
      startX.current = e.touches[0].clientX
      axis.current = null
    }

    const onMove = (e: TouchEvent) => {
      const p = phaseRef.current
      if (p !== 'idle' && p !== 'pull') return
      const dy = e.touches[0].clientY - startY.current
      const dx = e.touches[0].clientX - startX.current
      // Commit to an axis once. The roster strip, the keeper picker and
      // the slate's day rows are all horizontal scrollers — a sideways
      // swipe must never start tugging the page down.
      if (axis.current === null && (Math.abs(dy) > 6 || Math.abs(dx) > 6)) {
        axis.current = Math.abs(dy) >= Math.abs(dx) ? 'y' : 'x'
      }
      if (axis.current !== 'y') return
      if (window.scrollY > 0 && pullRef.current === 0) {
        // The page scrolled mid-touch — re-anchor, no pull.
        startY.current = e.touches[0].clientY
        return
      }
      if (dy > 0 || pullRef.current > 0) {
        // Own the gesture outright. This is also what keeps iOS Safari's
        // rubber-band from sliding the whole page under the board.
        e.preventDefault()
        const next = Math.max(0, Math.min(MAX, dy * DAMP))
        setPull(next)
        setPhase(next > 0 ? 'pull' : 'idle')
      }
    }

    const onEnd = () => {
      if (phaseRef.current !== 'pull') return
      if (pullRef.current >= THRESHOLD) {
        bookedAt.current = Date.now()
        setPhase('book')
        // The page HOLDS where the finger left it. The board is already
        // out; sinking further would move the page for nothing.
        startRefresh(() => router.refresh())
      } else {
        setPhase('settle')
        setPull(0)
        setTimeout(() => setPhase('idle'), 320)
      }
    }

    document.addEventListener('touchstart', onStart, { passive: true })
    document.addEventListener('touchmove', onMove, { passive: false })
    document.addEventListener('touchend', onEnd, { passive: true })
    document.addEventListener('touchcancel', onEnd, { passive: true })
    return () => {
      document.removeEventListener('touchstart', onStart)
      document.removeEventListener('touchmove', onMove)
      document.removeEventListener('touchend', onEnd)
      document.removeEventListener('touchcancel', onEnd)
    }
  }, [on, router, startRefresh])

  // The stamp plays, then the page comes home REGARDLESS of the fetch —
  // a header held open while the network thinks is the thing to avoid.
  // If data is still landing the board is already gone and `loading`
  // just waits it out: the stamp was the receipt, and a second indicator
  // for the same gesture is one too many.
  useEffect(() => {
    if (phase !== 'book') return
    const wait = Math.max(0, BOOK_MS - (Date.now() - bookedAt.current))
    const t = setTimeout(() => {
      setPull(0)
      setPhase(pendingRef.current ? 'loading' : 'settle')
      if (!pendingRef.current) setTimeout(() => setPhase('idle'), 320)
    }, wait)
    return () => clearTimeout(t)
  }, [phase, pending])

  useEffect(() => {
    if (phase === 'loading' && !pending) setPhase('idle')
  }, [phase, pending])

  const armed = pull >= THRESHOLD
  const progress = Math.min(1, pull / THRESHOLD)
  const booked = phase === 'book' || phase === 'settle'
  // The ladder walks with the finger, and stops the moment it's armed.
  const price = armed
    ? LOCKED
    : (LADDER[Math.min(LADDER.length - 1, Math.floor(progress * LADDER.length))] ??
      LADDER[0])

  return (
    <>
      {/* THE BOARD. A clipped window exactly as tall as the pull — the
          gap the page opens — with the board glued to its bottom edge,
          so it untucks from behind the masthead and tucks back under it
          on the way home. It can never overlap the page: the window
          ends where the page begins. */}
      {on && phase !== 'idle' && phase !== 'loading' && (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-x-0 top-0 z-40 flex justify-center overflow-hidden lg:hidden"
          style={{
            // The masthead pads itself by the status-area inset, which is
            // blank canvas the board may sit in — so the window is the
            // pull plus that inset, parking the caption right above the
            // wordmark instead of leaving a dead band over it.
            height: pull > 0 ? `calc(${pull}px + env(safe-area-inset-top))` : 0,
            transition:
              phase === 'settle'
                ? 'height 320ms cubic-bezier(0.2, 0.9, 0.25, 1)'
                : phase === 'book'
                  ? 'height 180ms ease-out'
                  : 'none',
          }}
        >
          <div
            className="flex h-full flex-col items-center justify-end pb-2"
            style={{
              opacity: phase === 'pull' ? Math.min(1, pull / 40) : 1,
              transform: `scale(${0.86 + 0.14 * progress})`,
              transformOrigin: 'bottom center',
            }}
          >
            {/* The price, on its chip. Tabular so the digits don't jitter
                as the line walks; the chip's rule is the board's edge. */}
            <div
              className={cn(
                'rounded-lg border px-4 py-1.5 transition-colors duration-150',
                armed
                  ? 'border-neon-blue/60 bg-neon-blue/10'
                  : 'border-white/10 bg-white/[0.03]'
              )}
            >
              <span
                className={cn(
                  'font-display text-[1.75rem] leading-none tabular-nums transition-colors duration-150',
                  armed ? 'text-neon-blue' : 'text-muted-foreground/70',
                  booked && 'ptr-stamp'
                )}
                style={
                  armed
                    ? { textShadow: '0 0 14px rgba(0,217,255,0.55)' }
                    : undefined
                }
              >
                {price}
              </span>
            </div>
            <p
              className={cn(
                'mt-1.5 text-[0.58rem] font-bold tracking-[0.3em] whitespace-nowrap uppercase transition-colors duration-150',
                armed || booked ? 'text-neon-blue/90' : 'text-muted-foreground/60'
              )}
            >
              {booked
                ? 'Booked'
                : armed
                  ? 'Release to lock'
                  : 'Shopping the line'}
            </p>
          </div>
        </div>
      )}

      {/* What follows the finger: the masthead and the card. The dock is
          fixed and the sheets are portaled, so both hold still. */}
      <div
        className="flex min-h-0 flex-1 flex-col"
        style={{
          transform: pull > 0 ? `translateY(${pull}px)` : undefined,
          transition:
            phase === 'settle'
              ? 'transform 320ms cubic-bezier(0.2, 0.9, 0.25, 1)'
              : phase === 'book'
                ? 'transform 180ms ease-out'
                : 'none',
        }}
      >
        {children}
      </div>
    </>
  )
}
