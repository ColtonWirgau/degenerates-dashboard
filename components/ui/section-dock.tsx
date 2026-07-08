'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SectionAccent } from '@/components/ui/section-header'

const ACCENT: Record<SectionAccent, { text: string }> = {
  blue: { text: 'text-neon-blue' },
  pink: { text: 'text-neon-pink' },
  green: { text: 'text-neon-green' },
  purple: { text: 'text-neon-purple' },
}

// ─── Context — exposes expanded state to children (trailing slot, etc.) ────

const SectionDockContext = createContext<{ expanded: boolean } | null>(null)

export function useSectionDock() {
  const ctx = useContext(SectionDockContext)
  if (!ctx) {
    throw new Error('useSectionDock must be called inside a <SectionDock>')
  }
  return ctx
}

interface SectionDockProps {
  title: string
  kicker?: string
  icon?: LucideIcon
  accent?: SectionAccent
  trailing?: ReactNode
  expandedContent?: ReactNode
  children?: ReactNode
  className?: string
  /** Max height of the expanded panel before it scrolls. Default `70dvh`. */
  panelMaxHeight?: string
}

/**
 * Section dock — a section header that doubles as an expandable surface.
 * Collapsed: plain section header. Expanded: heading + panel become one
 * continuous glass container, panel reveals via `clip-path` (DOM height
 * stable from frame 1 so Framer `layoutId` morphs don't jitter).
 *
 * The panel owns its own scrollable inner container and renders a
 * "Scroll for more" affordance at the bottom edge while there's
 * additional content below the fold — same pattern as `<ResponsiveSheet>`.
 */
export function SectionDock({
  title,
  kicker,
  icon: Icon,
  accent = 'blue',
  trailing,
  expandedContent,
  children,
  className,
  panelMaxHeight = '70dvh',
}: SectionDockProps) {
  const a = ACCENT[accent]
  const [expanded, setExpanded] = useState(false)
  const dockRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [showScrollIndicator, setShowScrollIndicator] = useState(false)
  const expandable = !!expandedContent

  useEffect(() => {
    if (!expanded) return
    const handle = (e: PointerEvent) => {
      const node = dockRef.current
      if (!node) return
      const target = e.target as Node | null
      if (target && !node.contains(target)) setExpanded(false)
    }
    document.addEventListener('pointerdown', handle, true)
    return () => document.removeEventListener('pointerdown', handle, true)
  }, [expanded])

  // Scroll-indicator visibility — recomputed on scroll, resize, and any
  // content-size change inside the panel. Mirrors `<ResponsiveSheet>`'s
  // approach so dock and sheet read consistently.
  const checkScrollIndicator = useCallback(() => {
    const el = scrollContainerRef.current
    if (!el) return
    const hasMore = el.scrollHeight > el.clientHeight + 5
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 20
    setShowScrollIndicator(hasMore && !atBottom)
  }, [])

  useEffect(() => {
    if (!expanded) return
    const el = scrollContainerRef.current
    if (!el) return
    // Recheck a few times after open in case child charts mount + lay
    // out in a few frames (animated lines/labels can shift the
    // effective content height).
    const ts = [
      setTimeout(checkScrollIndicator, 50),
      setTimeout(checkScrollIndicator, 200),
      setTimeout(checkScrollIndicator, 500),
    ]
    el.addEventListener('scroll', checkScrollIndicator)
    window.addEventListener('resize', checkScrollIndicator)
    const ro = new ResizeObserver(checkScrollIndicator)
    ro.observe(el)
    if (el.firstElementChild) ro.observe(el.firstElementChild)
    return () => {
      ts.forEach(clearTimeout)
      el.removeEventListener('scroll', checkScrollIndicator)
      window.removeEventListener('resize', checkScrollIndicator)
      ro.disconnect()
    }
  }, [expanded, checkScrollIndicator])

  const HeadingTag = expandable ? 'button' : 'div'

  return (
    <SectionDockContext.Provider value={{ expanded }}>
      <section className={cn('mt-10 sm:mt-12', className)}>
        <div ref={dockRef} className="relative mb-5 sm:mb-6 -mx-3 sm:-mx-4">
          <HeadingTag
            type={expandable ? 'button' : undefined}
            onClick={expandable ? () => setExpanded((v) => !v) : undefined}
            aria-expanded={expandable ? expanded : undefined}
            className={cn(
              'group relative flex w-full flex-wrap items-center justify-between gap-3 text-left',
              'px-3 sm:px-4 py-2.5 transition-colors',
              expanded
                ? cn(
                    'rounded-t-xl border border-b-0 border-white/15',
                    'bg-white/[0.06] backdrop-blur-3xl'
                  )
                : cn('rounded-lg', expandable && 'hover:bg-white/[0.02]')
            )}
          >
            <div className="min-w-0 flex-1 flex items-center gap-3">
              {Icon && (
                <Icon
                  className={cn(
                    'shrink-0 h-9 w-9 sm:h-10 sm:w-10 md:h-11 md:w-11 opacity-90',
                    a.text
                  )}
                />
              )}
              <div className="min-w-0">
                {kicker && (
                  <div
                    className={cn(
                      'text-[10px] font-bold tracking-[0.3em] uppercase leading-none',
                      a.text
                    )}
                  >
                    {kicker}
                  </div>
                )}
                <h2
                  className={cn(
                    'min-w-0 truncate text-lg sm:text-xl md:text-2xl font-bold tracking-wide leading-none',
                    kicker && 'mt-1',
                    a.text
                  )}
                >
                  {title}
                </h2>
              </div>
            </div>
            {(trailing || expandable) && (
              <div className="shrink-0 flex items-center gap-2">
                {trailing}
                {expandable && (
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 text-muted-foreground transition-transform',
                      expanded && 'rotate-180',
                      !expanded && 'group-hover:text-foreground'
                    )}
                  />
                )}
              </div>
            )}
          </HeadingTag>

          <AnimatePresence initial={false}>
            {expanded && expandable && (
              <motion.div
                key="section-dock-body"
                initial={{ clipPath: 'inset(0 0 100% 0)', opacity: 0 }}
                animate={{ clipPath: 'inset(0 0 0% 0)', opacity: 1 }}
                exit={{ clipPath: 'inset(0 0 100% 0)', opacity: 0 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
                // z-50 so the panel opens *over* the floating bottom dock
                // (which sits at z-40). Collapsed section headings stay in
                // normal flow (no z bump) and continue to scroll under the
                // bottom dock as expected.
                className={cn(
                  'absolute top-full inset-x-0 z-50',
                  'rounded-b-xl border border-t-0 border-white/15',
                  'bg-white/[0.06] backdrop-blur-3xl shadow-[0_8px_30px_rgba(0,0,0,0.4)]'
                )}
                onClick={(e) => {
                  const target = e.target as HTMLElement | null
                  if (target?.closest('button, a, input, textarea')) return
                  setExpanded(false)
                }}
              >
                <div
                  ref={scrollContainerRef}
                  className="scrollbar-hide overflow-y-auto"
                  style={{ maxHeight: panelMaxHeight }}
                >
                  {expandedContent}
                </div>

                {/* Scroll-for-more affordance — fades when content fits
                    or the user has scrolled to the bottom. */}
                <AnimatePresence>
                  {showScrollIndicator && (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="pointer-events-none absolute inset-x-0 bottom-2 z-10 flex justify-center"
                    >
                      <div className="flex items-center gap-1.5 text-[10px] font-bold tracking-[0.25em] uppercase text-neon-blue [text-shadow:0_0_12px_rgba(0,217,255,0.5)]">
                        <span>Scroll for more</span>
                        <motion.div
                          animate={{ y: [0, 3, 0] }}
                          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                        >
                          <ChevronDown className="h-3 w-3" />
                        </motion.div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {children}
      </section>
    </SectionDockContext.Provider>
  )
}
