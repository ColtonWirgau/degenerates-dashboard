'use client'

import { useEffect, useState } from 'react'
import {
  closePanel,
  subscribePanel,
  type CanvasPanel,
} from '@/components/chrome/canvas-store'
import { ResponsiveSheet, SheetPage } from '@/components/ui/responsive-sheet'

/**
 * Dual-posture wrapper for a canvas panel (the RoarTracker pattern, on
 * this app's ResponsiveSheet): mounted inside a CanvasSheet slot, it
 * renders its children straight into the slot at lg+ (the slot handles
 * show/hide), and as a portaled bottom sheet below lg (the slot div is
 * display:none there, but portals escape it).
 */
export function PanelReveal({
  panel,
  title,
  children,
}: {
  panel: Exclude<CanvasPanel, null>
  title: string
  children: React.ReactNode
}) {
  const [current, setCurrent] = useState<CanvasPanel>(null)
  const [wide, setWide] = useState<boolean | null>(null)
  useEffect(() => subscribePanel(setCurrent), [])
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const update = () => setWide(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  // Before hydration settles, render the wide posture (harmless: the slot
  // is hidden below lg and no sheet can be open yet).
  if (wide !== false) {
    return <div className="flex min-h-0 flex-1 flex-col">{children}</div>
  }

  return (
    <ResponsiveSheet open={current === panel} onClose={closePanel} sheetMaxHeight="92dvh">
      <SheetPage name="main" title={title}>
        {children}
      </SheetPage>
    </ResponsiveSheet>
  )
}
