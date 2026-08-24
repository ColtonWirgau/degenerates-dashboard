'use client'

import { useRef } from 'react'
import { AvatarNotch } from '@/components/chrome/avatar-notch'
import { PanelBubbles } from '@/components/chrome/panel-bubbles'
import { ActionBubble } from '@/components/chrome/action-bubble'
import { PageSheetCard } from '@/components/chrome/page-sheet-card'
import { ScrollHint } from '@/components/ui/scroll-hint'

/**
 * The page as ONE BIG CARD floating on the neon canvas. Three layers,
 * each earning its keep (ported from RoarTracker):
 *  - .page-sheet — the frame: margins, flex sizing, the transform target.
 *    The edge chrome (bubbles, avatar, action) are its direct children so
 *    they ride every slide.
 *  - .page-sheet-card (PageSheetCard) — the surface: background, radius,
 *    and the generated CLIP-PATH that punches the bubble bites straight
 *    through the card (real holes; the ambient wash shows through, so
 *    there's nothing to color-match).
 *  - .page-sheet-scroll — the scroll container, clipped to the card.
 */
export function PageSheet({ children }: { children: React.ReactNode }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  return (
    <div className="page-sheet flex min-h-0 flex-1 flex-col">
      <AvatarNotch />
      <PanelBubbles />
      <ActionBubble />
      <PageSheetCard>
        {/* The hint is the scroller's SIBLING — as a child it would
            scroll away with the content it's describing. */}
        <div className="relative flex min-h-0 flex-1 flex-col">
          <div
            ref={scrollRef}
            className="page-sheet-scroll relative min-h-0 flex-1 lg:overflow-y-auto"
          >
            {children}
          </div>
          <ScrollHint containerRef={scrollRef} showChip={false} />
        </div>
      </PageSheetCard>
    </div>
  )
}
