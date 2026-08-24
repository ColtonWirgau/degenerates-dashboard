import { AvatarNotch } from '@/components/chrome/avatar-notch'
import { PanelBubbles } from '@/components/chrome/panel-bubbles'
import { ActionBubble } from '@/components/chrome/action-bubble'
import { PageSheetCard } from '@/components/chrome/page-sheet-card'

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
  return (
    <div className="page-sheet flex min-h-0 flex-1 flex-col">
      <AvatarNotch />
      <PanelBubbles />
      <ActionBubble />
      <PageSheetCard>
        <div className="page-sheet-scroll relative min-h-0 flex-1 lg:overflow-y-auto">
          {children}
        </div>
      </PageSheetCard>
    </div>
  )
}
