'use client'

import { useEffect, useState } from 'react'
import {
  closePanel,
  subscribePanel,
  type CanvasPanel,
} from '@/components/chrome/canvas-store'

/**
 * The desktop reveals (ported from RoarTracker): the page is a dark-glass
 * neon card floating over the ambient canvas, and it pulls back toward a
 * top corner to show what's printed underneath. Every bubble on an edge
 * opens the panel on ITS side — the rail's four on the left, your leg and
 * your profile on the right — so the card always slides away FROM the
 * thing you pressed. Only the card moves; the masthead holds still.
 * (Mobile gets ResponsiveSheets instead.)
 */
const LEFT_PANELS = ['slate', 'parlay', 'board'] as const
const RIGHT_PANELS = ['submit', 'profile', 'season'] as const

const PANEL_LABEL: Record<Exclude<CanvasPanel, null>, string> = {
  season: 'Season',
  slate: 'Weeks',
  parlay: 'The Lay',
  board: 'Board',
  submit: 'The Leg',
  profile: 'Profile',
}

export function CanvasSheet({
  seasonPanel,
  slatePanel,
  parlayPanel,
  boardPanel,
  submitPanel,
  profilePanel,
  children,
}: {
  seasonPanel: React.ReactNode
  slatePanel: React.ReactNode
  parlayPanel: React.ReactNode
  boardPanel: React.ReactNode
  submitPanel: React.ReactNode
  profilePanel: React.ReactNode
  children: React.ReactNode
}) {
  const [panel, setPanel] = useState<CanvasPanel>(null)
  const [wide, setWide] = useState(false)
  // The last direction the sheet pulled toward. It must persist through the
  // close so the transform-origin holds still for the whole return glide —
  // see the sheet-origin-* rules in globals.css.
  const [lastSide, setLastSide] = useState<'left' | 'right'>('right')

  // The last OPEN panel, kept through the close so the giant watermark
  // fades out still wearing the right word.
  const [lastPanel, setLastPanel] = useState<Exclude<CanvasPanel, null>>('slate')

  useEffect(() => subscribePanel(setPanel), [])
  const onRight = (p: CanvasPanel) =>
    p === 'submit' || p === 'profile' || p === 'season'
  useEffect(() => {
    if (panel) {
      setLastSide(onRight(panel) ? 'left' : 'right')
      setLastPanel(panel)
    }
  }, [panel])
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const update = () => setWide(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  useEffect(() => {
    if (!panel) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closePanel()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [panel])

  const slid = wide ? panel : null
  const leftContent = {
    slate: slatePanel,
    parlay: parlayPanel,
    board: boardPanel,
  } as const
  const rightContent = {
    submit: submitPanel,
    profile: profilePanel,
    season: seasonPanel,
  } as const

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {/* While a panel is open, EVERYTHING that isn't the panel puts the
          sheet back: the scaled sheet (via the track's click capture), and
          this catcher for the bare canvas around it. It sits before the
          panels in the DOM, so the cards stack above it and keep their
          clicks. */}
      {slid && (
        <div
          aria-hidden
          className="fixed inset-0 z-0 hidden lg:block"
          onClick={closePanel}
        />
      )}

      {/* What you're looking at, said HUGE on the canvas — neon watermark
          under the scaled card, riding the same clock. Anton, dimmed to a
          glow-less wash (opacity kills the text-shadow trick anyway). */}
      <div
        aria-hidden
        className={`font-display pointer-events-none fixed bottom-8 z-0 hidden text-[10rem] leading-[0.72] uppercase select-none text-[#00D9FF]/10 transition-[opacity,transform] duration-[340ms] ease-[cubic-bezier(0.2,0.9,0.25,1)] lg:block ${
          slid ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
        } ${
          onRight(slid ?? lastPanel)
            ? 'right-[calc(max(23vw,19rem)+4.5rem)]'
            : 'left-[calc(max(23vw,19rem)+4.5rem)]'
        }`}
      >
        {PANEL_LABEL[slid ?? lastPanel]}
      </div>

      {/* Under the sheet's RIGHT edge: your leg, your profile, and the
          season — everything whose trigger lives on that side, sliding in
          from off-screen right. */}
      {RIGHT_PANELS.map((p) => (
        <div
          key={p}
          data-split-keep
          aria-hidden={slid !== p}
          className={`fixed right-6 top-[5.75rem] z-0 hidden max-h-[calc(100dvh-7.5rem)] w-[max(23vw,19rem)] flex-col transition-[transform,opacity] duration-[340ms] ease-[cubic-bezier(0.2,0.9,0.25,1)] lg:flex ${
            slid === p
              ? 'translate-x-0 opacity-100'
              : 'pointer-events-none translate-x-[115%] opacity-0'
          }`}
        >
          <div className="neon-panel-card flex min-h-0 flex-col overflow-hidden px-5 pt-5 pb-4">
            {rightContent[p]}
          </div>
        </div>
      ))}

      {/* Under the sheet's left edge: the rail's panels — one slot, each
          on its own card. The active one SLIDES IN from off-screen left
          (same clock and ease as the card pulling back). */}
      {LEFT_PANELS.map((p) => (
        <div
          key={p}
          aria-hidden={slid !== p}
          className={`fixed left-6 top-[5.75rem] z-0 hidden max-h-[calc(100dvh-7.5rem)] w-[max(23vw,19rem)] flex-col transition-[transform,opacity] duration-[340ms] ease-[cubic-bezier(0.2,0.9,0.25,1)] lg:flex ${
            slid === p
              ? 'translate-x-0 opacity-100'
              : 'pointer-events-none -translate-x-[115%] opacity-0'
          }`}
        >
          <div className="neon-panel-card flex min-h-0 flex-col overflow-hidden px-5 pt-5 pb-4">
            {leftContent[p]}
          </div>
        </div>
      ))}

      {/* The sheet track. While a panel is open, any click on the sheet
          puts it back. */}
      <div
        className={`sheet-track relative z-10 flex min-h-0 flex-1 flex-col ${
          slid && onRight(slid) ? 'is-slid-left' : slid ? 'is-slid-right' : ''
        } ${
          (slid ? (onRight(slid) ? 'left' : 'right') : lastSide) === 'left'
            ? 'sheet-origin-left'
            : 'sheet-origin-right'
        }`}
        onClickCapture={
          slid
            ? (e) => {
                // The edge bubbles and the avatar notch ride the sheet, but
                // they're controls, not "the page" — their clicks (close ✕,
                // switch panels) pass through instead of just snapping the
                // sheet back.
                if ((e.target as HTMLElement).closest?.('[data-sheet-bubble]')) return
                e.preventDefault()
                e.stopPropagation()
                closePanel()
              }
            : undefined
        }
      >
        {children}
      </div>
    </div>
  )
}
