'use client'

import { useEffect, useState } from 'react'

/**
 * THE LAUNCH SPLASH — installed app only.
 *
 * iOS holds the static startup image (public/pwa-splash) until the first
 * paint, then drops it. Without something to catch the hand-off you see
 * the lockup, then a bare canvas, then the shell popping in piece by
 * piece. This is the catch: the same canvas and the same lockup the
 * launch image already showed, so the OS frame melts into it, and then
 * the whole thing lifts away and the app is underneath.
 *
 * Standalone only (plus `?splash=1` for looking at it in a browser),
 * once per app session, and a tap skips it. On the web it never runs —
 * a website that makes you watch its logo is a website you close.
 */
const HOLD_MS = 1500
const EXIT_MS = 520

export function SplashScreen() {
  const [phase, setPhase] = useState<'off' | 'show' | 'exit'>('off')

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      // iOS predates display-mode and reports it here instead.
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true
    const forced = new URLSearchParams(window.location.search).has('splash')
    if (!standalone && !forced) return
    try {
      if (!forced && sessionStorage.getItem('dd_splashed')) return
      sessionStorage.setItem('dd_splashed', '1')
    } catch {
      // Private mode can refuse storage. Splash anyway — once is fine.
    }
    setPhase('show')
  }, [])

  useEffect(() => {
    if (phase !== 'show') return
    const t = setTimeout(() => setPhase('exit'), HOLD_MS)
    return () => clearTimeout(t)
  }, [phase])

  useEffect(() => {
    if (phase !== 'exit') return
    const t = setTimeout(() => setPhase('off'), EXIT_MS)
    return () => clearTimeout(t)
  }, [phase])

  if (phase === 'off') return null

  return (
    <div
      aria-hidden
      onClick={() => setPhase('exit')}
      className="fixed inset-0 z-[95] flex items-center justify-center overflow-hidden"
      style={{
        // The launch image's canvas, verbatim, so the swap is invisible.
        backgroundColor: '#0A0A0A',
        backgroundImage:
          'radial-gradient(ellipse at 22% 26%, rgba(0,217,255,0.20) 0%, transparent 52%),' +
          'radial-gradient(ellipse at 78% 20%, rgba(0,217,255,0.12) 0%, transparent 46%),' +
          'radial-gradient(ellipse at 40% 84%, rgba(255,105,180,0.16) 0%, transparent 52%)',
        transform: phase === 'exit' ? 'translateY(-100%)' : 'translateY(0)',
        transition:
          phase === 'exit'
            ? `transform ${EXIT_MS}ms cubic-bezier(0.55, 0, 0.7, 0.3)`
            : 'none',
      }}
    >
      {/* The masthead's lockup at launch scale: stacked, overlapping,
          the two halves in their two colours. It arrives already lit,
          then the glow breathes once — the sign warming up. */}
      <h1 className="font-display splash-lockup flex flex-col items-center text-center leading-[0.82] font-bold tracking-tight uppercase">
        <span className="text-neon-blue relative z-10 text-[15vw]">Degenerates</span>
        <span className="text-neon-pink relative z-0 text-[15vw]">Dashboard</span>
      </h1>
    </div>
  )
}
