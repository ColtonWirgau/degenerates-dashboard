'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Scroll affordance for a world with no scrollbars.
 *
 * Ported from the Woodside microsites (which took it from the apps
 * platform) and reskinned neon. Two pieces:
 *
 *  - <EdgeFog> — the overflow cue. The content BLURS OUT under a gradient
 *    MASK at the edge, rather than sitting behind a gradient fill: the
 *    blur is what reads as "there's more", and the glass clearing is what
 *    reads as "you're at the end". It fades rather than unmounts, because
 *    the transition IS the message.
 *  - <ScrollHint> — a chip that says so out loud and jumps you down.
 *
 * Mount the hint as a SIBLING of the scroller inside a `relative` wrapper,
 * never as its child — a child would scroll away with the content:
 *
 *   <div className="relative min-h-0 flex-1">
 *     <div ref={ref} className="h-full overflow-y-auto">{children}</div>
 *     <ScrollHint containerRef={ref} />
 *   </div>
 */

export interface ScrollEdges {
  /** Content is hidden above — blur the top edge. */
  above: boolean
  /** Content is hidden below — blur the bottom edge. */
  below: boolean
  /** Enough left below to be worth prompting about. */
  hint: boolean
}

/**
 * Tracks a scroller's edges. The 8px slack keeps sub-pixel rounding from
 * stranding a permanent blur; `hint` cuts off earlier so the chip bows out
 * before the fog does.
 */
export function useScrollEdges(
  containerRef: React.RefObject<HTMLElement | null>
): ScrollEdges {
  const [edges, setEdges] = useState<ScrollEdges>({
    above: false,
    below: false,
    hint: false,
  })

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const check = () => {
      const remaining = el.scrollHeight - el.clientHeight - el.scrollTop
      const scrollable = el.scrollHeight > el.clientHeight + 32
      const next: ScrollEdges = {
        above: scrollable && el.scrollTop > 8,
        below: scrollable && remaining > 8,
        hint: scrollable && remaining > 64,
      }
      // Scroll fires every frame — bail out unless something actually
      // flipped, or React re-renders the whole subtree 60x/second.
      setEdges((prev) =>
        prev.above === next.above &&
        prev.below === next.below &&
        prev.hint === next.hint
          ? prev
          : next
      )
    }

    check()
    el.addEventListener('scroll', check, { passive: true })
    // Images landing and data arriving change scrollHeight without firing
    // a resize event, so observe the box and its content.
    const ro = new ResizeObserver(check)
    ro.observe(el)
    if (el.firstElementChild) ro.observe(el.firstElementChild)
    window.addEventListener('resize', check)

    return () => {
      el.removeEventListener('scroll', check)
      window.removeEventListener('resize', check)
      ro.disconnect()
    }
  }, [containerRef])

  return edges
}

/**
 * The blur cue itself: a band of backdrop-blur revealed through a gradient
 * mask, so the content dissolves into the surface instead of hitting a
 * hard line. z-[5] keeps it under any hint chip (z-10) and a sheet's drag
 * handle (z-20).
 */
export function EdgeFog({
  side,
  show,
  className,
}: {
  side: 'top' | 'bottom'
  show: boolean
  className?: string
}) {
  const toward = side === 'top' ? 'to bottom' : 'to top'
  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none absolute inset-x-0 z-[5] h-14 backdrop-blur-[6px] transition-opacity duration-300',
        // A whisper of the ground colour so the blur has something to
        // tint with on very dark content.
        'bg-[#0A0A0A]/40',
        side === 'top' ? 'top-0' : 'bottom-0',
        show ? 'opacity-100' : 'opacity-0',
        className
      )}
      style={{
        WebkitMaskImage: `linear-gradient(${toward}, black 25%, transparent)`,
        maskImage: `linear-gradient(${toward}, black 25%, transparent)`,
      }}
    />
  )
}

/** rAF scroll — `behavior: 'smooth'` is unreliable inside transformed and
 *  animated containers, and this lets us own the easing. */
function glideBy(el: HTMLElement, delta: number, duration = 350) {
  const start = el.scrollTop
  const startedAt = performance.now()
  const step = (now: number) => {
    const t = Math.min(1, (now - startedAt) / duration)
    const eased = 1 - Math.pow(1 - t, 3)
    el.scrollTop = start + delta * eased
    if (t < 1) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}

/**
 * Both fogs plus a "more" chip for a scrollable container. Pass the same
 * ref you put on the scroller.
 */
export function ScrollHint({
  containerRef,
  label = 'Scroll for more',
  showChip = true,
}: {
  containerRef: React.RefObject<HTMLElement | null>
  label?: string
  /** Fog only — for tight panels where a chip would crowd the content. */
  showChip?: boolean
}) {
  const { above, below, hint } = useScrollEdges(containerRef)

  const onClick = useCallback(() => {
    const el = containerRef.current
    if (el) glideBy(el, el.clientHeight * 0.7)
  }, [containerRef])

  return (
    <>
      <EdgeFog side="top" show={above} />
      <EdgeFog side="bottom" show={below} />
      {showChip && (
        <button
          type="button"
          aria-hidden={!hint}
          tabIndex={hint ? 0 : -1}
          onClick={onClick}
          className={cn(
            'glass text-neon-blue absolute bottom-2 left-1/2 z-10 inline-flex -translate-x-1/2 items-center gap-1.5',
            'rounded-full px-3 py-1.5 text-[10px] font-bold tracking-[0.25em] uppercase',
            'transition-opacity duration-300',
            hint ? 'opacity-100' : 'pointer-events-none opacity-0'
          )}
        >
          <span>{label}</span>
          <ChevronDown className="hint-bob h-3 w-3" />
        </button>
      )}
    </>
  )
}

/**
 * Page-level twin: watches the document instead of a container and floats
 * above everything. Desktop only — on touch, scrolling needs no hint.
 */
export function PageScrollHint({ label = 'Scroll' }: { label?: string }) {
  const [show, setShow] = useState(false)
  const raf = useRef<number | null>(null)

  useEffect(() => {
    const doc = document.documentElement
    const check = () => {
      const remaining = doc.scrollHeight - window.innerHeight - window.scrollY
      setShow(doc.scrollHeight > window.innerHeight + 48 && remaining > 180)
    }
    check()
    window.addEventListener('scroll', check, { passive: true })
    window.addEventListener('resize', check)
    const ro = new ResizeObserver(check)
    ro.observe(document.body)
    return () => {
      window.removeEventListener('scroll', check)
      window.removeEventListener('resize', check)
      ro.disconnect()
      if (raf.current) cancelAnimationFrame(raf.current)
    }
  }, [])

  if (!show) return null

  const jump = () => {
    // Land on the next section boundary below the fold when there is one.
    const next = Array.from(
      document.querySelectorAll<HTMLElement>('main section, footer')
    ).find((el) => el.getBoundingClientRect().top > 96)
    const target = next
      ? window.scrollY + next.getBoundingClientRect().top - 24
      : window.scrollY + window.innerHeight * 0.8
    const start = window.scrollY
    const startedAt = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, (now - startedAt) / 450)
      const eased = 1 - Math.pow(1 - t, 3)
      window.scrollTo(0, start + (target - start) * eased)
      if (t < 1) raf.current = requestAnimationFrame(step)
    }
    raf.current = requestAnimationFrame(step)
  }

  return (
    <button
      type="button"
      onClick={jump}
      className="glass text-neon-blue hover:text-foreground fixed bottom-4 left-1/2 z-40 hidden -translate-x-1/2 items-center gap-2 rounded-full px-4 py-2 text-[10px] font-bold tracking-[0.25em] uppercase transition-colors lg:flex"
    >
      <span>{label}</span>
      <ChevronDown className="hint-bob h-3 w-3" />
    </button>
  )
}
