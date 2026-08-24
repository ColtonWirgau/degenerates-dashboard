'use client'

import { useEffect, useState } from 'react'
import { Check, Plus, Vote } from 'lucide-react'
import {
  openPanel,
  openSubmit,
  subscribePanel,
  type CanvasPanel,
} from '@/components/chrome/canvas-store'
import { useLeagueChrome } from '@/components/chrome/league-chrome-context'
import { ArcLabel } from '@/components/chrome/arc-label'
import { DISC_CENTER } from '@/components/chrome/bite-geometry'
import { ACTION_HOME_C } from '@/components/chrome/bubble-layout'

/**
 * The card's RIGHT-edge, bottom: the league's ONE verb. In-season it's
 * SUBMIT — your leg for the week (a check once you're in, still opens the
 * reveal to review/replace). Off-/preseason it's VOTE — straight into the
 * polls panel. A single bite for now; the split-spring plumbing from the
 * source shell stays dormant in bubble-layout until a second verb earns
 * its rank.
 */
export function ActionBubble() {
  const chrome = useLeagueChrome()
  const [panel, setPanel] = useState<CanvasPanel>(null)
  useEffect(() => subscribePanel(setPanel), [])

  if (!chrome) return null
  const offseason =
    chrome.seasonKind === 'offseason' || chrome.seasonKind === 'preseason'
  const open = panel === (offseason ? 'polls' : 'submit')
  const label = open ? 'CLOSE' : offseason ? 'VOTE' : chrome.submitted ? 'YOUR LEG' : 'SUBMIT'

  return (
    <button
      type="button"
      data-sheet-bubble
      data-action-bubble
      onClick={() => (offseason ? openPanel('polls') : openSubmit())}
      aria-label={label.toLowerCase()}
      aria-expanded={open}
      className="group hidden focus-visible:outline-none lg:block"
      style={{
        position: 'absolute',
        right: 0,
        bottom: ACTION_HOME_C - DISC_CENTER,
        transform: 'translateX(50%)',
        width: 64,
        height: 75,
        zIndex: 40,
      }}
    >
      <ArcLabel
        text={label}
        cx={44}
        cy={49.5}
        r={39.5}
        side="left"
        boxW={88}
        boxH={99}
        inset={12}
        fontSize={8}
        bias={1.2}
      />
      <span
        className="neon-disc neon-disc-hero group-focus-visible:ring-2 group-focus-visible:ring-white absolute flex items-center justify-center rounded-full"
        style={{ left: 10, top: 15.5, width: 44, height: 44 }}
      >
        <span
          key={`${label}-${open}`}
          className="face-pop flex items-center justify-center"
        >
          {open ? (
            <span aria-hidden className="text-[1.15rem] leading-none">
              ✕
            </span>
          ) : offseason ? (
            <Vote size={22} strokeWidth={2.25} />
          ) : chrome.submitted ? (
            <Check size={22} strokeWidth={2.5} />
          ) : (
            <Plus size={24} strokeWidth={2.25} />
          )}
        </span>
      </span>
    </button>
  )
}
