'use client'

import { useLayoutEffect, useRef } from 'react'
import { cardOutline } from '@/components/chrome/bite-geometry'
import { resolveBites, subscribeSplitFrame } from '@/components/chrome/bubble-layout'

/**
 * The page card, carving its own bites. The outline is a generated
 * clip-path (bite-geometry.ts) built from the bubble layout, applied as an
 * inline style and rebuilt whenever the card resizes or the action group's
 * split spring moves — so the cutouts follow the bubbles instead of being
 * hard-coded mask layers in CSS.
 *
 * Desktop only, like the bubbles themselves: below lg the clip clears and
 * the card is a plain block (mobile uses the dock, not the edges). The
 * per-frame path writes go straight to the element through a ref — React
 * never re-renders for an animation frame.
 */
const RADIUS = 20

export function PageSheetCard({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const mq = window.matchMedia('(min-width: 1024px)')
    let w = 0
    let h = 0
    let split = 0
    let third = 0

    const apply = () => {
      el.style.clipPath =
        mq.matches && w > 0 && h > 0
          ? `path("${cardOutline(w, h, RADIUS, resolveBites(h, split, third))}")`
          : ''
    }

    // offsetWidth/Height on purpose: layout size, untouched by the sheet's
    // scale transforms — clip-path applies in pre-transform coordinates.
    const measure = () => {
      w = el.offsetWidth
      h = el.offsetHeight
      apply()
    }
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    measure()

    const unsub = subscribeSplitFrame((t, third3) => {
      split = t
      third = third3
      apply()
    })
    mq.addEventListener('change', apply)
    return () => {
      ro.disconnect()
      unsub()
      mq.removeEventListener('change', apply)
    }
  }, [])

  return (
    <div ref={ref} className="page-sheet-card relative flex min-h-0 flex-1 flex-col">
      {children}
    </div>
  )
}
